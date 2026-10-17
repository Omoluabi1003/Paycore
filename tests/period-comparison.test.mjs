import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePeriods } from '../lib/period-comparison.ts';
import { activateExhibitContractor, continueExhibit } from '../lib/exhibit-journey.ts';
import { simulateApproval } from '../lib/demo-payroll.ts';
import { calculateGridRow } from '../lib/payroll-grid.ts';
import { calculateContractorSettlement, prepareApproval } from '../lib/settlements.ts';
import { correctDraftTransaction, duplicateReceiptIds } from '../lib/activity-register.ts';
import { payrollReadiness } from '../lib/payroll-readiness.ts';
import { nextPayPeriod,workingPeriod } from '../lib/pay-periods.ts';
const at='2026-10-17T12:00:00Z',schedule={version:1,start:'2026-10-05',end:'2026-10-16',timeZone:'UTC'},run=workingPeriod(schedule);
const options={actor:'Synthetic Specialist',companyName:'Synthetic Exhibit',at,reviewed:true,reviewReasons:{}};
function fixture(){const first=activateExhibitContractor({name:'Synthetic Contractor',reference:'SYN-1',method:'PERCENT_OF_ELIGIBLE_REVENUE',rate:'70',insurance:'25',insuranceDescription:'Synthetic insurance',advance:'150',installment:'100'},[],run,'synthetic',at);first.row.revenue='1000';first.input=calculateGridRow(first.row,[first.input],at,run);const approval=simulateApproval([first.input],options),nextRun=nextPayPeriod(schedule,run),next=continueExhibit([first.input],[first.row],approval,nextRun);next.rows[0].revenue='1000';next.inputs[0]=calculateGridRow(next.rows[0],next.inputs,at,nextRun);return {first,approval,next,nextRun};}
test('comparison explains capped advance delta from approved settlement lines',()=>{
 const {approval,next}=fixture(),current=calculateContractorSettlement(next.inputs[0]),before=JSON.stringify(approval);
 const comparison=comparePeriods(current,next.inputs[0].history);
 assert.equal(comparison.netChange,5000);assert.equal(comparison.rows.find(row=>row.label==='Deductions').change,-5000);
 assert.deepEqual(comparison.reasons,[{label:'Driver / contractor advance deductions',change:-5000,netEffect:5000}]);
 assert.equal(comparison.agreementChanged,false);assert.equal(comparePeriods({...current,end:'2026-11-01'},next.inputs[0].history).differentLength,true);assert.equal(JSON.stringify(approval),before);
});
test('independent earnings, fuel, reimbursements and agreement changes reconcile exactly to net delta',()=>{
 const {next,nextRun}=fixture();next.rows[0]={...next.rows[0],rate:'60',revenue:'1200',reimbursement:'10'};next.inputs[0]=calculateGridRow(next.rows[0],next.inputs,at,nextRun);
 const input=next.inputs[0];input.transactions.push({id:'sample-entry-fuel',companyId:run.companyId,contractorId:'synthetic',payPeriodId:nextRun.payPeriodId,transactionType:'FUEL_DEDUCTION',referenceNumber:'FUEL-A',transactionDate:nextRun.start,description:'Synthetic fuel purchase',amountCents:500,miles:0,source:'MANUAL',enteredBy:'synthetic-specialist',createdAt:at});
 const comparison=comparePeriods(calculateContractorSettlement(input),input.history);
 assert.equal(comparison.netChange,7500);assert.equal(comparison.agreementChanged,true);assert.equal(comparison.rows[0].change,20000);
 assert.equal(comparison.reasons.reduce((sum,item)=>sum+item.netEffect,0),comparison.netChange);assert.ok(comparison.reasons.some(item=>item.label==='Fuel deductions'&&item.netEffect===-500));
});
test('comparison uses only earlier approved same-company same-contractor non-reversed statements',()=>{
 const {next,approval}=fixture(),current=calculateContractorSettlement(next.inputs[0]),prior=approval.snapshots[0];
 assert.equal(comparePeriods(current,[]),null);
 assert.equal(comparePeriods(current,[{...prior,companyId:'other'},{...prior,contractorId:'other'},{...prior,status:'DRAFT'},{...prior,end:current.end}]),null);
 assert.equal(comparePeriods(current,[prior,{...prior,payrollRunId:'reversal',reversesPayrollRunId:prior.payrollRunId}]),null);
 assert.throws(()=>comparePeriods(current,[prior,{...prior,payrollRunId:'ambiguous'}]),/More than one/);
 assert.throws(()=>comparePeriods({...current,netSettlementCents:current.netSettlementCents+1},[prior]),/do not reconcile/);
});
test('fuel mismatch remains a specific blocker; correcting the source entry restores readiness without bypassing human review',()=>{
 const {first}=fixture(),input=first.input;input.deductionRules=[];
 const fuel=(id,amount)=>({id:'sample-entry-'+id,companyId:run.companyId,contractorId:'synthetic',payPeriodId:run.payPeriodId,transactionType:'FUEL_DEDUCTION',referenceNumber:id,transactionDate:run.start,description:'Synthetic '+id,amountCents:amount,miles:0,source:'MANUAL',enteredBy:'synthetic-specialist',createdAt:at});
 input.transactions=[fuel('fuel-a',15000),fuel('fuel-b',5000)];input.fuelReconciliation={expectedTotalCents:19000};
 const blocked=payrollReadiness([input],[first.row],run,null);assert.equal(blocked.readiness,0);assert.equal(blocked.contractors[0].issues[0].code,'FUEL_RECONCILIATION');assert.ok(blocked.contractors[0].input);assert.equal(blocked.totals.net,0);assert.throws(()=>calculateGridRow(first.row,[input],at,run),/Fuel-detail/);assert.throws(()=>prepareApproval(input,'synthetic-specialist',at,{}),/blocking/);
 const corrected=correctDraftTransaction([input],'synthetic','sample-entry-fuel-a',{description:'Synthetic corrected receipt',reference:'fuel-a',date:run.start,amount:'140',reason:'Verified the synthetic receipt total'},at);
 const ready=payrollReadiness(corrected.inputs,[first.row],run,null);assert.equal(ready.readiness,100);assert.equal(ready.totals.net,51000);assert.equal(corrected.inputs[0].fuelReconciliation.expectedTotalCents,19000);assert.equal(input.transactions[0].amountCents,15000);
 assert.throws(()=>simulateApproval(corrected.inputs,{...options,reviewed:false}),/review/);
});
test('duplicate receipt warning clears after a verified reference correction',()=>{
 const {first}=fixture();first.input.deductionRules=[];const tx={id:'sample-entry-a',companyId:run.companyId,contractorId:'synthetic',payPeriodId:run.payPeriodId,transactionType:'FUEL_DEDUCTION',referenceNumber:'SYN-A',transactionDate:run.start,description:'Synthetic purchase',amountCents:100,miles:0,source:'MANUAL',enteredBy:'synthetic-specialist',createdAt:at};first.input.transactions=[tx,{...tx,id:'sample-entry-b'}];
 assert.equal(payrollReadiness([first.input],[first.row],run,null).review,1);assert.equal(duplicateReceiptIds(first.input).size,2);
 const corrected=correctDraftTransaction([first.input],'synthetic','sample-entry-b',{description:'Synthetic second purchase',reference:'SYN-B',date:run.start,amount:'1',reason:'Receipt B had a copied reference'},at);
 assert.equal(payrollReadiness(corrected.inputs,[first.row],run,null).readiness,100);assert.equal(duplicateReceiptIds(corrected.inputs[0]).size,0);
});
