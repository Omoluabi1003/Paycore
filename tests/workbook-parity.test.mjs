import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGridRow,emptyGridRow } from '../lib/payroll-grid.ts';
import { calculateContractorSettlement,prepareApproval,yearToDate } from '../lib/settlements.ts';
import { workbookStatement } from '../lib/workbook-statement.ts';
const at='2026-10-17T12:00:00Z';
const row={...emptyGridRow('synthetic-contractor'),name:'Synthetic Contractor',reference:'SYN-1',rate:'65',revenue:'0'};
function fixture(){
 const input=calculateGridRow(row,[],at);
 input.loads=[{...input.loads[0],id:'synthetic-load-a',loadNumber:'SYN-A',proNumber:'SYN-A',grossRevenueCents:120000},{...input.loads[0],id:'synthetic-load-b',loadNumber:'SYN-B',proNumber:'SYN-B',grossRevenueCents:80000}];
 const tx=(id,type,cents)=>({id,companyId:input.run.companyId,contractorId:input.contractor.id,payPeriodId:input.run.payPeriodId,transactionType:type,referenceNumber:id,transactionDate:input.run.start,description:`Synthetic ${id}`,amountCents:cents,miles:0,source:'MANUAL',enteredBy:'synthetic-specialist',createdAt:at});
 input.transactions=[tx('fuel-a','FUEL_DEDUCTION',15000),tx('fuel-b','FUEL_DEDUCTION',5000),tx('truck','TRUCK_REGISTRATION_DEDUCTION',1200),tx('trailer','TRAILER_REGISTRATION_DEDUCTION',800),tx('reimburse','REIMBURSEMENT',3000)];
 input.fuelReconciliation={expectedTotalCents:20000};
 input.deductionRules=[{id:'synthetic-factoring',contractorId:input.contractor.id,effectiveFrom:input.run.start,effectiveTo:null,active:true,createdBy:'synthetic-specialist',createdAt:at,category:'FACTORING',description:'Synthetic selected-load factoring',calculationMethod:'PERCENTAGE',rateBasisPoints:175,percentageBase:'SELECTED_LOAD_REVENUE',selectedLoadIds:['synthetic-load-a'],frequency:'EVERY_PAYROLL'}];
 return input;
}
test('synthetic workbook-equivalent loads, categorized deductions and net reconcile exactly',()=>{
 const input=fixture(),settlement=calculateContractorSettlement(input),view=workbookStatement(settlement);
 assert.deepEqual(settlement.blockers,[]);assert.equal(settlement.grossEligibleRevenueCents,200000);assert.equal(settlement.grossEarningsCents,130000);
 assert.equal(view.groups.find(group=>group.label==='Factoring').amountCents,2100);
 assert.equal(view.groups.find(group=>group.label==='Fuel').amountCents,20000);
 assert.equal(view.groups.find(group=>group.label==='Truck registration').amountCents,1200);
 assert.equal(view.groups.find(group=>group.label==='Trailer registration').amountCents,800);
 assert.equal(view.totalDeductionsCents,24100);assert.equal(view.netCents,108900);assert.equal(view.fuelMatches,true);
});
test('fuel details count once; mismatched source total blocks approval and is frozen in snapshot',()=>{
 const input=fixture();input.fuelReconciliation.expectedTotalCents=19000;
 const settlement=calculateContractorSettlement(input);assert.ok(settlement.blockers.some(issue=>issue.code==='FUEL_RECONCILIATION'));
 assert.equal(settlement.manualDeductionsCents,22000);assert.throws(()=>prepareApproval(input,'synthetic-approver',at,{}),/blocking/);
 input.fuelReconciliation.expectedTotalCents=20000;const approved=prepareApproval(input,'synthetic-approver',at,{}).settlement;
 assert.equal(approved.calculationSnapshot.fuelReconciliation.expectedTotalCents,20000);assert.equal(workbookStatement(approved).fuelDetailCents,20000);
});
test('selected-load factoring excludes other loads and never falls back to aggregate revenue',()=>{
 const input=fixture();input.loads[1].grossRevenueCents=900000;
 assert.equal(calculateContractorSettlement(input).automaticDeductionsCents,2100);
 for(const selection of [[],['missing'],['synthetic-load-a','synthetic-load-a']]){const invalid=fixture();invalid.deductionRules[0].selectedLoadIds=selection;assert.ok(calculateContractorSettlement(invalid).blockers.length);}
 const excluded=fixture();excluded.loads[0].status='EXCLUDED';assert.ok(calculateContractorSettlement(excluded).blockers.length);
 const ignored=fixture();ignored.deductionRules[0].percentageBase='ELIGIBLE_REVENUE';assert.ok(calculateContractorSettlement(ignored).blockers.some(issue=>issue.code==='RULE_CONFIGURATION'));
});
test('the selected factoring set can contain multiple explicit eligible loads',()=>{
 const input=fixture();input.deductionRules[0].selectedLoadIds=['synthetic-load-a','synthetic-load-b'];assert.equal(calculateContractorSettlement(input).automaticDeductionsCents,3500);
});
test('approved history supplies YTD; current draft does not change official totals',()=>{
 const prior=fixture();prior.run={...prior.run,id:'prior-run',payPeriodId:'prior-period',start:'2026-09-21',end:'2026-10-04'};
 prior.loads=prior.loads.map(load=>({...load,date:prior.run.start}));prior.transactions=prior.transactions.map(tx=>({...tx,transactionDate:prior.run.start,payPeriodId:prior.run.payPeriodId}));prior.deductionRules[0].effectiveFrom=prior.run.start;prior.compensationRules[0].effectiveFrom=prior.run.start;prior.contractor.effectiveStartDate=prior.run.start;
 const approved=prepareApproval(prior,'synthetic-approver',at,{}).settlement;
 const current=calculateContractorSettlement(fixture());const view=workbookStatement(current,[approved]);assert.equal(view.ytd.netCents,108900);assert.equal(view.ytd.earningsCents,130000);
 assert.deepEqual(view.ytd,yearToDate([approved],current.companyId,current.contractorId,current.end));
});
test('grid edits retain fuel reconciliation and selected factoring without double-copying charges',()=>{
 const input=fixture(),next=calculateGridRow({...row,revenue:'10'},[input],at);
 assert.equal(next.fuelReconciliation.expectedTotalCents,20000);assert.equal(next.deductionRules.filter(rule=>rule.category==='FACTORING').length,1);assert.equal(next.transactions.filter(tx=>tx.transactionType==='FUEL_DEDUCTION').length,2);
});
