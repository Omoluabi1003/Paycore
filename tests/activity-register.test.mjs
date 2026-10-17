import test from 'node:test';
import assert from 'node:assert/strict';
import { correctDraftTransaction } from '../lib/activity-register.ts';
import { encodeDraft, decodeDraft, draftKey } from '../lib/demo-draft.ts';
import { calculateGridRow, emptyGridRow } from '../lib/payroll-grid.ts';
import { calculateContractorSettlement } from '../lib/settlements.ts';
const at='2026-10-17T12:00:00Z';
function fixture(){
 const row={...emptyGridRow('synthetic'),name:'Synthetic Person',reference:'SYN-1',rate:'70',revenue:'1000'};
 const input=calculateGridRow(row,[],at);
 input.transactions.push({id:'sample-entry-fuel',companyId:input.run.companyId,contractorId:input.contractor.id,payPeriodId:input.run.payPeriodId,transactionType:'FUEL_DEDUCTION',referenceNumber:'SYN-FUEL',description:'Synthetic fuel stop',transactionDate:input.run.start,amountCents:10000,miles:0,source:'MANUAL',enteredBy:'synthetic-specialist',createdAt:at});
 return {rows:[row],inputs:[input],run:input.run};
}
const values={description:'Corrected synthetic fuel stop',reference:'SYN-FUEL',date:'2026-10-05',amount:'125.25',reason:'Receipt total verified'};
test('draft correction recalculates exact cents, preserves original evidence and leaves source unchanged',()=>{
 const {inputs}=fixture();const before=calculateContractorSettlement(inputs[0]);
 const result=correctDraftTransaction(inputs,'synthetic','sample-entry-fuel',{...values,date:inputs[0].run.start},at);
 assert.equal(inputs[0].transactions[0].amountCents,10000);assert.equal(result.correction.before.amountCents,10000);assert.equal(result.correction.after.amountCents,12525);
 assert.equal(result.correction.reason,values.reason);assert.equal(calculateContractorSettlement(result.inputs[0]).netSettlementCents,before.netSettlementCents-2525);
});
test('correction rejects missing reason, unsafe money, out-of-period dates, negative deductions and foreign sources',()=>{
 const {inputs}=fixture();const fields={...values,date:inputs[0].run.start};
 for(const changes of [{reason:' '},{amount:'9007199254740999'},{amount:'-1'},{date:'2020-01-01'},{description:''}])assert.throws(()=>correctDraftTransaction(inputs,'synthetic','sample-entry-fuel',{...fields,...changes},at));
 assert.throws(()=>correctDraftTransaction(inputs,'other','sample-entry-fuel',fields,at));
 assert.throws(()=>correctDraftTransaction(inputs,'synthetic','grid-synthetic-charge',fields,at));
 inputs[0].run.status='APPROVED';assert.throws(()=>correctDraftTransaction(inputs,'synthetic','sample-entry-fuel',fields,at));
 inputs[0].run.status='DRAFT';inputs[0].history=[{sourceIds:['transaction:sample-entry-fuel']}];assert.throws(()=>correctDraftTransaction(inputs,'synthetic','sample-entry-fuel',fields,at));
});
test('session checkpoint round-trips exact entered facts, configured rules and correction evidence',()=>{
 const fixtureData=fixture(),{inputs,rows,run}=fixtureData;
 const result=correctDraftTransaction(inputs,'synthetic','sample-entry-fuel',{...values,date:run.start},at);
 const saved=encodeDraft({inputs:result.inputs,rows,corrections:[result.correction]},'Synthetic workspace',run,at);
 const restored=decodeDraft(saved,'Synthetic workspace',run);
 assert.equal(restored.inputs[0].transactions[0].description,values.description);assert.equal(restored.corrections[0].before.amountCents,10000);
 assert.equal(calculateContractorSettlement(restored.inputs[0]).netSettlementCents,calculateContractorSettlement(result.inputs[0]).netSettlementCents);
 assert.notEqual(draftKey('Other workspace',run),draftKey('Synthetic workspace',run));
});
test('recovery rejects foreign workspace, wrong period, bad version, cross-company activity and approved state',()=>{
 const {inputs,rows,run}=fixture(),raw=encodeDraft({inputs,rows},'Synthetic workspace',run,at);
 assert.throws(()=>decodeDraft(raw,'Other workspace',run));assert.throws(()=>decodeDraft(raw,'Synthetic workspace',{...run,payPeriodId:'other'}));
 for(const change of [data=>data.version=2,data=>data.inputs[0].transactions[0].companyId='other',data=>data.inputs[0].run.status='APPROVED',data=>data.rows.push(data.rows[0])]){const data=JSON.parse(raw);change(data);assert.throws(()=>decodeDraft(JSON.stringify(data),'Synthetic workspace',run));}
 assert.throws(()=>decodeDraft('x'.repeat(2_000_001),'Synthetic workspace',run));
});
