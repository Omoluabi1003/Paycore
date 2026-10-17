import { z } from "zod";

const id = z.string().trim().min(1).max(128);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Enter a valid date.");
const integer = z.number().int().safe();
const cents = integer.nonnegative();
const bp = cents.max(10000);
const effective = { effectiveFrom: date, effectiveTo: date.nullable().default(null), active: z.boolean().default(true), createdBy: id, createdAt: id };
export const ContractorSchema = z.object({ id, companyId: id, contractorNumber: id, displayName: id, status: z.enum(["ACTIVE", "INACTIVE"]), paymentMethod: id, effectiveStartDate: date, effectiveEndDate: date.nullable(), createdAt: id, updatedAt: id });
export const CompensationRuleSchema = z.object({ id, contractorId: id, ...effective, method: z.enum(["PERCENT_OF_ELIGIBLE_REVENUE", "FLAT_PER_LOAD", "FLAT_PER_PERIOD", "PER_MILE", "MANUAL_EARNINGS", "OTHER_CONFIGURED_RULE"]), rateBasisPoints: bp.optional(), flatAmountCents: cents.optional(), perMileCents: cents.optional() });
export const DeductionRuleSchema = z.object({ id, contractorId: id, ...effective, category: z.enum(["FUEL", "INSURANCE", "CASH_ADVANCE", "ESCROW", "REGISTRATION", "TRUCK_REGISTRATION", "TRAILER_REGISTRATION", "IFTA", "MAINTENANCE", "FACTORING", "ADMIN_FEE", "OTHER"]), description: id, calculationMethod: z.enum(["FIXED_AMOUNT", "PERCENTAGE", "PER_LOAD", "PER_MILE", "INSTALLMENT", "MANUAL_AMOUNT"]), amountCents: cents.optional(), rateBasisPoints: bp.optional(), percentageBase: z.enum(["ELIGIBLE_REVENUE", "GROSS_EARNINGS", "SELECTED_LOAD_REVENUE"]).optional(), selectedLoadIds: z.array(id).min(1).max(10000).optional(), frequency: z.enum(["ONE_TIME", "EVERY_PAYROLL", "WEEKLY", "BIWEEKLY", "MONTHLY", "UNTIL_BALANCE_PAID", "MANUAL"]), remainingBalanceCents: cents.optional() });
export const TransactionSchema = z.object({ id, companyId: id, contractorId: id, payPeriodId: id, transactionType: z.enum(["LOAD_REVENUE", "OTHER_EARNING", "FUEL_DEDUCTION", "INSURANCE_DEDUCTION", "CASH_ADVANCE", "ESCROW_DEDUCTION", "REGISTRATION_DEDUCTION", "TRUCK_REGISTRATION_DEDUCTION", "TRAILER_REGISTRATION_DEDUCTION", "IFTA_DEDUCTION", "MAINTENANCE_DEDUCTION", "FACTORING_DEDUCTION", "REIMBURSEMENT", "ADJUSTMENT", "OTHER_DEDUCTION"]), referenceNumber: id, transactionDate: date, description: id, amountCents: integer, miles: cents.default(0), source: id, enteredBy: id, createdAt: id });
export const LoadSchema = z.object({ id, companyId: id, contractorId: id, loadNumber: id, proNumber: id, date, origin: id, destination: id, loadedMiles: cents, emptyMiles: cents, grossRevenueCents: cents, status: z.enum(["ELIGIBLE", "EXCLUDED"]) });
export type Contractor = z.infer<typeof ContractorSchema>;
export type CompensationRule = z.infer<typeof CompensationRuleSchema>;
export type DeductionRule = z.infer<typeof DeductionRuleSchema>;
export type PayrollTransaction = z.infer<typeof TransactionSchema>;
export type Load = z.infer<typeof LoadSchema>;
export type PayrollStatus = "DRAFT" | "REVIEW" | "APPROVED" | "PAID" | "LOCKED" | "CANCELLED" | "REVERSED";
export type PayrollRun = { id: string; companyId: string; payPeriodId: string; start: string; end: string; status: PayrollStatus };
export type SettlementLine = { id: string; kind: "EARNING" | "DEDUCTION" | "REIMBURSEMENT" | "ADJUSTMENT"; category: string; description: string; amountCents: number; origin: "AUTOMATIC" | "ENTERED"; ruleId?: string; sourceId?: string; occurrenceKey?: string };
export type Issue = { code: string; message: string };
export type Settlement = {
  contractorId: string; payrollRunId: string; companyId: string; payPeriodId: string; start: string; end: string;
  compensationMethod: string; compensationRateBasisPoints?: number;
  grossEligibleRevenueCents: number; grossEarningsCents: number; automaticDeductionsCents: number; manualDeductionsCents: number; reimbursementsCents: number; adjustmentsCents: number; netSettlementCents: number;
  lines: SettlementLine[]; blockers: Issue[]; warnings: Issue[]; sourceIds: string[];
  calculationSnapshot: { version: 1; fuelReconciliation?: { expectedTotalCents: number }; contractor: Contractor; compensationRules: CompensationRule[]; deductionRules: DeductionRule[]; transactions: PayrollTransaction[]; loads: Load[] };
};
export type ApprovedSettlement = Settlement & { status: "APPROVED"; approvedAt: string; approvedBy: string; reviewReasons: Record<string, string>; reversesPayrollRunId?: string };
export type History = readonly ApprovedSettlement[];
const zero = BigInt(0), one = BigInt(1), two = BigInt(2);
export function safeCents(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError("Settlement exceeds safe integer limits.");
  return Number(value);
}
// Half away from zero, including negative adjustments. Products never use Number arithmetic.
export function roundRatio(amount: number, numerator: number, denominator = 10000): number {
  [amount, numerator, denominator].forEach(v => integer.parse(v));
  if (denominator <= 0) throw new RangeError("A positive denominator is required.");
  const product = BigInt(amount) * BigInt(numerator), sign = product < zero ? -one : one;
  return safeCents(sign * ((product * sign * two + BigInt(denominator)) / (BigInt(denominator) * two)));
}
const sum = (values: number[]) => safeCents(values.reduce((total, v) => total + BigInt(v), zero));
const within = (on: string, from: string, to: string | null) => on >= from && (!to || on <= to);
const displayMoney = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
const earningDescription = (rule: CompensationRule, revenue: number, miles: number) => {
  if (rule.method === "PERCENT_OF_ELIGIBLE_REVENUE") return `${(rule.rateBasisPoints ?? 0) / 100}% of ${displayMoney(revenue)} eligible revenue, rounded to the nearest cent`;
  if (rule.method === "PER_MILE") return `${miles} miles at ${displayMoney(rule.perMileCents ?? 0)} per mile`;
  if (rule.method === "FLAT_PER_LOAD") return `${displayMoney(rule.flatAmountCents ?? 0)} agreed earnings for this load`;
  return "Revenue recorded; earnings entered separately under the manual agreement";
};
const normalized = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
const overlaps = (a: {effectiveFrom: string; effectiveTo: string | null}, b: {effectiveFrom: string; effectiveTo: string | null}, run: PayrollRun) => a.effectiveFrom <= (b.effectiveTo ?? run.end) && b.effectiveFrom <= (a.effectiveTo ?? run.end) && a.effectiveFrom <= run.end && b.effectiveFrom <= run.end && (a.effectiveTo ?? run.end) >= run.start && (b.effectiveTo ?? run.end) >= run.start;

// Calendar deductions use effectiveFrom as the anchor. Each due occurrence belongs
// to exactly one inclusive period; approved occurrence keys prevent double charges.
export function deductionOccurrences(rule: DeductionRule, run: PayrollRun): string[] {
  if (rule.frequency === "MANUAL") return [];
  const last = rule.effectiveTo && rule.effectiveTo < run.end ? rule.effectiveTo : run.end;
  if (rule.frequency === "EVERY_PAYROLL" || rule.frequency === "UNTIL_BALANCE_PAID") return rule.effectiveFrom <= last && (!rule.effectiveTo || rule.effectiveTo >= run.start) ? [`${rule.id}:period:${run.payPeriodId}`] : [];
  if (rule.frequency === "ONE_TIME") return rule.effectiveFrom <= last ? [`${rule.id}:once`] : [];
  const result: string[] = [];
  const anchor = new Date(`${rule.effectiveFrom}T00:00:00Z`);
  for (let index = 0; index < 12000; index++) {
    const due = new Date(anchor);
    if (rule.frequency === "MONTHLY") {
      due.setUTCDate(1); due.setUTCMonth(anchor.getUTCMonth() + index);
      const finalDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
      due.setUTCDate(Math.min(anchor.getUTCDate(), finalDay));
    } else due.setUTCDate(anchor.getUTCDate() + index * (rule.frequency === "WEEKLY" ? 7 : 14));
    const day = due.toISOString().slice(0, 10);
    if (day > last) return result;
    if (day >= run.start) result.push(`${rule.id}:due:${day}`);
  }
  throw new RangeError("Deduction schedule exceeds supported history range.");
}

export function calculateCompensation(rule: CompensationRule, revenueCents: number, loads: number, miles: number): number {
  switch (rule.method) {
    case "PERCENT_OF_ELIGIBLE_REVENUE": if (rule.rateBasisPoints === undefined) throw new Error("Missing compensation percentage."); return roundRatio(revenueCents, rule.rateBasisPoints);
    case "FLAT_PER_LOAD": if (rule.flatAmountCents === undefined) throw new Error("Missing amount per load."); return safeCents(BigInt(rule.flatAmountCents) * BigInt(loads));
    case "FLAT_PER_PERIOD": if (rule.flatAmountCents === undefined) throw new Error("Missing amount per period."); return rule.flatAmountCents;
    case "PER_MILE": if (rule.perMileCents === undefined) throw new Error("Missing amount per mile."); return safeCents(BigInt(rule.perMileCents) * BigInt(miles));
    case "MANUAL_EARNINGS": return 0;
    default: throw new Error("This configured compensation method needs a supported calculation before approval.");
  }
}
export function calculateDeduction(rule: DeductionRule, revenue: number, earnings: number, loads: number, miles: number): number {
  const balanceLimited = rule.calculationMethod === "INSTALLMENT" || rule.frequency === "UNTIL_BALANCE_PAID";
  if (rule.remainingBalanceCents !== undefined && !balanceLimited) throw new Error("A remaining balance requires an installment or until-balance-paid rule.");
  if (balanceLimited && rule.remainingBalanceCents === undefined) throw new Error("A balance-limited deduction needs its remaining balance.");
  let amount: number;
  if (rule.calculationMethod === "PERCENTAGE") {
    if (rule.rateBasisPoints === undefined || !rule.percentageBase) throw new Error("A percentage deduction needs its rate and calculation base.");
    amount = roundRatio(rule.percentageBase === "GROSS_EARNINGS" ? earnings : revenue, rule.rateBasisPoints);
  } else {
    if (rule.calculationMethod === "MANUAL_AMOUNT") throw new Error("Manual deductions must be entered as activity; set this rule to manual frequency.");
    if (rule.amountCents === undefined) throw new Error("A deduction amount is missing.");
    if (rule.calculationMethod === "INSTALLMENT" && rule.amountCents === 0) throw new Error("An installment needs a positive payment.");
    amount = rule.calculationMethod === "PER_LOAD" ? safeCents(BigInt(rule.amountCents) * BigInt(loads))
      : rule.calculationMethod === "PER_MILE" ? safeCents(BigInt(rule.amountCents) * BigInt(miles)) : rule.amountCents;
  }
  return balanceLimited ? Math.min(amount, rule.remainingBalanceCents!) : amount;
}

export type FuelReconciliation = { expectedTotalCents: number };
export type CalculationInput = { fuelReconciliation?: FuelReconciliation; contractor: Contractor; run: PayrollRun; compensationRules: CompensationRule[]; deductionRules: DeductionRule[]; transactions: PayrollTransaction[]; loads: Load[]; history?: History };
export function calculateContractorSettlement(input: CalculationInput): Settlement {
  const blockers: Issue[] = [], warnings: Issue[] = [], lines: SettlementLine[] = [];
  const block = (code: string, message: string) => blockers.push({ code, message });
  const warn = (code: string, message: string) => warnings.push({ code, message });
  const { run } = input;
  const contractor = ContractorSchema.parse(input.contractor);
  const history = input.history ?? [];
  if (!date.safeParse(run.start).success || !date.safeParse(run.end).success || run.start > run.end) block("PERIOD", "Choose a valid pay period.");
  if (!["DRAFT", "REVIEW"].includes(run.status)) block("IMMUTABLE", "Only draft payroll can be calculated. Use an adjustment or reversal for approved payroll.");
  if (contractor.companyId !== run.companyId || contractor.status !== "ACTIVE" || contractor.effectiveStartDate > run.end || (contractor.effectiveEndDate && contractor.effectiveEndDate < run.start)) block("CONTRACTOR", "This contractor is not eligible for this company and period.");
  function parseMany<T extends z.ZodTypeAny>(schema: T, items: unknown[], label: string): z.output<T>[] {
    return items.flatMap(item => { const parsed = schema.safeParse(item); if (!parsed.success) { block("INVALID_INPUT", `${label}: ${parsed.error.issues.map(i => `${i.path.join(" ")} ${i.message}`).join("; ")}`); return []; } return [parsed.data]; });
  }
  const rules = parseMany(CompensationRuleSchema, input.compensationRules, "Compensation rule").filter(r => r.contractorId === contractor.id && r.active);
  const deductions = parseMany(DeductionRuleSchema, input.deductionRules, "Deduction rule").filter(r => r.contractorId === contractor.id && r.active);
  const transactions = parseMany(TransactionSchema, input.transactions, "Activity");
  const allLoads = parseMany(LoadSchema, input.loads, "Load");
  const scoped = [...transactions, ...allLoads];
  for (const item of scoped) if (item.companyId !== run.companyId || item.contractorId !== contractor.id) block("ASSIGNMENT", "Every activity must belong to this contractor and company.");
  for (const rule of [...rules, ...deductions]) if (rule.effectiveTo && rule.effectiveFrom > rule.effectiveTo) block("RULE_DATES", "A rule ends before it starts.");
  for (const tx of transactions) {
    if (tx.payPeriodId !== run.payPeriodId || !within(tx.transactionDate, run.start, run.end)) block("ACTIVITY_PERIOD", "Activity must fall within the selected pay period.");
    if (tx.transactionType !== "ADJUSTMENT" && tx.amountCents < 0) block("AMOUNT", "Use a positive amount; choose adjustment for a signed correction.");
  }
  for (const load of allLoads) if (!within(load.date, run.start, run.end)) block("LOAD_PERIOD", "A load falls outside this pay period.");
  const loads = allLoads.filter(l => l.status === "ELIGIBLE");
  const sources = [...transactions.map(t => `transaction:${t.id}`), ...loads.map(l => `load:${l.id}`)];
  if (new Set(sources).size !== sources.length) block("DUPLICATE_SOURCE", "The same activity was included more than once.");
  const historical = history.filter(h => h.status === "APPROVED" && h.companyId === run.companyId);
  if (sources.some(source => historical.some(h => h.sourceIds.includes(source)))) block("ALREADY_APPROVED", "An activity is already in approved payroll. Use a correction instead.");
  if (historical.some(h => h.contractorId === contractor.id && h.start <= run.end && h.end >= run.start)) block("PERIOD_ALREADY_APPROVED", "This contractor already has approved payroll overlapping this period.");
  const refs = new Set<string>();
  for (const item of [...loads.map(l => ({ key: `load:${normalized(l.loadNumber)}` })), ...transactions.map(t => ({ key: `${t.transactionType === "LOAD_REVENUE" ? "load" : t.transactionType}:${normalized(t.referenceNumber)}` }))]) {
    if (refs.has(item.key)) warn("DUPLICATE_REFERENCE", "Possible duplicate load or activity reference. Resolve it before approval."); refs.add(item.key);
  }
  for (const load of loads) if (historical.some(h => h.calculationSnapshot.loads.some(prior => normalized(prior.loadNumber) === normalized(load.loadNumber)))) warn("HISTORICAL_LOAD_REFERENCE", "A load number matches approved history. Confirm it is new work before approval.");
  const activeRules = rules.filter(r => r.effectiveFrom <= run.end && (!r.effectiveTo || r.effectiveTo >= run.start));
  if (!activeRules.length) block("MISSING_RULE", "No effective compensation rule. Add the contractor’s agreed pay terms.");
  for (let i = 0; i < activeRules.length; i++) for (let j = i + 1; j < activeRules.length; j++) if (overlaps(activeRules[i], activeRules[j], run)) block("CONFLICTING_RULES", "Multiple compensation rules overlap. Resolve the effective dates.");
  if (activeRules.length > 1) warn("RATE_CHANGED", "Pay terms changed during this period. Review each effective rule.");
  if (activeRules.some(r => r.method === "FLAT_PER_PERIOD") && activeRules.length !== 1) block("PERIOD_RATE_CHANGE", "Split the payroll period at a flat-period rate change.");

  const add = (line: Omit<SettlementLine, "id">) => lines.push({ ...line, id: `line-${lines.length + 1}` });
  let eligible = 0;
  try {
    const revenue = [...loads.map(l => ({ id: `load:${l.id}`, date: l.date, amount: l.grossRevenueCents, miles: sum([l.loadedMiles, l.emptyMiles]), isLoad: true })), ...transactions.filter(t => t.transactionType === "LOAD_REVENUE").map(t => ({ id: `transaction:${t.id}`, date: t.transactionDate, amount: t.amountCents, miles: t.miles, isLoad: true }))];
    eligible = sum(revenue.map(r => r.amount));
    for (const item of revenue) {
      const matching = activeRules.filter(r => within(item.date, r.effectiveFrom, r.effectiveTo));
      if (matching.length !== 1) { block("EARNING_RULE", "Each earning date needs exactly one compensation rule."); continue; }
      const rule = matching[0];
      if (rule.method !== "FLAT_PER_PERIOD") add({ kind: "EARNING", category: rule.method, amountCents: calculateCompensation(rule, item.amount, 1, item.miles), description: earningDescription(rule, item.amount, item.miles), ruleId: rule.id, sourceId: item.id, origin: "AUTOMATIC" });
    }
    for (const rule of activeRules) {
      calculateCompensation(rule, 0, 0, 0); // Validate required configuration even with no loads.
      if (rule.method === "FLAT_PER_PERIOD") {
        if (!within(run.start, rule.effectiveFrom, rule.effectiveTo) || !within(run.end, rule.effectiveFrom, rule.effectiveTo)) block("PARTIAL_PERIOD", "A flat-period rule must cover the entire selected period.");
        add({ kind: "EARNING", category: rule.method, amountCents: rule.flatAmountCents!, description: "Configured earnings for this payroll period", ruleId: rule.id, origin: "AUTOMATIC" });
      }
      if (rule.method === "MANUAL_EARNINGS") warn("MANUAL_COMPENSATION", "Review the manually entered earnings against the contractor’s agreement.");
    }
    for (const tx of transactions.filter(t => t.transactionType !== "LOAD_REVENUE")) {
      if (tx.transactionType === "OTHER_EARNING") {
        if (activeRules.filter(r => within(tx.transactionDate, r.effectiveFrom, r.effectiveTo)).length !== 1) block("EARNING_RULE", "Entered earnings need exactly one effective compensation rule.");
        warn("MANUAL_COMPENSATION", "Review manually entered earnings against the contractor’s agreement.");
      }
      const kind = tx.transactionType === "OTHER_EARNING" ? "EARNING" : tx.transactionType === "REIMBURSEMENT" ? "REIMBURSEMENT" : tx.transactionType === "ADJUSTMENT" ? "ADJUSTMENT" : "DEDUCTION";
      add({ kind, category: tx.transactionType, amountCents: tx.amountCents, description: tx.description, sourceId: `transaction:${tx.id}`, origin: "ENTERED" });
    }
    const earnings = sum(lines.filter(l => l.kind === "EARNING").map(l => l.amountCents));
    const miles = sum(revenue.map(r => r.miles));
    const applied = new Set(historical.filter(h => h.contractorId === contractor.id).flatMap(h => h.lines.flatMap(l => l.occurrenceKey ? [l.occurrenceKey] : [])));
    const ruleIds = new Set<string>();
    for (const rule of deductions) {
      if (ruleIds.has(rule.id)) { block("DUPLICATE_RULE", "A deduction rule appears more than once."); continue; } ruleIds.add(rule.id);
      if (rule.effectiveFrom > run.end || (rule.effectiveTo && rule.effectiveTo < run.start)) continue;
      if (rule.frequency === "MANUAL") continue;
      let deductionRevenue = eligible;
      if (rule.percentageBase === "SELECTED_LOAD_REVENUE") {
        const selected = rule.selectedLoadIds;
        if (rule.category !== "FACTORING" || rule.calculationMethod !== "PERCENTAGE" || !selected?.length || new Set(selected).size !== selected.length || selected.some(id => !loads.some(load => load.id === id))) throw new Error("Factoring needs a unique selection of eligible loads assigned to this contractor and period.");
        deductionRevenue = sum(loads.filter(load => selected.includes(load.id)).map(load => load.grossRevenueCents));
      } else if (rule.selectedLoadIds?.length) throw new Error("Selected loads require the selected-load factoring calculation base.");
      let balance = rule.remainingBalanceCents;
      for (const key of deductionOccurrences(rule, run).filter(k => !applied.has(k))) {
        const amount = calculateDeduction({ ...rule, remainingBalanceCents: balance }, deductionRevenue, earnings, revenue.length, miles);
        if (balance !== undefined && (rule.calculationMethod === "INSTALLMENT" || rule.frequency === "UNTIL_BALANCE_PAID")) balance -= amount;
        if (amount === 0) continue;
        add({ kind: "DEDUCTION", category: rule.category, amountCents: amount, description: `${rule.description} · ${rule.frequency.replaceAll("_", " ").toLowerCase()} · ${rule.calculationMethod.replaceAll("_", " ").toLowerCase()}${rule.rateBasisPoints !== undefined ? ` · ${rule.rateBasisPoints / 100}% of ${rule.percentageBase === "SELECTED_LOAD_REVENUE" ? "selected eligible load revenue" : rule.percentageBase === "ELIGIBLE_REVENUE" ? "eligible revenue" : "contractor earnings"}` : ""}`, ruleId: rule.id, occurrenceKey: key, origin: "AUTOMATIC" });
        if (transactions.some(t => (t.transactionType.endsWith("_DEDUCTION") || t.transactionType === "CASH_ADVANCE") && t.transactionType.includes(rule.category))) warn("POSSIBLE_DUPLICATE_DEDUCTION", "An entered deduction has the same category as an automatic deduction. Review both.");
      }
    }
  } catch (error) { block(error instanceof RangeError ? "SAFE_INTEGER" : "RULE_CONFIGURATION", error instanceof Error ? error.message : "Invalid payroll rule."); }
  let grossEarningsCents = 0, automaticDeductionsCents = 0, manualDeductionsCents = 0, reimbursementsCents = 0, adjustmentsCents = 0, netSettlementCents = 0;
  try {
    if (input.fuelReconciliation !== undefined) {
      const check = z.object({ expectedTotalCents: cents }).strict().safeParse(input.fuelReconciliation);
      if (!check.success) block("FUEL_RECONCILIATION_INPUT", "Enter a valid expected fuel-detail total.");
      else if (check.data.expectedTotalCents !== sum(transactions.filter(tx => tx.transactionType === "FUEL_DEDUCTION").map(tx => tx.amountCents))) block("FUEL_RECONCILIATION", "Fuel-detail entries do not match the expected fuel total. Check the receipts before approval.");
    }
    grossEarningsCents = sum(lines.filter(l => l.kind === "EARNING").map(l => l.amountCents));
    automaticDeductionsCents = sum(lines.filter(l => l.kind === "DEDUCTION" && l.origin === "AUTOMATIC").map(l => l.amountCents));
    manualDeductionsCents = sum(lines.filter(l => l.kind === "DEDUCTION" && l.origin === "ENTERED").map(l => l.amountCents));
    reimbursementsCents = sum(lines.filter(l => l.kind === "REIMBURSEMENT").map(l => l.amountCents));
    adjustmentsCents = sum(lines.filter(l => l.kind === "ADJUSTMENT").map(l => l.amountCents));
    netSettlementCents = sum([grossEarningsCents, -automaticDeductionsCents, -manualDeductionsCents, reimbursementsCents, adjustmentsCents]);
    if (netSettlementCents < 0) warn("NEGATIVE_NET", "Net settlement is negative. Review deductions before approval.");
    if (BigInt(automaticDeductionsCents) + BigInt(manualDeductionsCents) > BigInt(grossEarningsCents) / two) warn("LARGE_DEDUCTION", "Deductions exceed half of earnings. Review the amounts.");
    const recent = historical.filter(h => h.contractorId === contractor.id && !h.reversesPayrollRunId).sort((a, b) => b.end.localeCompare(a.end))[0];
    if (recent && recent.netSettlementCents > 0 && (BigInt(netSettlementCents) > BigInt(recent.netSettlementCents) * two || BigInt(netSettlementCents) * two < BigInt(recent.netSettlementCents))) warn("VARIANCE", "This settlement differs substantially from the latest approved settlement.");
  } catch { block("SAFE_INTEGER", "Settlement exceeds safe integer limits."); }
  return { contractorId: contractor.id, companyId: run.companyId, payrollRunId: run.id, payPeriodId: run.payPeriodId, start: run.start, end: run.end, compensationMethod: activeRules.length === 1 ? activeRules[0].method : "MULTIPLE_EFFECTIVE_RULES", compensationRateBasisPoints: activeRules.length === 1 ? activeRules[0].rateBasisPoints : undefined, grossEligibleRevenueCents: eligible, grossEarningsCents, automaticDeductionsCents, manualDeductionsCents, reimbursementsCents, adjustmentsCents, netSettlementCents, lines, blockers, warnings, sourceIds: sources, calculationSnapshot: structuredClone({ version: 1, ...(input.fuelReconciliation !== undefined ? { fuelReconciliation: input.fuelReconciliation } : {}), contractor, compensationRules: rules, deductionRules: deductions, transactions, loads: allLoads }) };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}
// Domain transition only: never called by the public preview. A future server must
// resolve actor identity, lock source/rule rows, recalculate, then persist atomically.
export function prepareApproval(input: CalculationInput, actor: string, approvedAt: string, reviewReasons: Record<string, string>) {
  id.parse(actor); z.string().datetime().parse(approvedAt);
  const settlement = calculateContractorSettlement(input);
  if (settlement.blockers.length) throw new Error("Resolve blocking issues before approval.");
  for (const warning of settlement.warnings) if (!reviewReasons[warning.code]?.trim()) throw new Error(`Record a review reason for ${warning.code}.`);
  const approved: ApprovedSettlement = { ...settlement, status: "APPROVED", approvedBy: actor, approvedAt, reviewReasons: structuredClone(reviewReasons) };
  const balanceUpdates = input.deductionRules.filter(r => r.contractorId === input.contractor.id && r.active && r.remainingBalanceCents !== undefined && (r.calculationMethod === "INSTALLMENT" || r.frequency === "UNTIL_BALANCE_PAID")).map(rule => ({ ruleId: rule.id, expectedBalanceCents: rule.remainingBalanceCents!, remainingBalanceCents: sum([rule.remainingBalanceCents!, -sum(settlement.lines.filter(l => l.ruleId === rule.id && l.kind === "DEDUCTION").map(l => l.amountCents))]) }));
  return freeze({ settlement: structuredClone(approved), balanceUpdates, audit: { action: "payroll.approved", actorId: actor, payrollRunId: input.run.id, contractorId: input.contractor.id, occurredAt: approvedAt } });
}
export function yearToDate(history: History, companyId: string, contractorId: string, asOf: string) {
  date.parse(asOf);
  const selected = history.filter(h => h.status === "APPROVED" && h.companyId === companyId && h.contractorId === contractorId && h.end.slice(0, 4) === asOf.slice(0, 4) && h.end <= asOf);
  return { earningsCents: sum(selected.map(h => h.grossEarningsCents)), deductionsCents: sum(selected.flatMap(h => [h.automaticDeductionsCents, h.manualDeductionsCents])), netCents: sum(selected.map(h => h.netSettlementCents)) };
}

// Append a signed, approved correction. The original snapshot is never edited.
// Persist reversal + audit atomically and enforce a unique reversal target in DB.
export function prepareReversal(original: ApprovedSettlement, history: History, run: PayrollRun, actor: string, at: string, reason: string) {
  id.parse(actor); id.parse(reason); z.string().datetime().parse(at); date.parse(run.start); date.parse(run.end);
  if (original.status !== "APPROVED" || original.reversesPayrollRunId || run.companyId !== original.companyId || run.id === original.payrollRunId || run.start > run.end || !["DRAFT", "REVIEW"].includes(run.status)) throw new Error("Choose an original approved settlement and a new correction run in the same company.");
  if (history.some(h => h.companyId === original.companyId && h.contractorId === original.contractorId && h.reversesPayrollRunId === original.payrollRunId)) throw new Error("This settlement was already reversed.");
  const reversal: ApprovedSettlement = {
    ...structuredClone(original), payrollRunId: run.id, payPeriodId: run.payPeriodId, start: run.start, end: run.end,
    compensationMethod: "REVERSAL", compensationRateBasisPoints: undefined,
    grossEligibleRevenueCents: -original.grossEligibleRevenueCents, grossEarningsCents: -original.grossEarningsCents,
    automaticDeductionsCents: -original.automaticDeductionsCents, manualDeductionsCents: -original.manualDeductionsCents,
    reimbursementsCents: -original.reimbursementsCents, adjustmentsCents: -original.adjustmentsCents, netSettlementCents: -original.netSettlementCents,
    lines: original.lines.map(line => ({ ...line, id: `reversal-${line.id}`, amountCents: -line.amountCents, occurrenceKey: undefined, description: `Reversal: ${line.description} · ${reason}` })),
    sourceIds: [], blockers: [], warnings: [], approvedAt: at, approvedBy: actor, reviewReasons: { REVERSAL: reason }, reversesPayrollRunId: original.payrollRunId,
  };
  return freeze({ settlement: reversal, audit: { action: "payroll.reversed", actorId: actor, payrollRunId: run.id, originalPayrollRunId: original.payrollRunId, contractorId: original.contractorId, reason, occurredAt: at } });
}
