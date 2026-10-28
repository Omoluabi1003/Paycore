import test from 'node:test';
import assert from 'node:assert/strict';
import { approvePayroll } from '../lib/server/payroll-approval.ts';
import { PermissionDenied } from '../lib/server/access.ts';
const now=Date.parse('2026-10-17T12:00:00Z');
function fixture(balance=10000){
 const run={id:'run-a',companyId:'company-a',payPeriodId:'period-a',start:'2026-10-05',end:'2026-10-18',status:'DRAFT'};
 const effective={active:true,effectiveFrom:run.start,effectiveTo:null,createdBy:'preparer-a',createdAt:'2026-10-05T12:00:00Z'};
 const contractor={id:'contractor-a',companyId:run.companyId,contractorNumber:'PC-A',displayName:'Synthetic Contractor',status:'ACTIVE',paymentMethod:'CHECK',effectiveStartDate:run.start,effectiveEndDate:null,createdAt:effective.createdAt,updatedAt:effective.createdAt};
 const input={run,contractor,compensationRules:[{...effective,id:'pay-a',contractorId:contractor.id,method:'PERCENT_OF_ELIGIBLE_REVENUE',rateBasisPoints:7000}],deductionRules:[{...effective,id:'advance-a',contractorId:contractor.id,category:'CASH_ADVANCE',description:'Advance repayment',calculationMethod:'INSTALLMENT',amountCents:2000,remainingBalanceCents:999999,frequency:'UNTIL_BALANCE_PAID'}],loads:[{id:'load-a',companyId:run.companyId,contractorId:contractor.id,loadNumber:'LOAD-A',proNumber:'PRO-A',date:run.start,origin:'Synthetic depot',destination:'Synthetic destination',loadedMiles:100,emptyMiles:0,grossRevenueCents:100000,status:'ELIGIBLE'}],transactions:[],history:[]};
 const account={id:'account-a',companyId:run.companyId,contractorId:contractor.id,type:'CASH_ADVANCE'};
 const history=balance?[{id:'opening-a',companyId:run.companyId,contractorId:contractor.id,accountId:account.id,kind:'OPENING',amountCents:balance,sourceId:'opening-source',idempotencyKey:'opening-key',actorId:'finance-a',reason:'Synthetic opening',occurredAt:effective.createdAt}]:[];
 return {companyId:run.companyId,payrollRunId:run.id,revision:1,status:'DRAFT',preparedBy:'preparer-a',requireSeparateApprover:true,inputs:[input],balances:[{contractorId:contractor.id,ruleId:'advance-a',account,history}]};
}
const request={companyId:'company-a',payrollRunId:'run-a',idempotencyKey:'approval-a',expectedRevision:1,reviewReasons:{}};
function environment(run=fixture(),options={}){
 let state={run:structuredClone(run),receipts:[],bundles:[]};let queue=Promise.resolve();let userId=options.userId??'approver-a';let active=true;
 const access={verifySession:async()=>({userId,expiresAt:now+60000,authenticatedAt:now,assurance:options.assurance??'MFA',revoked:false}),findMembership:async()=>({userId,companyId:'company-a',active,roles:options.roles??['APPROVER']})};
 const repository={async transaction(company,work){let release;const previous=queue;queue=new Promise(resolve=>release=resolve);await previous;const draft=structuredClone(state);
 try {const result=await work({lockPayroll:async(c,id)=>{if(options.revokeAtLock)active=false;return draft.run},findReceipt:async(c,key)=>draft.receipts.find(item=>item.companyId===c&&item.idempotencyKey===key)??null,commitApproval:async bundle=>{
 assert.equal(company,bundle.receipt.companyId);assert.equal(draft.run.revision,bundle.expectedRevision);
 draft.bundles.push(structuredClone(bundle));
 for(const entry of bundle.balanceEntries)draft.run.balances.find(binding=>binding.account.id===entry.accountId).history.push(structuredClone(entry));
 if(options.failDuringCommit)throw Error('Synthetic transaction failure');
 draft.receipts.push(structuredClone(bundle.receipt));draft.run.status='APPROVED';draft.run.revision++;
 }});state=draft;return result;}finally{release();}}};
 return {dependencies:{access,repository,now:()=>now},state:()=>structuredClone(state)};
}
test('approval recalculates from locked balances, produces snapshots and posts with APPROVER role alone',async()=>{
 const e=environment();const receipt=await approvePayroll(e.dependencies,'opaque',request);const state=e.state();
 assert.equal(receipt.settlements[0].netSettlementCents,68000);
 assert.equal(state.bundles[0].balanceEntries[0].amountCents,-2000);
 assert.equal(state.bundles[0].sourceClaims[0].sourceId,'load:load-a');
 assert.equal(state.bundles[0].deductionClaims.length,1);assert.equal(state.bundles[0].deductionClaims[0].ruleId,'advance-a');
 assert.deepEqual(state.bundles[0].auditEvents.map(event=>event.action),['balance.posted','payroll.approved']);
 assert.equal(Object.isFrozen(receipt.settlements[0].calculationSnapshot),true);
 assert.equal(receipt.approvedBy,'approver-a');assert.equal(state.run.status,'APPROVED');
});
test('last installment never exceeds actual ledger balance and zero balance posts nothing',async()=>{
 for(const balance of [1500,0]){
 const e=environment(fixture(balance));const receipt=await approvePayroll(e.dependencies,'opaque',request);
 assert.equal(receipt.settlements[0].netSettlementCents,70000-balance);
 assert.equal(e.state().bundles[0].balanceEntries.length,balance?1:0);
 }
});
test('same request replay is immutable and concurrent retries cannot double-post in transactional adapter',async()=>{
 const e=environment();const [a,b]=await Promise.all([approvePayroll(e.dependencies,'opaque',request),approvePayroll(e.dependencies,'opaque',request)]);
 assert.deepEqual(a,b);assert.equal(e.state().bundles.length,1);assert.equal(e.state().run.balances[0].history.length,2);
 await assert.rejects(approvePayroll(e.dependencies,'opaque',{...request,expectedRevision:2}),/request key/);
 await assert.rejects(approvePayroll(e.dependencies,'opaque',{...request,idempotencyKey:'another'}),/already been approved/);
});
test('partial persistence failure rolls back snapshot, ledger, source claims and audit together',async()=>{
 const e=environment(fixture(),{failDuringCommit:true});const before=e.state();await assert.rejects(approvePayroll(e.dependencies,'opaque',request),/transaction failure/);assert.deepEqual(e.state(),before);
});
test('denies wrong role, weak authentication, cross-company data and revocation while waiting for locks',async()=>{
 for(const options of [{roles:['PAYROLL_SPECIALIST']},{assurance:'PASSWORD'},{revokeAtLock:true}]){
 const e=environment(fixture(),options);await assert.rejects(approvePayroll(e.dependencies,'opaque',request),PermissionDenied);assert.equal(e.state().bundles.length,0);
 }
 const run=fixture();run.inputs[0].contractor.companyId='company-b';const e=environment(run);await assert.rejects(approvePayroll(e.dependencies,'opaque',request),PermissionDenied);
});
test('requires current revision and a separate approver when configured',async()=>{
 const e=environment();await assert.rejects(approvePayroll(e.dependencies,'opaque',{...request,expectedRevision:0}),/changed since/);
 const same=environment(fixture(),{userId:'preparer-a'});await assert.rejects(approvePayroll(same.dependencies,'opaque',request),/different authorized person/);
 const run=fixture();run.requireSeparateApprover=false;const allowed=environment(run,{userId:'preparer-a'});assert.equal((await approvePayroll(allowed.dependencies,'opaque',request)).approvedBy,'preparer-a');
});
test('blocking calculations, unreviewed warnings and missing balance mapping make no writes',async()=>{
 for(const modify of [run=>run.inputs[0].compensationRules=[],run=>run.balances=[],run=>run.inputs[0].loads.push({...run.inputs[0].loads[0],id:'another'})]){
 const run=fixture();modify(run);const e=environment(run);await assert.rejects(approvePayroll(e.dependencies,'opaque',request));assert.equal(e.state().bundles.length,0);
 }
});
test('all contractors must pass before committing the whole run',async()=>{
 const run=fixture();const second=structuredClone(run.inputs[0]);second.contractor.id='contractor-b';second.compensationRules=[];run.inputs.push(second);const e=environment(run);
 await assert.rejects(approvePayroll(e.dependencies,'opaque',request));assert.equal(e.state().run.balances[0].history.length,1);assert.equal(e.state().bundles.length,0);
});
