import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftContractor, previewRun } from '../lib/draft-contractor.ts';
import { calculateContractorSettlement } from '../lib/settlements.ts';
const data = { name: 'Fictional Contractor', reference: 'pc-1', method: 'PERCENT_OF_ELIGIBLE_REVENUE', rate: '70', deduction: '25.50' };
const create = (values = data, existing = []) => createDraftContractor(values, existing, previewRun, 'test-id', '2026-10-05T12:00:00Z');
test('manual creation starts without invented work or copied deductions', () => {
  const draft = create();
  assert.equal(draft.contractor.contractorNumber, 'PC-1');
  assert.deepEqual(draft.loads, []);
  assert.deepEqual(draft.transactions, []);
  assert.equal(draft.deductionRules[0].amountCents, 2550);
  assert.equal(create({ ...data, deduction: '0' }).deductionRules.length, 0);
});
test('entered work calculates agreed pay and deductions without formulas', () => {
  const draft = create();
  draft.loads.push({ id: 'load-1', companyId: previewRun.companyId, contractorId: 'test-id', loadNumber: 'L1', proNumber: 'L1', date: previewRun.start, origin: 'Depot', destination: 'Destination', loadedMiles: 100, emptyMiles: 0, grossRevenueCents: 100000, status: 'ELIGIBLE' });
  const result = calculateContractorSettlement(draft);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.grossEarningsCents, 70000);
  assert.equal(result.netSettlementCents, 67450);
});
test('reject duplicate references and invalid financial input', () => {
  assert.throws(() => create({ ...data, reference: ' pc-1 ' }, [create()]), /already exists/);
  for (const values of [{ rate: '100.01' }, { rate: '0' }, { rate: '-1' }, { deduction: '-5' }, { deduction: '1.001' }, { rate: '999999999999999999999' }]) assert.throws(() => create({ ...data, ...values }));
});
test('per-mile and fixed-period rates convert exactly to cents', () => {
  assert.equal(create({ ...data, method: 'PER_MILE', rate: '2.35' }).compensationRules[0].perMileCents, 235);
  assert.equal(create({ ...data, method: 'FLAT_PER_PERIOD', rate: '1000.50' }).compensationRules[0].flatAmountCents, 100050);
});
