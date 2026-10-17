import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCompanyAccess, requirePermission, requireOwnContractor, PermissionDenied } from '../lib/server/access.ts';
const now = Date.parse('2026-10-17T12:00:00Z');
const session = { userId:'user-a', expiresAt:now+60000, authenticatedAt:now, assurance:'MFA', revoked:false };
const member = { userId:'user-a', companyId:'company-a', active:true, roles:['PAYROLL_SPECIALIST'] };
const deps = (s=session,m=member) => ({verifySession:async()=>s,findMembership:async()=>m});
test('server resolves identity before membership; forged context and cross-company membership fail', async()=>{
 const calls=[]; const access=await resolveCompanyAccess({verifySession:async token=>{calls.push(token);return session},findMembership:async(user,company)=>{calls.push([user,company]);return member}},'opaque','company-a',now);
 assert.deepEqual(calls,['opaque',['user-a','company-a']]);
 assert.doesNotThrow(()=>requirePermission(access,'payroll.prepare',now));
 assert.throws(()=>requirePermission({...access},'payroll.prepare',now),PermissionDenied);
 for(const change of [{companyId:'company-b'},{userId:'user-b'},{active:false},{roles:['UNKNOWN']}]) await assert.rejects(resolveCompanyAccess(deps(session,{...member,...change}),'opaque','company-a',now),PermissionDenied);
});
test('missing, expired, revoked and future-dated sessions fail before membership lookup',async()=>{
 for(const invalid of [null,{...session,expiresAt:now},{...session,revoked:true},{...session,authenticatedAt:now+1}]){
 let called=false; await assert.rejects(resolveCompanyAccess({verifySession:async()=>invalid,findMembership:async()=>{called=true;return member}},'opaque','company-a',now),PermissionDenied);assert.equal(called,false);
 }
});
test('preparation, owner administration and audit access do not imply approval',async()=>{
 for(const role of ['PAYROLL_SPECIALIST','PAYROLL_MANAGER','OWNER_ADMIN','AUDITOR','FINANCE','CONTRACTOR']){
 const access=await resolveCompanyAccess(deps(session,{...member,roles:[role]}),'opaque','company-a',now);
 assert.throws(()=>requirePermission(access,'payroll.approve',now),PermissionDenied);
 }
 const multiple=await resolveCompanyAccess(deps(session,{...member,roles:['OWNER_ADMIN','APPROVER']}),'opaque','company-a',now);
 assert.doesNotThrow(()=>requirePermission(multiple,'payroll.approve',now));
});
test('sensitive permissions require recent MFA, and context expires',async()=>{
 for(const change of [{assurance:'PASSWORD'},{authenticatedAt:now-600001}]){
 const access=await resolveCompanyAccess(deps({...session,...change},{...member,roles:['APPROVER']}),'opaque','company-a',now);
 assert.throws(()=>requirePermission(access,'payroll.approve',now),PermissionDenied);
 }
 const access=await resolveCompanyAccess(deps(),'opaque','company-a',now);
 assert.throws(()=>requirePermission(access,'payroll.read',now+60000),PermissionDenied);
});
test('contractor portal scope cannot read other contractors or companies',async()=>{
 const access=await resolveCompanyAccess(deps(session,{...member,roles:['CONTRACTOR'],contractorId:'contractor-a'}),'opaque','company-a',now);
 assert.doesNotThrow(()=>requireOwnContractor(access,'company-a','contractor-a',now));
 assert.throws(()=>requireOwnContractor(access,'company-a','contractor-b',now),PermissionDenied);
 assert.throws(()=>requireOwnContractor(access,'company-b','contractor-a',now),PermissionDenied);
 assert.throws(()=>requirePermission(access,'payroll.read',now),PermissionDenied);
});
