import test from 'node:test';import assert from 'node:assert/strict';
import {createFuelReceipt,fuelReceiptTotal} from '../lib/fuel-receipts.ts';
import {emptyGridRow,calculateGridRow} from '../lib/payroll-grid.ts';
import {calculateContractorSettlement,TransactionSchema} from '../lib/settlements.ts';
import {correctDraftTransaction,duplicateReceiptIds} from '../lib/activity-register.ts';
import {encodeDraft,decodeDraft} from '../lib/demo-draft.ts';
import {simulateApproval} from '../lib/demo-payroll.ts';
import {demoPdf} from '../lib/demo-exports.ts';
const at='2026-10-17T12:00:00Z';
function fixture(){const row={...emptyGridRow('synthetic-fuel'),name:'Synthetic Fuel Contractor',reference:'SYN-FUEL',rate:'70',revenue:'1000'};return {row,input:calculateGridRow(row,[],at)};}
const entry=input=>({date:input.run.start,documentNumber:'SYN-FUEL-1',description:'Fuel card ending 1234',place:'SYN Store',cityState:'Test, ZZ',amount:'75.25'});
const context={id:'receipt-1',actor:'Synthetic Specialist',at};
test('six receipt fields are recorded with exact cents and deduct once, including when a source total is checked',()=>{
 const {input}=fixture(),before=JSON.stringify(input);let updated=createFuelReceipt(input,entry(input),context);updated=createFuelReceipt(updated,{...entry(input),documentNumber:'SYN-FUEL-2',amount:'50.10'},{...context,id:'receipt-2'});
 assert.equal(JSON.stringify(input),before);assert.equal(updated.transactions[0].place,'SYN Store');assert.equal(updated.transactions[0].cityState,'Test, ZZ');assert.equal(fuelReceiptTotal(updated),12535);
 const result=calculateContractorSettlement(updated),checked=calculateContractorSettlement({...updated,fuelReconciliation:{expectedTotalCents:12535}});
 assert.deepEqual(checked.blockers,[]);assert.equal(result.manualDeductionsCents,12535);assert.equal(result.netSettlementCents,57465);assert.equal(checked.netSettlementCents,result.netSettlementCents);assert.equal(checked.lines.filter(line=>line.category==='FUEL_DEDUCTION').length,2);
 const mismatch=calculateContractorSettlement({...updated,fuelReconciliation:{expectedTotalCents:1}});assert.ok(mismatch.blockers.some(issue=>issue.code==='FUEL_RECONCILIATION'));assert.equal(mismatch.manualDeductionsCents,12535);
});
test('legacy receipts remain valid and duplicate document references remain visible for review',()=>{
 const {input}=fixture(),first=createFuelReceipt(input,entry(input),context),legacy=first.transactions[0];const {place,cityState,...old}=legacy;assert.equal(TransactionSchema.parse(old).place,undefined);
 const repeated=createFuelReceipt(first,entry(input),{...context,id:'receipt-2'});assert.deepEqual([...duplicateReceiptIds(repeated)].sort(),['sample-entry-receipt-1','sample-entry-receipt-2']);
});
test('receipt creation rejects missing data, invalid money/dates, duplicate identifiers and approved runs',()=>{
 const {input}=fixture();for(const field of ['date','documentNumber','description','place','cityState'])assert.throws(()=>createFuelReceipt(input,{...entry(input),[field]:''},context));
 for(const amount of ['0','-1','1.001','1e3','9007199254740999'])assert.throws(()=>createFuelReceipt(input,{...entry(input),amount},context));
 assert.throws(()=>createFuelReceipt(input,{...entry(input),date:'2020-01-01'},context),/pay period/);
 assert.throws(()=>fuelReceiptTotal({...input,transactions:[{transactionType:'FUEL_DEDUCTION',amountCents:Number.MAX_SAFE_INTEGER},{transactionType:'FUEL_DEDUCTION',amountCents:1}]}),/safe integer/);
 const updated=createFuelReceipt(input,entry(input),context);assert.throws(()=>createFuelReceipt(updated,entry(input),context),/already exists/);
 assert.throws(()=>createFuelReceipt({...input,run:{...input.run,status:'APPROVED'}},entry(input),context),/unapproved/);
});
test('receipt corrections preserve location evidence and require the existing reason and draft protections',()=>{
 const {input}=fixture(),updated=createFuelReceipt(input,entry(input),context),tx=updated.transactions[0];
 const values={description:tx.description,reference:tx.referenceNumber,date:tx.transactionDate,amount:'75.25',reason:'Store and location verified against the receipt',place:'Corrected Store',cityState:'Other, ZZ'};
 const corrected=correctDraftTransaction([updated],input.contractor.id,tx.id,values,at);
 assert.equal(corrected.correction.before.place,'SYN Store');assert.equal(corrected.correction.after.place,'Corrected Store');assert.equal(corrected.correction.after.cityState,'Other, ZZ');assert.equal(fuelReceiptTotal(corrected.inputs[0]),7525);assert.equal(updated.transactions[0].place,'SYN Store');
 assert.throws(()=>correctDraftTransaction([updated],input.contractor.id,tx.id,{...values,reason:''},at));
});
test('receipt locations survive saved drafts and approved PDF snapshots without later changes rewriting history',()=>{
 const {input,row}=fixture(),updated=createFuelReceipt(input,entry(input),context),scope='Synthetic receipt profile';
 const restored=decodeDraft(encodeDraft({inputs:[updated],rows:[row]},scope,input.run,at),scope,input.run).inputs[0];assert.equal(restored.transactions[0].cityState,'Test, ZZ');
 const approved=simulateApproval([restored],{actor:'Synthetic Specialist',companyName:'Synthetic Carrier',at,reviewed:true,reviewReasons:{}}),before=JSON.stringify(approved);
 const pdf=new TextDecoder().decode(demoPdf(approved));assert.ok(pdf.includes('SYN Store'));assert.ok(pdf.includes('Test, ZZ'));
 restored.transactions[0].place='Later Source Change';assert.equal(approved.snapshots[0].calculationSnapshot.transactions[0].place,'SYN Store');assert.equal(JSON.stringify(approved),before);
});
