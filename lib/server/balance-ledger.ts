import { z } from "zod";
import { requirePermission, PermissionDenied } from "./access.ts";
import { createHash } from "node:crypto";
import type { ApprovedSettlement } from "../settlements.ts";
import type { CompanyAccess } from "./access.ts";
const id = z.string().trim().min(1).max(128);
export const balanceTypes = ["CASH_ADVANCE", "ESCROW", "RECOVERABLE_EXPENSE", "COMPANY_CREDIT", "OTHER"] as const;
const accountSchema = z.object({ id, companyId: id, contractorId: id, type: z.enum(balanceTypes) }).strict();
const entrySchema = z.object({ id, companyId: id, contractorId: id, accountId: id, kind: z.enum(["OPENING", "INCREASE", "RECOVERY", "RELEASE", "REVERSAL"]), amountCents: z.number().int().safe().refine(value => value !== 0), sourceId: id, idempotencyKey: id, actorId: id, reason: z.string().trim().min(1).max(500), occurredAt: z.string().datetime(), reversesEntryId: id.optional() }).strict();
export type BalanceAccount = z.infer<typeof accountSchema>;
export type LedgerEntry = Readonly<z.infer<typeof entrySchema>>;
export type LedgerPosting = Pick<LedgerEntry, "id" | "kind" | "amountCents" | "sourceId" | "idempotencyKey" | "reason" | "reversesEntryId">;
function scopedHistory(access: CompanyAccess, raw: BalanceAccount, history: readonly LedgerEntry[]) {
  const account = accountSchema.parse(raw);
  if (account.companyId !== access.companyId) throw new PermissionDenied();
  const entries = history.map(entry => entrySchema.parse(entry));
  if (entries.some(entry => entry.companyId !== account.companyId || entry.contractorId !== account.contractorId || entry.accountId !== account.id)) throw new PermissionDenied();
  if (new Set(entries.map(entry => entry.id)).size !== entries.length || new Set(entries.map(entry => entry.idempotencyKey)).size !== entries.length || new Set(entries.map(entry => entry.sourceId)).size !== entries.length) throw new Error("Ledger history contains duplicate entries.");
  for (const entry of entries) {
    if (["OPENING", "INCREASE"].includes(entry.kind) && entry.amountCents < 0) throw new Error("Ledger history contains an invalid increase.");
    if (["RECOVERY", "RELEASE"].includes(entry.kind) && entry.amountCents > 0) throw new Error("Ledger history contains an invalid decrease.");
    if ((entry.kind === "RECOVERY" && account.type === "ESCROW") || (entry.kind === "RELEASE" && account.type !== "ESCROW")) throw new Error("Ledger activity does not match its account type.");
    if (entry.kind === "REVERSAL") {
      const original = entries.find(prior => prior.id === entry.reversesEntryId);
      if (!original || original.kind === "REVERSAL" || entry.amountCents !== -original.amountCents || entries.filter(prior => prior.reversesEntryId === original.id).length !== 1) throw new Error("Ledger history contains an invalid reversal.");
    } else if (entry.reversesEntryId) throw new Error("Ledger history contains an invalid reversal reference.");
  }
  if (entries.filter(entry => entry.kind === "OPENING").length > 1) throw new Error("Ledger history contains multiple opening entries.");
  return { account, entries };
}
function total(entries: readonly LedgerEntry[]) {
  const value = entries.reduce((sum, entry) => sum + BigInt(entry.amountCents), BigInt(0));
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Balance is outside the supported range.");
  return Number(value);
}
export function ledgerBalance(access: CompanyAccess, account: BalanceAccount, history: readonly LedgerEntry[], now: number) {
  requirePermission(access, "ledger.read", now);
  return total(scopedHistory(access, account, history).entries);
}
// A preparation result, not a database write. The adapter MUST lock the account,
// load its history, prepare, and insert entry + audit in one transaction. Enforce
// unique (company,account,idempotency), source and reversal keys in the database.
export function prepareLedgerPosting(access: CompanyAccess, rawAccount: BalanceAccount, posting: LedgerPosting, history: readonly LedgerEntry[], now: number) {
  requirePermission(access, "ledger.post", now);
  return preparePosting(access, rawAccount, posting, history, now);
}
function preparePosting(access: CompanyAccess, rawAccount: BalanceAccount, posting: LedgerPosting, history: readonly LedgerEntry[], now: number) {
  const { account, entries } = scopedHistory(access, rawAccount, history);
  const entry = entrySchema.parse({ ...posting, companyId: account.companyId, contractorId: account.contractorId, accountId: account.id, actorId: access.userId, occurredAt: new Date(now).toISOString() });
  const retry = entries.find(prior => prior.idempotencyKey === entry.idempotencyKey);
  if (retry) {
    const equal = (["kind", "amountCents", "sourceId", "reason", "reversesEntryId"] as const).every(key => retry[key] === entry[key]);
    if (!equal) throw new Error("This request key was already used for different balance activity.");
    return Object.freeze({ entry: Object.freeze({ ...retry }), balanceCents: total(entries), replayed: true, audit: null });
  }
  if (entries.some(prior => prior.id === entry.id || prior.sourceId === entry.sourceId)) throw new Error("This balance activity has already been recorded.");
  if (entry.kind === "OPENING" && entries.length) throw new Error("An opening balance must be the first account entry.");
  if (["OPENING", "INCREASE"].includes(entry.kind) && entry.amountCents < 0) throw new Error("An opening balance or increase must be positive.");
  if (["RECOVERY", "RELEASE"].includes(entry.kind) && entry.amountCents > 0) throw new Error("A recovery or release must decrease the balance.");
  if (entry.kind === "RECOVERY" && account.type === "ESCROW") throw new Error("Use a release for an escrow balance.");
  if (entry.kind === "RELEASE" && account.type !== "ESCROW") throw new Error("Use a recovery for this balance type.");
  if (entry.kind === "REVERSAL") {
    const original = entries.find(prior => prior.id === entry.reversesEntryId);
    if (!original || original.kind === "REVERSAL" || entry.amountCents !== -original.amountCents) throw new Error("A reversal must exactly offset an original entry in this account.");
    if (entries.some(prior => prior.reversesEntryId === original.id)) throw new Error("This balance entry was already reversed.");
  } else if (entry.reversesEntryId) throw new Error("Only reversals may reference a reversed entry.");
  const balanceCents = total([...entries, entry]);
  const frozen = Object.freeze(entry);
  return Object.freeze({ entry: frozen, balanceCents, replayed: false, audit: Object.freeze({ action: "balance.posted" as const, companyId: account.companyId, actorId: access.userId, accountId: account.id, entryId: entry.id, kind: entry.kind, sourceId: entry.sourceId, occurredAt: entry.occurredAt }) });
}

// Only the trusted approval service supplies this freshly calculated snapshot.
// An approver may post its exact recovery, not arbitrary finance adjustments.
export function prepareApprovedRecovery(access: CompanyAccess, account: BalanceAccount, settlement: ApprovedSettlement, ruleId: string, history: readonly LedgerEntry[], now: number) {
  requirePermission(access, "payroll.approve", now);
  if (settlement.status !== "APPROVED" || settlement.companyId !== access.companyId || account.companyId !== access.companyId || settlement.contractorId !== account.contractorId || settlement.approvedBy !== access.userId || settlement.approvedAt !== new Date(now).toISOString()) throw new PermissionDenied();
  if (account.type === "ESCROW") throw new Error("Escrow posting needs a separate reviewed settlement mapping.");
  const amount = settlement.lines.filter(line => line.kind === "DEDUCTION" && line.origin === "AUTOMATIC" && line.ruleId === ruleId).reduce((sum, line) => sum + BigInt(line.amountCents), BigInt(0));
  if (amount === BigInt(0)) return null;
  if (amount < BigInt(0) || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Invalid settlement balance recovery.");
  const key = createHash("sha256").update(JSON.stringify([settlement.companyId, settlement.payrollRunId, settlement.contractorId, ruleId, account.id])).digest("hex");
  return preparePosting(access, account, { id: `recovery-${key}`, kind: "RECOVERY", amountCents: -Number(amount), sourceId: `settlement-${key}`, idempotencyKey: `approval-${key}`, reason: "Approved settlement balance recovery" }, history, now);
}
