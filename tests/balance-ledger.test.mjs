import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCompanyAccess, PermissionDenied } from '../lib/server/access.ts';
import { prepareLedgerPosting as post, ledgerBalance } from '../lib/server/balance-ledger.ts';
const now=Date.parse('2026-10-17T12:00:00Z');
const account={id:'advance-a',companyId:'company-a',contractorId:'contractor-a',type:'CASH_ADVANCE'};
const access=await resolveCompanyAccess({verifySession:async()=>({userId:'finance-a',expiresAt:now+60000,authenticatedAt:now,assurance:'MFA',revoked:false}),findMembership:async()=>({userId:'finance-a',companyId:'company-a',active:true,roles:['FINANCE']})},'opaque','company-a',now);
const input=(id,amount,kind='INCREASE')=>({id,kind,amountCents:amount,sourceId:`source-${id}`,idempotencyKey:`key-${id}`,reason:'Synthetic authorized activity'});
test('draft preparation never consumes balances; posting carries actor and safe immutable audit',()=>{
 const opening=post(access,account,input('opening',10000,'OPENING'),[],now);
 const history=[opening.entry];
 const recovery=post(access,account,input('recovery',-2000,'RECOVERY'),history,now);
 assert.equal(recovery.balanceCents,8000);assert.equal(ledgerBalance(access,account,history,now),10000);
 assert.equal(recovery.entry.actorId,'finance-a');assert.equal(recovery.audit.companyId,'company-a');
 assert.equal(Object.isFrozen(recovery.entry),true);assert.equal(Object.isFrozen(recovery.audit),true);
 assert.equal('reason' in recovery.audit,false);
});
test('retry returns original entry without another audit; reused key with different payload fails',()=>{
 const first=post(access,account,input('opening',10000,'OPENING'),[],now);
 const retry=post(access,account,{...input('new-generated-id',10000,'OPENING'),sourceId:first.entry.sourceId,idempotencyKey:first.entry.idempotencyKey},[first.entry],now+1);
 assert.equal(retry.replayed,true);assert.equal(retry.audit,null);assert.equal(retry.entry.id,first.entry.id);assert.equal(retry.balanceCents,10000);
 assert.throws(()=>post(access,account,{...input('opening',10001,'OPENING')},[first.entry],now),/different balance activity/);
 assert.throws(()=>post(access,account,{...input('other',10000),sourceId:first.entry.sourceId},[first.entry],now),/already been recorded/);
});
test('final recovery stops at zero and over-recovery, floating point and unsafe totals fail',()=>{
 const opening=post(access,account,input('opening',123,'OPENING'),[],now).entry;
 assert.equal(post(access,account,input('final',-123,'RECOVERY'),[opening],now).balanceCents,0);
 assert.throws(()=>post(access,account,input('excess',-124,'RECOVERY'),[opening],now),RangeError);
 assert.throws(()=>post(access,account,input('fraction',0.1),[opening],now));
 const max=post(access,account,input('max',Number.MAX_SAFE_INTEGER,'OPENING'),[],now).entry;
 assert.throws(()=>post(access,account,input('overflow',1),[max],now),RangeError);
});
test('reversal compensates history exactly once without changing original entries',()=>{
 const original=post(access,account,input('opening',10000,'OPENING'),[],now).entry;
 const recovery=post(access,account,input('repay',-1000,'RECOVERY'),[original],now).entry;
 const reverse=post(access,account,{...input('reverse',1000,'REVERSAL'),reversesEntryId:recovery.id},[original,recovery],now);
 assert.equal(reverse.balanceCents,10000);assert.equal(recovery.amountCents,-1000);
 assert.throws(()=>post(access,account,{...input('reverse-again',1000,'REVERSAL'),reversesEntryId:recovery.id},[original,recovery,reverse.entry],now),/already reversed/);
 assert.throws(()=>post(access,account,{...input('bad',999,'REVERSAL'),reversesEntryId:recovery.id},[original,recovery],now),/exactly offset/);
});
test('company, contractor and account boundaries fail closed; source and entry duplicates fail',()=>{
 const entry=post(access,account,input('opening',100,'OPENING'),[],now).entry;
 for(const change of [{companyId:'company-b'},{contractorId:'contractor-b'},{accountId:'other'}]) assert.throws(()=>ledgerBalance(access,account,[{...entry,...change}],now),PermissionDenied);
 assert.throws(()=>ledgerBalance(access,{...account,companyId:'company-b'},[],now),PermissionDenied);
 assert.throws(()=>ledgerBalance(access,account,[entry,entry],now),/duplicate/);
});
test('escrow uses releases and cannot be recovered or released beyond its balance',()=>{
 const escrow={...account,type:'ESCROW'};
 const entry=post(access,escrow,input('opening',500,'OPENING'),[],now).entry;
 assert.equal(post(access,escrow,input('release',-500,'RELEASE'),[entry],now).balanceCents,0);
 assert.throws(()=>post(access,escrow,input('recovery',-100,'RECOVERY'),[entry],now),/release/);
 assert.throws(()=>post(access,account,input('release',-100,'RELEASE'),[entry],now),/recovery/);
});
test('corrupt scoped history fails rather than producing an authoritative balance',()=>{
 const entry=post(access,account,input('opening',100,'OPENING'),[],now).entry;
 assert.throws(()=>ledgerBalance(access,account,[entry,{...entry,id:'other',idempotencyKey:'other'}],now),/duplicate/);
 assert.throws(()=>ledgerBalance(access,account,[{...entry,kind:'RECOVERY'}],now),/invalid decrease/);
 assert.throws(()=>ledgerBalance(access,account,[{...entry,kind:'REVERSAL',reversesEntryId:'missing'}],now),/invalid reversal/);
});
