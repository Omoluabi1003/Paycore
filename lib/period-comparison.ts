import { safeCents } from "./settlements.ts";
import type { Settlement, History } from "./settlements.ts";
import { workbookStatement } from "./workbook-statement.ts";
export function comparePeriods(current: Settlement, history: History) {
  const scoped = history.filter(item => item.status === "APPROVED" && item.companyId === current.companyId && item.contractorId === current.contractorId && item.end < current.start);
  const reversed = new Set(scoped.flatMap(item => item.reversesPayrollRunId ? [item.reversesPayrollRunId] : []));
  const candidates = scoped.filter(item => !item.reversesPayrollRunId && !reversed.has(item.payrollRunId)).sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
  const previous = candidates[0];
  if (!previous) return null;
  if (candidates.some((item, index) => index > 0 && item.end === previous.end)) throw new Error("More than one previous statement matches. Review workspace history before comparing.");
  const delta = (after: number, before: number) => safeCents(BigInt(after) - BigInt(before));
  const deductions = (item: Settlement) => safeCents(BigInt(item.automaticDeductionsCents) + BigInt(item.manualDeductionsCents));
  const rows = [
    { label: "Eligible revenue", previous: previous.grossEligibleRevenueCents, current: current.grossEligibleRevenueCents },
    { label: "Calculated earnings", previous: previous.grossEarningsCents, current: current.grossEarningsCents },
    { label: "Deductions", previous: deductions(previous), current: deductions(current) },
    { label: "Reimbursements", previous: previous.reimbursementsCents, current: current.reimbursementsCents },
    { label: "Adjustments", previous: previous.adjustmentsCents, current: current.adjustmentsCents },
    { label: "Net settlement", previous: previous.netSettlementCents, current: current.netSettlementCents },
  ].map(row => ({ ...row, change: delta(row.current, row.previous) }));
  const beforeGroups = workbookStatement(previous).groups, afterGroups = workbookStatement(current).groups;
  const reasons = [
    { label: "Calculated earnings", change: delta(current.grossEarningsCents, previous.grossEarningsCents), netEffect: delta(current.grossEarningsCents, previous.grossEarningsCents) },
    ...afterGroups.map(group => { const change = delta(group.amountCents, beforeGroups.find(before => before.label === group.label)?.amountCents ?? 0); return { label: `${group.label} deductions`, change, netEffect: safeCents(-BigInt(change)) }; }),
    { label: "Reimbursements", change: delta(current.reimbursementsCents, previous.reimbursementsCents), netEffect: delta(current.reimbursementsCents, previous.reimbursementsCents) },
    { label: "Adjustments", change: delta(current.adjustmentsCents, previous.adjustmentsCents), netEffect: delta(current.adjustmentsCents, previous.adjustmentsCents) },
  ].filter(item => item.change !== 0);
  const netChange = delta(current.netSettlementCents, previous.netSettlementCents);
  if (safeCents(reasons.reduce((sum, reason) => sum + BigInt(reason.netEffect), BigInt(0))) !== netChange) throw new Error("The statement totals and settlement lines do not reconcile. Review the workspace before comparing.");
  const agreement = (statement: Settlement) => JSON.stringify(statement.calculationSnapshot.compensationRules.map(rule => ({ method: rule.method, basis: rule.rateBasisPoints, perMile: rule.perMileCents, fixed: rule.flatAmountCents })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  return { previous, rows, reasons, netChange, agreementChanged: agreement(previous) !== agreement(current), differentLength: Date.parse(previous.end) - Date.parse(previous.start) !== Date.parse(current.end) - Date.parse(current.start) };
}
