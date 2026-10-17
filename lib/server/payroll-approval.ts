import { createHash } from "node:crypto";
import { z } from "zod";
import { prepareApproval } from "../settlements.ts";
import type { ApprovedSettlement, CalculationInput } from "../settlements.ts";
import { PermissionDenied, requirePermission, resolveCompanyAccess } from "./access.ts";
import type { AccessDependencies } from "./access.ts";
import { ledgerBalance, prepareApprovedRecovery } from "./balance-ledger.ts";
import type { BalanceAccount, LedgerEntry } from "./balance-ledger.ts";
const id = z.string().trim().min(1).max(128);
const requestSchema = z.object({ companyId: id, payrollRunId: id, idempotencyKey: id, expectedRevision: z.number().int().safe().nonnegative(), reviewReasons: z.record(id, z.record(id, z.string().trim().min(1).max(500))).default({}) }).strict();
export type ApprovalRequest = z.infer<typeof requestSchema>;
export type BalanceBinding = { contractorId: string; ruleId: string; account: BalanceAccount; history: readonly LedgerEntry[] };
export type LockedPayroll = { companyId: string; payrollRunId: string; revision: number; status: "DRAFT" | "REVIEW" | "APPROVED" | "PAID" | "LOCKED" | "CANCELLED" | "REVERSED"; preparedBy: string; requireSeparateApprover: boolean; inputs: CalculationInput[]; balances: BalanceBinding[] };
export type ApprovalReceipt = Readonly<{ companyId: string; payrollRunId: string; idempotencyKey: string; requestHash: string; approvedBy: string; approvedAt: string; settlements: readonly ApprovedSettlement[] }>;
export type ApprovalBundle = { receipt: ApprovalReceipt; expectedRevision: number; sourceClaims: readonly { companyId: string; sourceId: string; payrollRunId: string; contractorId: string }[]; balanceEntries: readonly LedgerEntry[]; deductionClaims: readonly { companyId: string; contractorId: string; ruleId: string; occurrenceKey: string; payrollRunId: string }[]; auditEvents: readonly { action: string; companyId: string; actorId: string; payrollRunId: string; contractorId?: string; entryId?: string; occurredAt: string }[] };
export interface ApprovalTransaction {
  // Must lock run plus sources, effective rules and balance accounts, and read
  // approval/source history in the same transaction. Never return browser data.
  lockPayroll(companyId: string, payrollRunId: string): Promise<LockedPayroll | null>;
  findReceipt(companyId: string, idempotencyKey: string): Promise<ApprovalReceipt | null>;
  // Atomic compare-and-set status/revision, receipt, snapshots, source claims,
  // append-only balance entries and audits. Unique constraints MUST reject races.
  commitApproval(bundle: ApprovalBundle): Promise<void>;
}
export interface ApprovalRepository {
  transaction<T>(companyId: string, work: (transaction: ApprovalTransaction) => Promise<T>): Promise<T>;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}
function hashRequest(request: ApprovalRequest) {
  const reviews = Object.entries(request.reviewReasons).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([contractor, reasons]) => [contractor, Object.entries(reasons).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)]);
  return createHash("sha256").update(JSON.stringify([request.companyId, request.payrollRunId, request.expectedRevision, reviews])).digest("hex");
}
export async function approvePayroll(dependencies: { access: AccessDependencies; repository: ApprovalRepository; now: () => number }, opaqueSession: string, rawRequest: unknown): Promise<ApprovalReceipt> {
  const request = requestSchema.parse(rawRequest);
  // The company selector is untrusted until the server resolves membership.
  const access = await resolveCompanyAccess(dependencies.access, opaqueSession, request.companyId, dependencies.now());
  requirePermission(access, "payroll.approve", dependencies.now());
  const requestHash = hashRequest(request);
  return dependencies.repository.transaction(access.companyId, async transaction => {
    const run = await transaction.lockPayroll(access.companyId, request.payrollRunId);
    // Recheck session and membership after waiting for locks.
    const current = await resolveCompanyAccess(dependencies.access, opaqueSession, request.companyId, dependencies.now());
    if (current.userId !== access.userId) throw new PermissionDenied();
    requirePermission(current, "payroll.approve", dependencies.now());
    if (!run || run.companyId !== current.companyId || run.payrollRunId !== request.payrollRunId) throw new PermissionDenied();
    z.object({ companyId: id, payrollRunId: id, revision: z.number().int().safe().nonnegative(), preparedBy: id, requireSeparateApprover: z.boolean(), status: z.enum(["DRAFT", "REVIEW", "APPROVED", "PAID", "LOCKED", "CANCELLED", "REVERSED"]), inputs: z.array(z.unknown()), balances: z.array(z.unknown()) }).parse(run);
    const existing = await transaction.findReceipt(current.companyId, request.idempotencyKey);
    if (existing) {
      if (!["APPROVED", "PAID", "LOCKED"].includes(run.status) || existing.companyId !== current.companyId || existing.payrollRunId !== request.payrollRunId || existing.requestHash !== requestHash || existing.idempotencyKey !== request.idempotencyKey) throw new Error("This approval request key was already used for different payroll details.");
      return freeze(structuredClone(existing));
    }
    if (!["DRAFT", "REVIEW"].includes(run.status)) throw new Error("This payroll is no longer editable or has already been approved.");
    if (run.revision !== request.expectedRevision) throw new Error("Payroll changed since your review. Review the latest figures before approving.");
    if (run.requireSeparateApprover && run.preparedBy === current.userId) throw new Error("A different authorized person must approve this payroll.");
    if (!run.inputs.length) throw new Error("Add eligible contractors before approving payroll.");
    const now = dependencies.now(), approvedAt = new Date(now).toISOString();
    requirePermission(current, "payroll.approve", now);
    const contractorIds = new Set<string>(), claimed = new Set<string>(), usedBindings = new Set<BalanceBinding>(), usedAccounts = new Set<string>();
    const deductionClaims: ApprovalBundle["deductionClaims"][number][] = [];
    const settlements: ApprovedSettlement[] = [], balanceEntries: LedgerEntry[] = [], sourceClaims: ApprovalBundle["sourceClaims"][number][] = [], auditEvents: ApprovalBundle["auditEvents"][number][] = [];
    const inputDates = run.inputs[0].run;
    for (const raw of run.inputs) {
      const input = structuredClone(raw);
      if (input.run.companyId !== current.companyId || input.contractor.companyId !== current.companyId || input.run.id !== run.payrollRunId || input.run.status !== run.status || input.run.start !== inputDates.start || input.run.end !== inputDates.end || input.run.payPeriodId !== inputDates.payPeriodId || input.history?.some(item => item.companyId !== current.companyId)) throw new PermissionDenied();
      if (contractorIds.has(input.contractor.id)) throw new Error("A contractor appears more than once in payroll.");
      contractorIds.add(input.contractor.id);
      const bindings: BalanceBinding[] = [];
      input.deductionRules = input.deductionRules.map(rule => {
        if (!rule.active || rule.effectiveFrom > input.run.end || (rule.effectiveTo && rule.effectiveTo < input.run.start) || rule.contractorId !== input.contractor.id || (rule.calculationMethod !== "INSTALLMENT" && rule.frequency !== "UNTIL_BALANCE_PAID")) return rule;
        const matches = run.balances.filter(binding => binding.contractorId === input.contractor.id && binding.ruleId === rule.id);
        if (matches.length !== 1) throw new Error("A balance-based deduction needs one locked ledger account.");
        const binding = matches[0];
        if (binding.account.companyId !== current.companyId || binding.account.contractorId !== input.contractor.id || binding.account.type === "ESCROW") throw new PermissionDenied();
        if (usedAccounts.has(binding.account.id)) throw new Error("Multiple payroll deductions target the same balance account.");
        usedAccounts.add(binding.account.id); usedBindings.add(binding); bindings.push(binding);
        return { ...rule, remainingBalanceCents: ledgerBalance(current, binding.account, binding.history, now) };
      });
      const approved = prepareApproval(input, current.userId, approvedAt, request.reviewReasons[input.contractor.id] ?? {});
      settlements.push(approved.settlement);
      for (const line of approved.settlement.lines.filter(item => item.occurrenceKey)) {
        if (!line.ruleId) throw new Error("An automatic deduction occurrence is missing its rule.");
        if (deductionClaims.some(claim => claim.contractorId === input.contractor.id && claim.occurrenceKey === line.occurrenceKey)) throw new Error("A deduction occurrence appears more than once in payroll.");
        deductionClaims.push({ companyId: current.companyId, contractorId: input.contractor.id, ruleId: line.ruleId, occurrenceKey: line.occurrenceKey!, payrollRunId: run.payrollRunId });
      }
      for (const sourceId of approved.settlement.sourceIds) {
        if (claimed.has(sourceId)) throw new Error("An activity is assigned to more than one contractor in this payroll.");
        claimed.add(sourceId); sourceClaims.push({ companyId: current.companyId, sourceId, payrollRunId: run.payrollRunId, contractorId: input.contractor.id });
      }
      for (const binding of bindings) {
        const posting = prepareApprovedRecovery(current, binding.account, approved.settlement, binding.ruleId, binding.history, now);
        if (posting?.replayed) throw new Error("Balance recovery already exists without an approval receipt. Resolve this inconsistency.");
        if (posting) { balanceEntries.push(posting.entry); auditEvents.push({ action: "balance.posted", companyId: current.companyId, actorId: current.userId, payrollRunId: run.payrollRunId, contractorId: input.contractor.id, entryId: posting.entry.id, occurredAt: approvedAt }); }
      }
      auditEvents.push({ action: "payroll.approved", companyId: current.companyId, actorId: current.userId, payrollRunId: run.payrollRunId, contractorId: input.contractor.id, occurredAt: approvedAt });
    }
    if (usedBindings.size !== run.balances.length) throw new Error("Payroll has an unmatched balance account. Review its deduction mapping.");
    const receipt = freeze({ companyId: current.companyId, payrollRunId: run.payrollRunId, idempotencyKey: request.idempotencyKey, requestHash, approvedBy: current.userId, approvedAt, settlements });
    // Clock expiry while recalculating must fail before the first write.
    requirePermission(current, "payroll.approve", dependencies.now());
    await transaction.commitApproval(freeze({ receipt, expectedRevision: request.expectedRevision, sourceClaims, balanceEntries, deductionClaims, auditEvents }));
    return receipt;
  });
}
