import { z } from "zod";
import { contractorInputSchema } from "./contractors.ts";
import type { CalculationInput, PayrollRun } from "./settlements.ts";

export const draftContractorSchema = contractorInputSchema.extend({
  method: z.enum(["PERCENT_OF_ELIGIBLE_REVENUE", "PER_MILE", "FLAT_PER_PERIOD"]),
  rate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a rate with at most two decimal places."),
  deduction: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a deduction with at most two decimal places."),
}).strict();
function hundredths(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("This amount is too large.");
  return Number(result);
}
// Preview-only draft construction. Live writes require verified server access.
export function createDraftContractor(raw: unknown, existing: CalculationInput[], run: PayrollRun, identifier: string, now: string): CalculationInput {
  const data = draftContractorSchema.parse(raw);
  if (existing.some(input => input.contractor.contractorNumber.toUpperCase() === data.reference)) throw new Error("This contractor reference already exists. Use a unique reference.");
  const rate = hundredths(data.rate), deduction = hundredths(data.deduction);
  if (rate <= 0 || (data.method === "PERCENT_OF_ELIGIBLE_REVENUE" && rate > 10000)) throw new Error("Enter a positive pay rate; percentages cannot exceed 100%.");
  const effective = { contractorId: identifier, effectiveFrom: run.start, effectiveTo: null, active: true, createdBy: "preview-specialist", createdAt: now };
  return {
    run: { ...run },
    contractor: { id: identifier, companyId: run.companyId, contractorNumber: data.reference, displayName: data.name, status: "ACTIVE", paymentMethod: "PREVIEW_ONLY", effectiveStartDate: run.start, effectiveEndDate: null, createdAt: now, updatedAt: now },
    compensationRules: [{ ...effective, id: `${identifier}-pay`, method: data.method, ...(data.method === "PERCENT_OF_ELIGIBLE_REVENUE" ? { rateBasisPoints: rate } : data.method === "PER_MILE" ? { perMileCents: rate } : { flatAmountCents: rate }) }],
    deductionRules: deduction ? [{ ...effective, id: `${identifier}-deduction`, category: "OTHER", description: "Agreed deduction per payroll", calculationMethod: "FIXED_AMOUNT", amountCents: deduction, frequency: "EVERY_PAYROLL" }] : [],
    loads: [], transactions: [], history: [],
  };
}
export const previewRun: PayrollRun = { id: "PC-DEMO-001", companyId: "sample-northstar", payPeriodId: "sample-oct-05-18", start: "2026-10-05", end: "2026-10-18", status: "DRAFT" };
