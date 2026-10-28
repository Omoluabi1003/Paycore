import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftContractor, createDraftDeduction, parseDecimalEntry, calculateContractorSettlement } from '../lib/settlements.ts';
const run = { id: 'preview-run', companyId: 'preview-company', payPeriodId: 'preview-period', start: '2026-10-05', end: '2026-10-18', status: 'DRAFT' };
const context = { run, id: 'entered-contractor', actorId: 'preview-specialist', createdAt: '2026-10-05T12:00:00Z' };
const entry = { name: 'Fictional Entry', reference: 'USER-01', method: 'PERCENT_OF_ELIGIBLE_REVENUE', rate: '67.25', effectiveFrom: run.start };
const create = (changes = {}) => createDraftContractor({ ...entry, ...changes }, context, []);
const ruleEntry = { category: 'INSURANCE', description: 'Fictional insurance', method: 'FIXED_AMOUNT', amount: '125.00', balance: '', frequency: 'EVERY_PAYROLL', effectiveFrom: run.start, effectiveTo: '' };
const deduction = (input, changes = {}) => createDraftDeduction({ ...ruleEntry, ...changes }, { input, id: 'entered-rule', actorId: context.actorId, createdAt: context.createdAt });

test('specialist-created contractors contain only entered terms and no seeded activity or deductions', () => {
  const input = create();
  assert.equal(input.contractor.displayName, 'Fictional Entry');
  assert.equal(input.contractor.contractorNumber, 'USER-01');
  assert.equal(input.compensationRules[0].rateBasisPoints, 6725);
  for (const key of ['loads', 'transactions', 'deductionRules', 'history']) assert.deepEqual(input[key], []);
  assert.equal(calculateContractorSettlement(input).netSettlementCents, 0);
});
test('different entered pay terms remain isolated and use exact cents', () => {
  for (const [method, rate, property, expected] of [['FLAT_PER_LOAD', '250.55', 'flatAmountCents', 25055], ['FLAT_PER_PERIOD', '1250.75', 'flatAmountCents', 125075], ['PER_MILE', '2.35', 'perMileCents', 235]]) {
    const input = create({ method, rate }); assert.equal(input.compensationRules[0][property], expected); assert.equal(input.compensationRules[0].rateBasisPoints, undefined);
  }
  assert.equal(create({ method: 'MANUAL_EARNINGS', rate: '' }).compensationRules[0].rateBasisPoints, undefined);
});
test('missing terms, invalid percentages and future effective dates are rejected', () => {
  for (const changes of [{ name: '' }, { reference: '' }, { method: '' }, { rate: '' }, { rate: '100.01' }, { rate: '72/100' }, { effectiveFrom: '2026-11-01' }]) assert.throws(() => create(changes));
});
test('duplicate contractor references are rejected without mutating existing inputs', () => {
  const first = create(), before = structuredClone(first);
  assert.throws(() => createDraftContractor({ ...entry, name: 'Another Fictional Person', reference: 'user-01' }, { ...context, id: 'another' }, [first]), /already in use/);
  assert.deepEqual(first, before);
});
test('number entry rejects formulas, silent rounding, negatives and unsafe cents', () => {
  assert.equal(parseDecimalEntry('1.01'), 101); assert.equal(parseDecimalEntry('57.25'), 5725); assert.equal(parseDecimalEntry('-1.01', true), -101);
  for (const invalid of ['=100*0.72', '12.345', '-12', '', 'NaN', 'Infinity', '1e4', '90071992547410']) assert.throws(() => parseDecimalEntry(invalid));
});
test('automatic deductions appear only after specialist configuration for that contractor', () => {
  const input = create({ method: 'FLAT_PER_PERIOD', rate: '1000' });
  assert.equal(calculateContractorSettlement(input).automaticDeductionsCents, 0);
  const configured = { ...input, deductionRules: [deduction(input)] };
  assert.equal(calculateContractorSettlement(configured).automaticDeductionsCents, 12500);
  assert.equal(calculateContractorSettlement(configured).netSettlementCents, 87500);
  assert.deepEqual(input.deductionRules, []);
});
test('specialist-configured percentage and installment deductions retain their own basis and balance', () => {
  const input = create({ method: 'FLAT_PER_PERIOD', rate: '1000' });
  const percentage = deduction(input, { method: 'PERCENTAGE', amount: '2.75', percentageBase: 'GROSS_EARNINGS' });
  assert.equal(percentage.rateBasisPoints, 275); assert.equal(calculateContractorSettlement({ ...input, deductionRules: [percentage] }).automaticDeductionsCents, 2750);
  const installment = deduction(input, { method: 'INSTALLMENT', amount: '200', balance: '125', category: 'CASH_ADVANCE' });
  assert.equal(installment.remainingBalanceCents, 12500); assert.equal(installment.frequency, 'UNTIL_BALANCE_PAID');
  assert.equal(calculateContractorSettlement({ ...input, deductionRules: [installment] }).automaticDeductionsCents, 12500); assert.equal(installment.remainingBalanceCents, 12500);
});
test('invalid and duplicate automatic deduction entries are rejected', () => {
  const input = create();
  for (const changes of [{ amount: '' }, { description: '' }, { method: 'PERCENTAGE', amount: '2.5', percentageBase: undefined }, { method: 'PERCENTAGE', amount: '101', percentageBase: 'GROSS_EARNINGS' }, { method: 'INSTALLMENT', amount: '0', balance: '100' }, { effectiveTo: '2026-10-01' }]) assert.throws(() => deduction(input, changes));
  const first = deduction(input);
  assert.throws(() => deduction({ ...input, deductionRules: [first] }), /already applies/);
});
