import { calculateContractorSettlement, yearToDate } from "./settlements";
import type { CalculationInput } from "./settlements";

// Public fictional fixtures only. Never substitute a live workbook or database.
const created = { createdBy: "sample-specialist", createdAt: "2026-10-01T12:00:00Z" };
const effective = { ...created, effectiveFrom: "2026-10-01", effectiveTo: null, active: true };
const run = { id: "PC-DEMO-001", companyId: "sample-northstar", payPeriodId: "sample-oct-05-18", start: "2026-10-05", end: "2026-10-18", status: "DRAFT" as const };
export const sampleCalculationInputs: CalculationInput[] = [
  { name: "Avery Mitchell", reference: "PC-001", revenue: 1845000, method: "PERCENT_OF_ELIGIBLE_REVENUE", rateBasisPoints: 7200 },
  { name: "Jordan Ellis", reference: "PC-002", revenue: 1536000, method: "PER_MILE", perMileCents: 235 },
  { name: "Morgan Taylor", reference: "PC-003", revenue: 1445000, method: "FLAT_PER_PERIOD", flatAmountCents: 1011500 },
].map((person, index): CalculationInput => ({
  run: { ...run },
  contractor: { id: person.reference, contractorNumber: person.reference, companyId: run.companyId, displayName: person.name, status: "ACTIVE", paymentMethod: "SAMPLE_CHECK", effectiveStartDate: "2026-01-01", effectiveEndDate: null, createdAt: created.createdAt, updatedAt: created.createdAt },
  compensationRules: [{ id: `comp-${person.reference}`, contractorId: person.reference, ...effective, method: person.method as "PERCENT_OF_ELIGIBLE_REVENUE" | "PER_MILE" | "FLAT_PER_PERIOD", rateBasisPoints: person.rateBasisPoints, perMileCents: person.perMileCents, flatAmountCents: person.flatAmountCents }],
  deductionRules: index === 0 ? [
    { id: "avery-insurance", contractorId: person.reference, ...effective, category: "INSURANCE", description: "Configured insurance for Avery", calculationMethod: "FIXED_AMOUNT", amountCents: 45000, frequency: "EVERY_PAYROLL" },
    { id: "avery-factoring", contractorId: person.reference, ...effective, category: "FACTORING", description: "Avery’s configured factoring charge", calculationMethod: "PERCENTAGE", rateBasisPoints: 250, percentageBase: "ELIGIBLE_REVENUE", frequency: "EVERY_PAYROLL" },
  ] : index === 1 ? [{ id: "jordan-advance", contractorId: person.reference, ...effective, category: "CASH_ADVANCE", description: "Advance repayment · balance $1,000.00", calculationMethod: "INSTALLMENT", amountCents: 20000, remainingBalanceCents: 100000, frequency: "UNTIL_BALANCE_PAID" }] : [],
  transactions: index === 2 ? [] : [{ id: `reimbursement-${index}`, companyId: run.companyId, contractorId: person.reference, payPeriodId: run.payPeriodId, transactionType: "REIMBURSEMENT", referenceNumber: `REIMB-${index}`, transactionDate: "2026-10-10", description: "Sample expense reimbursement", amountCents: index === 0 ? 12000 : 8500, miles: 0, source: "MANUAL", enteredBy: created.createdBy, createdAt: created.createdAt }],
  loads: [{ id: `load-${index}`, companyId: run.companyId, contractorId: person.reference, loadNumber: `SAMPLE-${index + 1}`, proNumber: `SAMPLE-PRO-${index + 1}`, date: "2026-10-10", origin: "Sample depot", destination: "Sample destination", loadedMiles: index === 1 ? 4300 : 3000, emptyMiles: 100, grossRevenueCents: person.revenue, status: "ELIGIBLE" }],
  history: [],
}));
export function sampleContractor(input: CalculationInput) {
  const detail = calculateContractorSettlement(input);
  const rule = input.compensationRules[0];
  const methodLabel = rule.method === "PERCENT_OF_ELIGIBLE_REVENUE" ? `${(rule.rateBasisPoints ?? 0) / 100}% of eligible revenue` : rule.method === "PER_MILE" ? `$${((rule.perMileCents ?? 0) / 100).toFixed(2)} per mile` : rule.method === "FLAT_PER_PERIOD" ? `$${((rule.flatAmountCents ?? 0) / 100).toFixed(2)} per period` : rule.method === "FLAT_PER_LOAD" ? `$${((rule.flatAmountCents ?? 0) / 100).toFixed(2)} per load` : rule.method === "MANUAL_EARNINGS" ? "Earnings entered each period" : rule.method.replaceAll("_", " ");
  return {
    effectiveFrom: rule.effectiveFrom,
    name: input.contractor.displayName, initials: input.contractor.displayName.split(" ").map(p => p[0]).join(""), reference: input.contractor.contractorNumber,
    gross: detail.grossEligibleRevenueCents / 100, rate: (rule.rateBasisPoints ?? 0) / 100, methodLabel,
    detail, ytd: yearToDate(input.history ?? [], input.run.companyId, input.contractor.id, input.run.end),
    settlement: { contractorEarnings: detail.grossEarningsCents / 100, factoringCharge: detail.lines.filter(l => l.category === "FACTORING").reduce((s, l) => s + l.amountCents, 0) / 100, totalDeductions: (detail.automaticDeductionsCents + detail.manualDeductionsCents) / 100, totalReimbursements: detail.reimbursementsCents / 100, netPay: detail.netSettlementCents / 100 },
  };
}
export const sampleContractors = sampleCalculationInputs.map(sampleContractor);
