import test from 'node:test';
import assert from 'node:assert/strict';
import { periodForDate, validateSchedule, dateInZone } from '../lib/pay-periods.ts';
import { calculateGridRow, emptyGridRow } from '../lib/payroll-grid.ts';
const schedule = { version: 1, start: '2026-10-05', end: '2026-10-18', timeZone: 'America/New_York' };
test('inclusive boundaries roll over without gaps and can skip multiple cycles', () => {
 assert.equal(periodForDate(schedule,'2026-10-18').start,'2026-10-05');
 const next = periodForDate(schedule,'2026-10-19');
 assert.equal(next.start,'2026-10-19'); assert.equal(next.end,'2026-11-01');
 assert.equal(periodForDate(schedule,'2026-11-02').start,'2026-11-02');
 assert.equal(periodForDate(schedule,'2026-10-01').start,'2026-10-05');
 assert.equal(periodForDate(schedule,'2027-01-01').end,'2027-01-10');
});
test('payroll-zone midnight determines rollover across daylight saving changes', () => {
 assert.equal(dateInZone(new Date('2026-10-19T03:59:59Z'),schedule.timeZone),'2026-10-18');
 assert.equal(dateInZone(new Date('2026-10-19T04:00:00Z'),schedule.timeZone),'2026-10-19');
 assert.equal(dateInZone(new Date('2026-11-02T04:59:59Z'),schedule.timeZone),'2026-11-01');
 assert.equal(dateInZone(new Date('2026-11-02T05:00:00Z'),schedule.timeZone),'2026-11-02');
});
test('calendar-day cycles handle leap days and year transitions', () => {
 const leap = { ...schedule, start: '2028-02-28', end: '2028-03-05' };
 assert.equal(periodForDate(leap,'2028-03-06').end,'2028-03-12');
 assert.equal(periodForDate({ ...schedule, start:'2026-12-28', end:'2027-01-03' },'2027-01-04').end,'2027-01-10');
});
test('invalid dates, reversed ranges, unsupported lengths and time zones fail', () => {
 for (const change of [{ start:'2026-02-30' },{ end:'2026-10-04' },{ end:'2026-12-01' },{ timeZone:'Invalid/Zone' },{ version:2 }]) assert.throws(()=>validateSchedule({...schedule,...change}));
 assert.throws(()=>validateSchedule(null));
});
test('selected period propagates to work, transactions and agreements without moving prior entries', () => {
 const row={ ...emptyGridRow('person-1'),name:'Fictional Person',reference:'PC-1',rate:'70',revenue:'100',charge:'10' };
 const firstRun=periodForDate(schedule,'2026-10-18');
 const prior=calculateGridRow(row,[],'2026-10-18T12:00:00Z',firstRun);
 const run=periodForDate(schedule,'2026-10-19');
 const next=calculateGridRow(row,[prior],'2026-10-19T12:00:00Z',run);
 assert.equal(next.run.payPeriodId,run.payPeriodId);
 assert.equal(next.loads.length,1);assert.equal(next.loads[0].date,'2026-10-19');
 assert.equal(next.transactions[0].payPeriodId,run.payPeriodId);
 assert.equal(next.compensationRules[0].effectiveFrom,'2026-10-19');
 assert.equal(prior.loads[0].date,'2026-10-05');
});
