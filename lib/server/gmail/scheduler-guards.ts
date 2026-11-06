import type { Sql } from "./database.ts";
export async function claimScheduler(sql: Sql, owner: string) {
  return (await sql.query(
    "UPDATE mailbox_scheduler_gate SET owner=$1,lease_until=now()+interval '6 minutes',next_allowed_at=now()+interval '5 minutes' WHERE id=true AND next_allowed_at<=now() AND (lease_until IS NULL OR lease_until<now()) RETURNING id", [owner],
  )).rows.length > 0;
}
export async function releaseScheduler(sql: Sql, owner: string) {
  await sql.query("UPDATE mailbox_scheduler_gate SET owner=NULL,lease_until=NULL WHERE id=true AND owner=$1", [owner]);
}
export type JobOutcome = "success" | "continue" | "transient" | "authorization";
export async function finishMailboxJob(sql: Sql, company: string, mailbox: string, owner: string, outcome: JobOutcome) {
  await sql.query(
    `UPDATE gmail_sync_jobs SET lease_owner=NULL,lease_until=NULL,
     next_run_at=now()+make_interval(secs=>CASE WHEN $4='authorization' THEN 86400
       WHEN $4='transient' THEN LEAST(21600,300*power(2,LEAST(consecutive_failures+1,7)))::int ELSE 300 END),
     consecutive_failures=CASE WHEN $4 IN ('transient','authorization') THEN LEAST(consecutive_failures+1,100) ELSE 0 END
     WHERE company_id=$1 AND mailbox_id=$2 AND lease_owner=$3`,
    [company, mailbox, owner, outcome],
  );
}

// Stop even when a provider returns an endless sequence of continuation pages.
export async function runBoundedPages(
  synchronize: () => Promise<{ more?: boolean }>,
  deadline: number,
  now = Date.now,
) {
  let pages = 0;
  while (pages < 10 && now() < deadline) {
    const result = await synchronize();
    pages++;
    if (!result.more) break;
  }
  return pages;
}
