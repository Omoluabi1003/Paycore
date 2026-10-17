import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateContractorSettlement as calculate, prepareApproval, yearToDate, roundRatio, deductionOccurrences } from '../lib/settlements.ts';
const run = { id: 'run', companyId: 'co', payPeriodId: 'period', start: '2026-10-05', end: '2026-10-18', status: 'DRAFT' };
const contractor = { id: 'a', companyId: 'co', contractorNumber: 'PC-A', displayName: 'Fictional A', status: 'ACTIVE', paymentMethod: 'CHECK', effectiveStartDate: '2026-01-01', effectiveEndDate: null, createdAt: 'fixture', updatedAt: 'fixture' };
const effective = { effectiveFrom: '2026-01-01', effectiveTo: null, active: true, createdBy: 'specialist', createdAt: 'fixture' };
const rule = { id: 'pay-a', contractorId: 'a', method: 'PERCENT_OF_ELIGIBLE_REVENUE', rateBasisPoints: 7200, ...effective };
const load = { id: 'load-a', companyId: 'co', contractorId: 'a', loadNumber: 'L-1', proNumber: 'P-1', date: '2026-10-06', origin: 'Sample origin', destination: 'Sample destination', loadedMiles: 100, emptyMiles: 20, grossRevenueCents: 100000, status: 'ELIGIBLE' };
const deduction = { id: 'insurance', contractorId: 'a', category: 'INSURANCE', description: 'Insurance', calculationMethod: 'FIXED_AMOUNT', amountCents: 2000, frequency: 'EVERY_PAYROLL', ...effective };
const input = (changes = {}) => ({ contractor, run, compensationRules: [rule], deductionRules: [], transactions: [], loads: [load], ...changes });
const tx = (transactionType, amountCents, extra = {}) => ({ id: 'tx', companyId: 'co', contractorId: 'a', payPeriodId: 'period', transactionType, referenceNumber: 'T-1', transactionDate: '2026-10-06', description: 'Sample activity', amountCents, miles: 0, source: 'MANUAL', enteredBy: 'specialist', createdAt: 'fixture', ...extra });
const approve = data => { const preview = calculate(data); return prepareApproval(data, 'specialist', '2026-10-19T12:00:00Z', Object.fromEntries(preview.warnings.map(w => [w.code, 'Checked against fictional source records.']))); };

test('identical revenue uses contractor-specific rates, with isolated changes', () => {
  const a = calculate(input());
  const bInput = input({ contractor: { ...contractor, id: 'b' }, compensationRules: [{ ...rule, id: 'pay-b', contractorId: 'b', rateBasisPoints: 6800 }], loads: [{ ...load, contractorId: 'b' }] });
  assert.equal(a.grossEarningsCents, 72000); assert.equal(calculate(bInput).grossEarningsCents, 68000);
  calculate(input({ compensationRules: [{ ...rule, rateBasisPoints: 8000 }] }));
  assert.equal(calculate(bInput).grossEarningsCents, 68000);
});
test('all supported compensation methods calculate independently', () => {
  for (const [method, fields, expected] of [['FLAT_PER_LOAD', { flatAmountCents: 5000 }, 5000], ['FLAT_PER_PERIOD', { flatAmountCents: 9000 }, 9000], ['PER_MILE', { perMileCents: 50 }, 6000], ['MANUAL_EARNINGS', {}, 0]]) {
    assert.equal(calculate(input({ compensationRules: [{ ...rule, method, ...fields }] })).grossEarningsCents, expected);
  }
  assert.equal(calculate(input({ compensationRules: [{ ...rule, method: 'OTHER_CONFIGURED_RULE' }] })).blockers[0].code, 'RULE_CONFIGURATION');
});
test('rounding is exact half away from zero and rejects unsafe results', () => {
  assert.equal(roundRatio(10050, 5700), 5729); assert.equal(roundRatio(-10050, 5700), -5729);
  assert.equal(roundRatio(10050, 250), 251); assert.throws(() => roundRatio(Number.MAX_SAFE_INTEGER, 10001), RangeError);
});
test('recurring insurance is automatic, explainable and deterministic', () => {
  const data = input({ deductionRules: [deduction] }); const result = calculate(data);
  assert.equal(result.automaticDeductionsCents, 2000);
  assert.equal(result.lines[1].ruleId, 'insurance'); assert.equal(result.lines[1].origin, 'AUTOMATIC');
  assert.deepEqual(result, calculate(data));
});
test('one-time deduction is suppressed after approved application', () => {
  const data = input({ deductionRules: [{ ...deduction, frequency: 'ONE_TIME' }] });
  const prior = approve(data).settlement;
  const next = calculate({ ...data, run: { ...run, id: 'next', payPeriodId: 'next', start: '2026-10-19', end: '2026-11-01' }, loads: [], history: [prior] });
  assert.equal(next.automaticDeductionsCents, 0); assert.deepEqual(next.blockers, []);
});
test('installments cap at remaining balance and drafts never consume it', () => {
  const d = { ...deduction, calculationMethod: 'INSTALLMENT', frequency: 'UNTIL_BALANCE_PAID', amountCents: 20000, remainingBalanceCents: 15000 };
  const data = input({ deductionRules: [d] }); const before = structuredClone(data);
  assert.equal(calculate(data).automaticDeductionsCents, 15000); assert.deepEqual(data, before);
  assert.equal(calculate(data).automaticDeductionsCents, 15000);
  const approved = approve(data); assert.equal(approved.balanceUpdates[0].remainingBalanceCents, 0); assert.equal(d.remainingBalanceCents, 15000);
  assert.equal(calculate(input({ deductionRules: [{ ...d, remainingBalanceCents: 0 }] })).automaticDeductionsCents, 0);
});
test('percentage, per-load and per-mile deductions use configured bases', () => {
  for (const [calculationMethod, extra, expected] of [['PERCENTAGE', { rateBasisPoints: 250, percentageBase: 'ELIGIBLE_REVENUE' }, 2500], ['PERCENTAGE', { rateBasisPoints: 250, percentageBase: 'GROSS_EARNINGS' }, 1800], ['PER_LOAD', { amountCents: 300 }, 300], ['PER_MILE', { amountCents: 3 }, 360]]) {
    assert.equal(calculate(input({ deductionRules: [{ ...deduction, calculationMethod, ...extra }] })).automaticDeductionsCents, expected);
  }
});
test('manual reimbursements, deductions, earnings and signed adjustments are lines', () => {
  const result = calculate(input({ transactions: [tx('REIMBURSEMENT', 1000), tx('FUEL_DEDUCTION', 2000, { id: 'fuel', referenceNumber: 'fuel' }), tx('ADJUSTMENT', -100, { id: 'adjust', referenceNumber: 'adjust' }), tx('OTHER_EARNING', 500, { id: 'earn', referenceNumber: 'earn' })] }));
  assert.equal(result.netSettlementCents, 71400); assert.equal(result.manualDeductionsCents, 2000); assert.equal(result.reimbursementsCents, 1000); assert.equal(result.lines.length, 5);
});
test('missing and conflicting rules block approval', () => {
  for (const compensationRules of [[], [rule, { ...rule, id: 'conflict' }]]) {
    const data = input({ compensationRules }); assert.ok(calculate(data).blockers.length); assert.throws(() => approve(data));
  }
});
test('negative net requires explicit review and cannot auto approve', () => {
  const data = input({ transactions: [tx('CASH_ADVANCE', 100000)] });
  assert.ok(calculate(data).warnings.some(w => w.code === 'NEGATIVE_NET'));
  assert.throws(() => prepareApproval(data, 'specialist', '2026-10-19T12:00:00Z', {}));
  assert.equal(approve(data).settlement.netSettlementCents, -28000);
});
test('duplicate and previously approved activity are detected', () => {
  assert.ok(calculate(input({ loads: [load, load] })).blockers.some(b => b.code === 'DUPLICATE_SOURCE'));
  assert.ok(calculate(input({ loads: [load, { ...load, id: 'copy' }] })).warnings.some(w => w.code === 'DUPLICATE_REFERENCE'));
  assert.ok(calculate(input({ history: [approve(input()).settlement] })).blockers.some(b => b.code === 'ALREADY_APPROVED'));
});
test('approved snapshot is detached, deeply frozen, and preserves historical rates and YTD', () => {
  const data = structuredClone(input()); const approved = approve(data).settlement;
  data.compensationRules[0].rateBasisPoints = 9000;
  assert.equal(approved.compensationRateBasisPoints, 7200); assert.equal(approved.grossEarningsCents, 72000);
  assert.throws(() => { approved.lines[0].amountCents = 1; }, TypeError);
  assert.deepEqual(yearToDate([approved], 'co', 'a', '2026-12-31'), { earningsCents: 72000, deductionsCents: 0, netCents: 72000 });
  assert.equal(yearToDate([{ ...approved, status: 'DRAFT' }], 'co', 'a', '2026-12-31').netCents, 0);
  assert.equal(yearToDate([approved], 'other', 'a', '2026-12-31').netCents, 0);
});
test('date-effective rates apply on earning dates', () => {
  const result = calculate(input({ compensationRules: [{ ...rule, effectiveTo: '2026-10-10' }, { ...rule, id: 'new', rateBasisPoints: 8000, effectiveFrom: '2026-10-11' }], loads: [load, { ...load, id: 'second', loadNumber: 'L-2', date: '2026-10-12' }] }));
  assert.equal(result.grossEarningsCents, 152000); assert.ok(result.warnings.some(w => w.code === 'RATE_CHANGED')); assert.deepEqual(result.blockers, []);
});
test('calendar frequencies use anchored dates and clamp monthly due dates', () => {
  assert.deepEqual(deductionOccurrences({ ...deduction, frequency: 'WEEKLY', effectiveFrom: '2026-10-05' }, run), ['insurance:due:2026-10-05', 'insurance:due:2026-10-12']);
  assert.deepEqual(deductionOccurrences({ ...deduction, frequency: 'BIWEEKLY', effectiveFrom: '2026-10-05' }, run), ['insurance:due:2026-10-05']);
  assert.deepEqual(deductionOccurrences({ ...deduction, frequency: 'MONTHLY', effectiveFrom: '2026-01-31' }, { ...run, start: '2026-02-01', end: '2026-02-28' }), ['insurance:due:2026-02-28']);
});
test('invalid assignment, period, financial amount and inconsistent rules fail closed', () => {
  for (const data of [input({ transactions: [tx('REIMBURSEMENT', 100, { contractorId: '' })] }), input({ loads: [{ ...load, grossRevenueCents: undefined }] }), input({ loads: [{ ...load, date: '2026-10-30' }] }), input({ deductionRules: [{ ...deduction, calculationMethod: 'PERCENTAGE' }] }), input({ run: { ...run, status: 'APPROVED' } })]) assert.ok(calculate(data).blockers.length);
});

test('approved reversal offsets YTD without mutating history or allowing duplicate reversals', async () => {
  const { prepareReversal } = await import('../lib/settlements.ts');
  const original = approve(input({ deductionRules: [deduction] })).settlement;
  const correctionRun = { ...run, id: 'reversal-run', payPeriodId: 'correction', start: '2026-10-19', end: '2026-11-01' };
  const reversed = prepareReversal(original, [original], correctionRun, 'specialist', '2026-11-02T12:00:00Z', 'Fictional source correction').settlement;
  assert.equal(original.netSettlementCents, 70000); assert.equal(reversed.netSettlementCents, -70000);
  assert.deepEqual(yearToDate([original, reversed], 'co', 'a', '2026-12-31'), { earningsCents: 0, deductionsCents: 0, netCents: 0 });
  assert.throws(() => prepareReversal(original, [original, reversed], correctionRun, 'specialist', '2026-11-02T12:00:00Z', 'Duplicate'));
});

test('unsafe totals and duplicate automatic rules block rather than approve partial calculations', () => {
  const tooLarge = input({ loads: [{ ...load, grossRevenueCents: Number.MAX_SAFE_INTEGER }, { ...load, id: 'second', loadNumber: 'L-2', grossRevenueCents: Number.MAX_SAFE_INTEGER }] });
  assert.ok(calculate(tooLarge).blockers.some(b => b.code === 'SAFE_INTEGER')); assert.throws(() => approve(tooLarge));
  assert.ok(calculate(input({ deductionRules: [deduction, deduction] })).blockers.some(b => b.code === 'DUPLICATE_RULE'));
});
test('multiple due installments in one draft cannot overdraw the balance', () => {
  const d = { ...deduction, calculationMethod: 'INSTALLMENT', frequency: 'WEEKLY', effectiveFrom: '2026-10-05', amountCents: 20000, remainingBalanceCents: 25000 };
  const data = input({ deductionRules: [d] });
  assert.equal(calculate(data).automaticDeductionsCents, 25000); assert.equal(approve(data).balanceUpdates[0].remainingBalanceCents, 0); assert.equal(d.remainingBalanceCents, 25000);
});

test('balance-limited percentage deductions cap at the outstanding balance and stop at zero', () => {
  const d = { ...deduction, calculationMethod: 'PERCENTAGE', frequency: 'UNTIL_BALANCE_PAID', rateBasisPoints: 5000, percentageBase: 'ELIGIBLE_REVENUE', remainingBalanceCents: 1200 };
  const data = input({ deductionRules: [d] });
  assert.equal(calculate(data).automaticDeductionsCents, 1200);
  assert.equal(approve(data).balanceUpdates[0].remainingBalanceCents, 0);
  assert.equal(d.remainingBalanceCents, 1200);
  assert.equal(calculate(input({ deductionRules: [{ ...d, remainingBalanceCents: 0 }] })).automaticDeductionsCents, 0);
  assert.ok(calculate(input({ deductionRules: [{ ...d, remainingBalanceCents: undefined }] })).blockers.some(b => b.code === 'RULE_CONFIGURATION'));
});
test('balance limits apply after calculating per-load and per-mile deductions', () => {
  const loads = [load, { ...load, id: 'second', loadNumber: 'L-2' }];
  for (const [calculationMethod, expected] of [['PER_LOAD', 600], ['PER_MILE', 1000]]) {
    const d = { ...deduction, calculationMethod, frequency: 'UNTIL_BALANCE_PAID', amountCents: 300, remainingBalanceCents: 1000 };
    assert.equal(calculate(input({ loads, deductionRules: [d] })).automaticDeductionsCents, expected);
    assert.equal(approve(input({ loads, deductionRules: [d] })).balanceUpdates[0].remainingBalanceCents, 1000 - expected);
  }
});
test('combined loaded and empty mileage overflow is a blocker, not an uncaught exception', () => {
  const data = input({ loads: [{ ...load, loadedMiles: Number.MAX_SAFE_INTEGER, emptyMiles: 1 }] });
  const result = calculate(data);
  assert.ok(result.blockers.some(b => b.code === 'SAFE_INTEGER'));
  assert.throws(() => approve(data), /Resolve blocking issues/);
});
test('draft history neither consumes sources nor suppresses one-time deductions', () => {
  const data = input({ deductionRules: [{ ...deduction, frequency: 'ONE_TIME' }] });
  const history = [{ ...approve(data).settlement, status: 'DRAFT' }];
  const result = calculate({ ...data, history });
  assert.deepEqual(result.blockers, []); assert.equal(result.automaticDeductionsCents, 2000);
});
test('supplemental earnings do not appear as duplicate entered deductions', () => {
  const result = calculate(input({ transactions: [tx('OTHER_EARNING', 100)], deductionRules: [{ ...deduction, category: 'OTHER' }] }));
  assert.ok(!result.warnings.some(w => w.code === 'POSSIBLE_DUPLICATE_DEDUCTION'));
});
