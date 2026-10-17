import { TransactionSchema } from "./settlements.ts";
import type { CalculationInput, PayrollTransaction } from "./settlements.ts";
export type DraftCorrection = { sourceId: string; contractorId: string; reason: string; at: string; before: PayrollTransaction; after: PayrollTransaction };
export function correctDraftTransaction(inputs: CalculationInput[], contractorId: string, sourceId: string, values: { description: string; reference: string; date: string; amount: string; reason: string }, at: string) {
  const input = inputs.find(item => item.contractor.id === contractorId);
  const before = input?.transactions.find(tx => tx.id === sourceId);
  if (!input || !before || !sourceId.startsWith("sample-entry-") || !["DRAFT", "REVIEW"].includes(input.run.status) || input.history?.some(snapshot => snapshot.sourceIds.includes(`transaction:${sourceId}`))) throw new Error("Only an unapproved, individually entered draft transaction can be corrected here.");
  const reason = values.reason.trim();
  if (!reason || reason.length > 240) throw new Error("Explain the correction in 1–240 characters.");
  if (!/^-?\d+(\.\d{1,2})?$/.test(values.amount)) throw new Error("Enter an amount with up to two decimal places.");
  const negative = values.amount.startsWith("-"), [whole, fraction = ""] = values.amount.replace(/^-/, "").split(".");
  const cents = (BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"))) * (negative ? BigInt(-1) : BigInt(1));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents < BigInt(Number.MIN_SAFE_INTEGER) || (cents < BigInt(0) && before.transactionType !== "ADJUSTMENT")) throw new Error("Check the amount; only adjustments can be negative.");
  const after = TransactionSchema.parse({ ...before, description: values.description, referenceNumber: values.reference, transactionDate: values.date, amountCents: Number(cents) });
  if (after.transactionDate < input.run.start || after.transactionDate > input.run.end) throw new Error("Choose a date within this pay period.");
  return { inputs: inputs.map(item => item === input ? { ...item, transactions: item.transactions.map(tx => tx.id === sourceId ? after : tx) } : item), correction: { sourceId, contractorId, reason, at, before: structuredClone(before), after: structuredClone(after) } satisfies DraftCorrection };
}
