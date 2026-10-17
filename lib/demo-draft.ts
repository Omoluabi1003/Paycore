import { z } from "zod";
import { ContractorSchema, CompensationRuleSchema, DeductionRuleSchema, TransactionSchema, LoadSchema } from "./settlements.ts";
import type { CalculationInput, PayrollRun } from "./settlements.ts";
import type { DraftCorrection } from "./activity-register.ts";
import type { GridRow } from "./payroll-grid.ts";
const text = z.string().max(128);
const runSchema = z.object({ id: text, companyId: text, payPeriodId: text, start: text, end: text, status: z.enum(["DRAFT", "REVIEW"]) });
const integer = z.number().int().safe();
const historySchema = z.object({
  status: z.literal("APPROVED"), approvedAt: text, approvedBy: text, reviewReasons: z.record(z.string()), reversesPayrollRunId: text.optional(),
  contractorId: text, companyId: text, payrollRunId: text, payPeriodId: text, start: text, end: text, compensationMethod: text, compensationRateBasisPoints: integer.optional(),
  grossEligibleRevenueCents: integer, grossEarningsCents: integer, automaticDeductionsCents: integer, manualDeductionsCents: integer, reimbursementsCents: integer, adjustmentsCents: integer, netSettlementCents: integer,
  lines: z.array(z.object({ id: text, kind: z.enum(["EARNING", "DEDUCTION", "REIMBURSEMENT", "ADJUSTMENT"]), category: text, description: z.string().max(1000), amountCents: integer, origin: z.enum(["AUTOMATIC", "ENTERED"]), ruleId: text.optional(), sourceId: z.string().max(256).optional(), occurrenceKey: z.string().max(256).optional() })).max(10000),
  blockers: z.array(z.object({ code: text, message: z.string().max(1000) })).max(1000), warnings: z.array(z.object({ code: text, message: z.string().max(1000) })).max(1000), sourceIds: z.array(z.string().max(256)).max(10000),
  calculationSnapshot: z.object({ version: z.literal(1), contractor: ContractorSchema, compensationRules: z.array(CompensationRuleSchema).max(100), deductionRules: z.array(DeductionRuleSchema).max(100), transactions: z.array(TransactionSchema).max(10000), loads: z.array(LoadSchema).max(10000), fuelReconciliation: z.object({ expectedTotalCents: integer.nonnegative() }).optional() }),
});
const inputSchema = z.object({ run: runSchema, history: z.array(historySchema).max(1000).default([]), contractor: ContractorSchema, compensationRules: z.array(CompensationRuleSchema).max(100), deductionRules: z.array(DeductionRuleSchema).max(100), transactions: z.array(TransactionSchema).max(10000), loads: z.array(LoadSchema).max(10000), fuelReconciliation: z.object({ expectedTotalCents: z.number().int().safe().nonnegative() }).optional() });
const rowSchema = z.object({ id: text, name: text, reference: text, method: text, rate: text, revenue: text, miles: text, deduction: text, charge: text, reimbursement: text });
const schema = z.object({ version: z.literal(1), scope: z.string().max(1000), savedAt: z.string().datetime(), run: runSchema, inputs: z.array(inputSchema).max(1000), rows: z.array(rowSchema).max(1000), corrections: z.array(z.object({ sourceId: text, contractorId: text, reason: z.string().trim().min(1).max(240), at: z.string().datetime(), before: TransactionSchema, after: TransactionSchema })).max(10000).default([]) });
export type DemoDraft = { inputs: CalculationInput[]; rows: GridRow[]; corrections?: DraftCorrection[] };
export const draftKey = (scope: string, run: PayrollRun) => `paycore-demo-draft-v1:${encodeURIComponent(scope)}:${run.payPeriodId}`;
export function decodeDraft(value: string, scope: string, run: PayrollRun) {
  if (value.length > 2_000_000) throw new Error("This demo draft is too large to restore.");
  const result = schema.parse(JSON.parse(value));
  const sameRun = (candidate: PayrollRun) => ["id", "companyId", "payPeriodId", "start", "end"].every(key => candidate[key as keyof PayrollRun] === run[key as keyof PayrollRun]);
  if (result.scope !== scope || !sameRun(result.run)) throw new Error("This draft belongs to another workspace or pay period.");
  const ids = new Set(result.rows.map(row => row.id));
  if (ids.size !== result.rows.length || new Set(result.inputs.map(input => input.contractor.id)).size !== result.inputs.length) throw new Error("This draft contains repeated contractors.");
  for (const input of result.inputs) {
    if (!sameRun(input.run) || input.contractor.companyId !== run.companyId || !ids.has(input.contractor.id)) throw new Error("This draft contains mismatched records.");
    if (input.transactions.some(tx => tx.companyId !== run.companyId || tx.contractorId !== input.contractor.id || tx.payPeriodId !== run.payPeriodId) || input.loads.some(load => load.companyId !== run.companyId || load.contractorId !== input.contractor.id) || [...input.compensationRules, ...input.deductionRules].some(rule => rule.contractorId !== input.contractor.id)) throw new Error("This draft contains mismatched activity.");
  }
  for (const input of result.inputs) {
    const ids = new Set<string>();
    for (const snapshot of input.history) {
      const key = `${snapshot.companyId}:${snapshot.contractorId}:${snapshot.payrollRunId}`;
      if (ids.has(key) || snapshot.companyId !== run.companyId || snapshot.contractorId !== input.contractor.id || snapshot.end >= run.start || snapshot.calculationSnapshot.contractor.id !== snapshot.contractorId || snapshot.calculationSnapshot.contractor.companyId !== run.companyId) throw new Error("This draft contains mismatched exhibit history.");
      ids.add(key);
    }
  }
  for (const correction of result.corrections) {
    if (![correction.before, correction.after].every(tx => tx.id === correction.sourceId && tx.companyId === run.companyId && tx.contractorId === correction.contractorId && tx.payPeriodId === run.payPeriodId)) throw new Error("This draft contains mismatched correction evidence.");
  }
  return result;
}
export function encodeDraft(draft: DemoDraft, scope: string, run: PayrollRun, savedAt: string) {
  if (!["DRAFT", "REVIEW"].includes(run.status)) throw new Error("Only draft payroll can be saved here.");
  const value = JSON.stringify(schema.parse({ version: 1, scope, savedAt, run, inputs: draft.inputs, rows: draft.rows, corrections: draft.corrections ?? [] }));
  decodeDraft(value, scope, run);
  return value;
}
