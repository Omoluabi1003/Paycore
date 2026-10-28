import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateApproval, transitionDemo, configureDemoAdvance } from '../lib/demo-payroll.ts';
import { demoCsv, demoPdf, exactDollars } from '../lib/demo-exports.ts';
import { calculateGridRow, emptyGridRow } from '../lib/payroll-grid.ts';
import { calculateContractorSettlement } from '../lib/settlements.ts';
const at='2026-10-17T12:00:00Z';
const row={...emptyGridRow('contractor-a'),name:'Synthetic Person',reference:'SYN-1',rate:'70',revenue:'1000',deduction:'20',charge:'5',reimbursement:'10'};
const input=()=>calculateGridRow(row,[],at);
const options={actor:'Demo Specialist',companyName:'Synthetic Logistics',at,reviewed:true,reviewReasons:{'contractor-a':{POSSIBLE_DUPLICATE_DEDUCTION:'Verified the separate synthetic recurring and one-time charges'}}};
test('simulated approval snapshots entered totals and never mutates draft balance or source data',()=>{
 const draft=configureDemoAdvance(input(),'15.00','20.00',at),before=structuredClone(draft);
 const approved=simulateApproval([draft],options);
 assert.equal(approved.snapshots[0].netSettlementCents,67000);
 assert.equal(approved.balances[0].expectedBalanceCents,1500);assert.equal(approved.balances[0].remainingBalanceCents,0);
 assert.deepEqual(draft,before);assert.equal(Object.isFrozen(approved.snapshots[0].calculationSnapshot),true);
 draft.loads[0].grossRevenueCents=999999;
 assert.equal(approved.snapshots[0].grossEligibleRevenueCents,100000);
});
test('approval cannot bypass review, blockers, duplicate contractors or missing warning reasons',()=>{
 assert.throws(()=>simulateApproval([input()],{...options,reviewed:false}),/review/);
 assert.throws(()=>simulateApproval([],options));
 const missing=input();missing.compensationRules=[];assert.throws(()=>simulateApproval([missing],options),/blocking/);
 assert.throws(()=>simulateApproval([input(),input()],options),/exactly once/);
 const negative=input();negative.transactions.push({...negative.transactions[0],id:'large',referenceNumber:'large',amountCents:1000000});
 assert.throws(()=>simulateApproval([negative],{...options,reviewReasons:{}}),/review reason/);
 const reasons=Object.fromEntries(calculateContractorSettlement(negative).warnings.map(warning=>[warning.code,'Verified synthetic exhibit amount']));
 assert.doesNotThrow(()=>simulateApproval([negative],{...options,reviewReasons:{[negative.contractor.id]:reasons}}));
});
test('marking paid and locking retain financial snapshot and append explicit simulation events',()=>{
 const approved=simulateApproval([input()],options),paid=transitionDemo(approved,'MARK_PAID','Demo Specialist','2026-10-17T12:01:00Z'),locked=transitionDemo(paid,'LOCK','Demo Specialist','2026-10-17T12:02:00Z');
 assert.equal(approved.status,'APPROVED');assert.equal(paid.status,'PAID');assert.equal(locked.status,'LOCKED');assert.equal(locked.audit.length,3);
 assert.deepEqual(approved.snapshots,locked.snapshots);
 assert.throws(()=>transitionDemo(locked,'MARK_PAID','Demo Specialist','2026-10-17T12:03:00Z'),/locked/);
 assert.throws(()=>transitionDemo(paid,'MARK_PAID','Demo Specialist','2026-10-17T12:03:00Z'),/already/);
 assert.throws(()=>transitionDemo(approved,'LOCK','Demo Specialist','2026-10-16T12:03:00Z'),/event time/);
});
test('grid edits preserve configured demo advance and still update period totals',()=>{
 const draft=configureDemoAdvance(input(),'100','20',at);
 const edited=calculateGridRow({...row,revenue:'2000'},[draft],at);
 assert.equal(edited.deductionRules.filter(rule=>rule.category==='CASH_ADVANCE').length,1);
 assert.equal(calculateContractorSettlement(edited).netSettlementCents,136500);
 assert.throws(()=>configureDemoAdvance(draft,'1.001','2',at));
});
test('entered snapshot exports use actual dates, identity, totals and safe CSV cells',()=>{
 const draft=input();draft.contractor.displayName='=SUM(1,2)';draft.run={...draft.run,start:'2026-10-05',end:'2026-10-16'};
 const approved=simulateApproval([draft],{...options,companyName:'@Synthetic'}),csv=demoCsv(approved),pdf=new TextDecoder().decode(demoPdf(approved));
 assert.match(csv,/'=SUM\(1,2\)/);assert.match(csv,/'@Synthetic/);assert.match(csv,/DEMO APPROVED - NO REAL PAYMENT/);assert.match(csv,/2026-10-16/);
 assert.match(csv,/"68500","685.00"/);assert.match(pdf,/NET SETTLEMENT: USD 685.00/);assert.match(pdf,/2026-10-05 to 2026-10-16/);
 assert.doesNotMatch(pdf,/Avery|Jordan|October 5-18/);
 assert.match(pdf,/%PDF-1.4/);assert.match(pdf,/%%EOF/);
 const match=pdf.match(/startxref\n(\d+)/);assert.equal(pdf.slice(Number(match[1]),Number(match[1])+4),'xref');
});
test('long statements paginate without losing entered line items',()=>{
 const draft=input();for(let i=0;i<80;i++)draft.transactions.push({...draft.transactions[1],id:`reim-${i}`,referenceNumber:`reim-${i}`,description:`Synthetic reimbursement ${i}`,amountCents:100});
 const approved=simulateApproval([draft],options),pdf=new TextDecoder().decode(demoPdf(approved));
 assert.match(pdf,/Synthetic reimbursement 79/);assert.match(pdf,/\/Count [2-9]/);
 assert.equal(exactDollars(Number.MAX_SAFE_INTEGER),'90071992547409.91');assert.equal(exactDollars(-1),'-0.01');assert.throws(()=>exactDollars(0.1));
});
