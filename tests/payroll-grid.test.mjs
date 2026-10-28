import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGridRow, emptyGridRow, pasteGrid } from '../lib/payroll-grid.ts';
import { calculateContractorSettlement } from '../lib/settlements.ts';
const now = '2026-10-05T12:00:00Z';
const row = { ...emptyGridRow('person-1'), name: 'Fictional Person', reference: 'PC-1', rate: '70', revenue: '1000.50', deduction: '20', charge: '5', reimbursement: '10' };
test('grid calculates exact earnings, recurring and entered deductions, and net pay', () => {
 const result = calculateContractorSettlement(calculateGridRow(row, [], now));
 assert.equal(result.grossEarningsCents, 70035);
 assert.equal(result.netSettlementCents, 68535);
 assert.deepEqual(result.blockers, []);
});
test('editing replaces grid figures without duplicating activity and retains detailed entries', () => {
 const input = calculateGridRow(row, [], now);
 input.transactions.push({ ...input.transactions[0], id: 'detail-1', referenceNumber: 'detail-1', amountCents: 100 });
 const next = calculateGridRow({ ...row, charge: '0', revenue: '2000' }, [input], now);
 assert.equal(next.loads.length, 1);
 assert.equal(next.transactions.length, 2);
 assert.equal(next.transactions.find(tx => tx.id === 'detail-1').amountCents, 100);
 assert.equal(calculateContractorSettlement(next).netSettlementCents, 138900);
});
test('paste fills existing cells, leaves source untouched, and cannot create contractor rows', () => {
 const rows = [emptyGridRow('a'), emptyGridRow('b')];
 const result = pasteGrid(rows, 0, 0, 'Fictional One\tPC-1\r\nFictional Two\tPC-2\r\n');
 assert.equal(result[1].reference, 'PC-2');
 assert.equal(rows[0].name, '');
 assert.throws(() => pasteGrid(rows, 1, 0, 'One\nTwo'), /Add enough rows/);
 assert.throws(() => pasteGrid(rows, 0, 8, '10\t20'), /entry columns/);
});
test('invalid money, fractional miles and duplicate references cannot update payroll', () => {
 for (const changes of [{ revenue: '-1' }, { reimbursement: '1.001' }, { miles: '1.5' }, { rate: '101' }, { name: '' }]) assert.throws(() => calculateGridRow({ ...row, ...changes }, [], now));
 const prior = calculateGridRow(row, [], now);
 assert.throws(() => calculateGridRow({ ...row, id: 'person-2', reference: 'pc-1' }, [prior], now), /already exists/);
});

test('table edits preserve contractors added outside the table, including removing its last row', async () => {
 const { calculateGridRows } = await import('../lib/payroll-grid.ts');
 const guided = calculateGridRow({ ...row, id: 'guided-person', reference: 'GUIDED-1' }, [], now);
 const before = structuredClone(guided);
 const mixed = calculateGridRows([row], [], [guided], now);
 assert.equal(mixed.length, 2); assert.deepEqual(mixed[0], before);
 const removed = calculateGridRows([], [row], mixed, now);
 assert.deepEqual(removed, [before]); assert.deepEqual(guided, before);
});
test('table duplicate validation includes contractors entered through the guided form', async () => {
 const { calculateGridRows } = await import('../lib/payroll-grid.ts');
 const guided = calculateGridRow({ ...row, id: 'guided-person', reference: 'GUIDED-1' }, [], now);
 assert.throws(() => calculateGridRows([{ ...row, reference: 'guided-1' }], [], [guided], now), /already exists/);
});
test('table figure updates preserve separately configured automatic deductions', () => {
 const prior = calculateGridRow(row, [], now);
 prior.deductionRules.push({ ...prior.deductionRules[0], id: 'configured-insurance', category: 'INSURANCE', description: 'Specialist configured insurance', amountCents: 1000 });
 const next = calculateGridRow({ ...row, revenue: '2000' }, [prior], now);
 assert.equal(next.deductionRules.length, 2);
 assert.equal(next.deductionRules.find(rule => rule.id === 'configured-insurance').amountCents, 1000);
 assert.equal(calculateContractorSettlement(next).automaticDeductionsCents, 3000);
});
