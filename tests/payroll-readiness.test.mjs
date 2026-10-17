import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollReadiness } from '../lib/payroll-readiness.ts';
import { emptyGridRow,calculateGridRow } from '../lib/payroll-grid.ts';
import { previewRun } from '../lib/draft-contractor.ts';
import { simulateApproval } from '../lib/demo-payroll.ts';
const row=(id,rate='70')=>({...emptyGridRow(id),name:`Synthetic ${id}`,reference:id,rate,revenue:'1000'});
test('empty payroll reports zero readiness and no invented figures',()=>{
 const model=payrollReadiness([],[],previewRun,null);assert.equal(model.readiness,0);assert.equal(model.contractors.length,0);assert.equal(model.totals.net,0);
});
test('incomplete rows are blocked and excluded from projected money',()=>{
 const model=payrollReadiness([],[row('ONE'),emptyGridRow('TWO')],previewRun,null);
 assert.equal(model.ready,1);assert.equal(model.blocked,1);assert.equal(model.readiness,50);assert.equal(model.totals.net,70000);assert.equal(model.contractors[1].settlement,undefined);
});
test('contractor-specific rates drive total pay and warnings drive review status',()=>{
 const first=row('ONE','60'),second={...row('TWO','80'),charge:'900'};
 const model=payrollReadiness([],[first,second],previewRun,null);
 assert.equal(model.ready,1);assert.equal(model.review,1);assert.equal(model.totals.earnings,140000);assert.equal(model.totals.net,50000);
 assert.ok(model.contractors[1].issues.some(issue=>issue.code==='NEGATIVE_NET'));
});
test('duplicate references block each matching row',()=>{
 const a=row('ONE'),b={...row('TWO'),reference:'one'};
 const model=payrollReadiness([],[a,b],previewRun,null);assert.equal(model.blocked,2);assert.equal(model.totals.net,0);
});
test('approved demo summary reads frozen snapshot rather than changed row estimates',()=>{
 const a=row('ONE'),input=calculateGridRow(a,[],'2026-10-17T12:00:00Z');
 const demo=simulateApproval([input],{actor:'Synthetic Specialist',companyName:'Synthetic Company',at:'2026-10-17T12:00:00Z',reviewed:true,reviewReasons:{}});
 const model=payrollReadiness([input],[{...a,revenue:'9999'}],previewRun,demo);assert.equal(model.totals.net,70000);assert.equal(model.contractors[0].status,'APPROVED');assert.equal(model.readiness,100);
});
