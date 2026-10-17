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
