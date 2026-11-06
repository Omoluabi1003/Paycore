import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { limitRequest, RateLimitError } from '../lib/server/security/rate-limit.ts';
import { claimScheduler, releaseScheduler, finishMailboxJob, runBoundedPages } from '../lib/server/gmail/scheduler-guards.ts';
async function database() {
 const db=new PGlite();
 for(const migration of ['001_contractors','002_gmail_documents','003_mailbox_providers','004_mailbox_owner','005_cost_guards'])
  await db.exec(await fs.readFile(new URL(`../db/migrations/${migration}.sql`,import.meta.url),'utf8'));
 await db.exec('CREATE ROLE cost_runtime; GRANT USAGE ON SCHEMA public TO cost_runtime; GRANT SELECT,INSERT,UPDATE ON request_rate_limits TO cost_runtime; GRANT SELECT,UPDATE ON mailbox_scheduler_gate TO cost_runtime; GRANT SELECT,UPDATE ON gmail_sync_jobs TO cost_runtime');
 const transaction=(_company,user,fn)=>db.transaction(async sql=>{
  await sql.exec('SET LOCAL ROLE cost_runtime');
  await sql.query("SELECT set_config('paycore.user_id',$1,true)",[user]);
  return fn(sql);
 });
 return {db,transaction};
}
test('shared account limits are atomic, return 429, isolate identities and recover after the window',async()=>{
 const {db,transaction}=await database();
 try {
  const calls=await Promise.allSettled(Array.from({length:14},()=>limitRequest('verified-user','mailbox-management',transaction)));
  assert.equal(calls.filter(r=>r.status==='fulfilled').length,10);
  for(const result of calls.filter(r=>r.status==='rejected')) {assert.ok(result.reason instanceof RateLimitError);assert.equal(result.reason.status,429);assert.equal(result.reason.retryAfter,600)}
  await limitRequest('another-verified-user','mailbox-management',transaction);
  await limitRequest('verified-user','documents',transaction);
  await transaction('', 'another-verified-user',async sql=>{
   assert.equal((await sql.query('SELECT * FROM request_rate_limits WHERE user_id=$1',['verified-user'])).rows.length,0);
  });
  await assert.rejects(()=>transaction('', 'another-verified-user',sql=>sql.query("INSERT INTO request_rate_limits(user_id,bucket,hits) VALUES('forged-user','documents',1)")),/row-level security/);
  await db.query("UPDATE request_rate_limits SET window_started_at=now()-interval '11 minutes' WHERE user_id='verified-user'");
  await limitRequest('verified-user','mailbox-management',transaction);
  assert.equal((await db.query("SELECT hits FROM request_rate_limits WHERE user_id='verified-user' AND bucket='mailbox-management'")).rows[0].hits,1);
 } finally {await db.close()}
});
test('only one scheduler runs across invocations and stale owners cannot release its gate',async()=>{
 const {db}=await database(),a=randomUUID(),b=randomUUID();
 try {
  const claimed=await Promise.all([claimScheduler(db,a),claimScheduler(db,b)]);
  assert.equal(claimed.filter(Boolean).length,1);
  const owner=claimed[0]?a:b,other=claimed[0]?b:a;
  await releaseScheduler(db,other);
  assert.equal((await db.query('SELECT owner FROM mailbox_scheduler_gate')).rows[0].owner,owner);
  await releaseScheduler(db,owner);
  assert.equal(await claimScheduler(db,other),false); // Cooldown survives completion.
  await db.exec("UPDATE mailbox_scheduler_gate SET next_allowed_at=now()-interval '1 second',lease_until=now()-interval '1 second'");
  assert.equal(await claimScheduler(db,other),true);
 } finally {await db.close()}
});
test('failed jobs back off, authorization failures wait a day, progress resets failures and wrong owners cannot mutate',async()=>{
 const {db}=await database(),id=randomUUID(),owner=randomUUID();
 try {
  await db.query("INSERT INTO workspaces(id) VALUES('cost-company')");
  await db.query("INSERT INTO gmail_mailboxes(id,company_id,email,connected_by,credentials) VALUES($1,'cost-company','synthetic@example.test','synthetic-user','synthetic')",[id]);
  await db.query("INSERT INTO gmail_sync_jobs(mailbox_id,company_id,lease_owner) VALUES($1,'cost-company',$2)",[id,owner]);
  const row=async()=> (await db.query('SELECT consecutive_failures,extract(epoch FROM next_run_at-now())::int AS seconds,lease_owner FROM gmail_sync_jobs')).rows[0];
  await finishMailboxJob(db,'cost-company',id,randomUUID(),'transient');assert.equal((await row()).consecutive_failures,0);
  for(let n=1;n<=10;n++) {
   await db.query('UPDATE gmail_sync_jobs SET lease_owner=$1',[owner]);
   await finishMailboxJob(db,'cost-company',id,owner,'transient');
   const job=await row();assert.equal(job.consecutive_failures,n);assert.ok(Math.abs(job.seconds-Math.min(21600,300*2**Math.min(n,7)))<3);
  }
  await db.query('UPDATE gmail_sync_jobs SET lease_owner=$1',[owner]);
  await finishMailboxJob(db,'cost-company',id,owner,'authorization');assert.ok(Math.abs((await row()).seconds-86400)<3);
  await db.query('UPDATE gmail_sync_jobs SET lease_owner=$1',[owner]);
  await finishMailboxJob(db,'cost-company',id,owner,'continue');assert.equal((await row()).consecutive_failures,0);assert.ok(Math.abs((await row()).seconds-300)<3);
 } finally {await db.close()}
});

test('emergency pause avoids all database and provider work',async()=>{
 const {runGmailScheduler}=await import('../lib/server/gmail/worker.ts');
 const enabled=process.env.PAYCORE_MAILBOX_SYNC_ENABLED,databaseUrl=process.env.DATABASE_URL;
 try {
  process.env.PAYCORE_MAILBOX_SYNC_ENABLED='false';delete process.env.DATABASE_URL;
  assert.deepEqual(await runGmailScheduler(),{mailboxes:0,paused:true,outcomes:[]});
 } finally {
  if(enabled===undefined)delete process.env.PAYCORE_MAILBOX_SYNC_ENABLED;else process.env.PAYCORE_MAILBOX_SYNC_ENABLED=enabled;
  if(databaseUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=databaseUrl;
 }
});

test('an endless provider cursor cannot exceed the page budget or continue after the deadline',async()=>{
 let calls=0;
 assert.equal(await runBoundedPages(async()=>{calls++;return {more:true}},100,()=>0),10);
 assert.equal(calls,10);
 assert.equal(await runBoundedPages(async()=>{throw Error('Must not run after deadline')},100,()=>101),0);
 assert.equal(await runBoundedPages(async()=>({more:false}),100,()=>0),1);
});
