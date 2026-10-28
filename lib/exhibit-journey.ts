import { z } from "zod";
import { calculateGridRow, emptyGridRow } from "./payroll-grid.ts";
import type { GridRow } from "./payroll-grid.ts";
import { configureDemoAdvance, demoCents } from "./demo-payroll.ts";
import type { DemoApproval } from "./demo-payroll.ts";
import type { CalculationInput, PayrollRun } from "./settlements.ts";
const setup = z.object({ name: z.string().trim().min(1).max(120), address: z.string().trim().max(120).optional(), cityStateZip: z.string().trim().max(120).optional(), phone: z.string().trim().max(60).optional(), reference: z.string().trim().min(1).max(32), method: z.enum(["PERCENT_OF_ELIGIBLE_REVENUE", "PER_MILE", "FLAT_PER_PERIOD"]), rate: z.string(), insurance: z.string(), insuranceDescription: z.string().trim().max(128), advance: z.string(), installment: z.string() });
export type ExhibitSetup = z.infer<typeof setup>;
export function activateExhibitContractor(raw: ExhibitSetup, existing: CalculationInput[], run: PayrollRun, id: string, at: string) {
  const parsed = setup.safeParse(raw);
  if (!parsed.success) throw new Error("Check the contractor name, reference and agreement details.");
  const data = parsed.data;
  const row: GridRow = { ...emptyGridRow(id), name: data.name, reference: data.reference, method: data.method, rate: data.rate };
  let input = calculateGridRow(row, existing, at, run);
  input.contractor = { ...input.contractor, address: data.address, cityStateZip: data.cityStateZip, phone: data.phone };
  if (data.insurance && !/^0+(\.0{1,2})?$/.test(data.insurance)) {
    if (!data.insuranceDescription) throw new Error("Describe the recurring insurance deduction.");
    input.deductionRules.push({ id: `exhibit-insurance-${id}`, contractorId: id, active: true, effectiveFrom: run.start, effectiveTo: null, createdBy: "exhibit-specialist", createdAt: at, category: "INSURANCE", description: data.insuranceDescription, calculationMethod: "FIXED_AMOUNT", amountCents: demoCents(data.insurance), frequency: "EVERY_PAYROLL" });
  }
  if (data.advance || data.installment) input = configureDemoAdvance(input, data.advance, data.installment, at);
  return { row, input };
}
export function continueExhibit(inputs: CalculationInput[], rows: GridRow[], approval: DemoApproval, next: PayrollRun) {
  if (next.companyId !== approval.companyId || Date.parse(next.start) !== Date.parse(approval.end) + 86400000 || next.status !== "DRAFT") throw new Error("Choose the immediately following draft pay period.");
  if (!approval.snapshots.length || inputs.length !== approval.snapshots.length || rows.length !== inputs.length || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("Check the approved contractor list before continuing.");
  const nextInputs = approval.snapshots.map(snapshot => {
    const previous = inputs.find(input => input.contractor.id === snapshot.contractorId);
    if (!previous || !rows.some(row => row.id === snapshot.contractorId) || snapshot.payrollRunId !== approval.payrollRunId || snapshot.companyId !== next.companyId) throw new Error("The prior statement does not match this exhibit.");
    const history = [...(previous.history ?? []), snapshot];
    const rules = snapshot.calculationSnapshot.deductionRules.filter(rule => rule.frequency !== "MANUAL" && (rule.frequency !== "ONE_TIME" || rule.effectiveFrom > approval.end) && rule.percentageBase !== "SELECTED_LOAD_REVENUE").map(rule => {
      const balance = approval.balances.find(item => item.contractorId === snapshot.contractorId && item.ruleId === rule.id);
      return { ...rule, ...(balance ? { remainingBalanceCents: balance.remainingBalanceCents } : {}) };
    });
    return structuredClone({ run: next, contractor: snapshot.calculationSnapshot.contractor, compensationRules: snapshot.calculationSnapshot.compensationRules, deductionRules: rules, transactions: [], loads: [], history }) as CalculationInput;
  });
  return { inputs: nextInputs, rows: rows.map(row => ({ ...row, revenue: "0", miles: "0", charge: "0", reimbursement: "0" })), valid: true };
}
