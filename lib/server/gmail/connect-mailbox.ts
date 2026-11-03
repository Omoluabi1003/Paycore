import { randomUUID } from "node:crypto";
import { scoped } from "./database.ts";
import { seal } from "./crypto.ts";
import { credentials, event } from "./repository.ts";
import type { Mailbox } from "./repository.ts";
import type { MailboxProvider } from "../../mailbox-links.ts";
export async function saveMailboxConnection(
  company: string,
  user: string,
  provider: MailboxProvider,
  profile: { emailAddress: string; historyId: string },
  token: { access_token: string; refresh_token?: string; expires_in: number },
  transaction = scoped,
) {
  return transaction(company, user, async (sql) => {
    const member = (
      await sql.query(
        "SELECT roles FROM document_company_memberships WHERE company_id=$1 AND user_id=$2 AND active=true",
        [company, user],
      )
    ).rows[0];
    if (
      !member?.roles.some((role: string) =>
        ["OWNER_ADMIN", "FINANCE"].includes(role),
      )
    )
      throw Error("Mailbox access was removed.");
    await sql.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${company}:${profile.emailAddress.toLowerCase()}`,
    ]);
    const prior = (
      await sql.query(
        "SELECT * FROM gmail_mailboxes WHERE company_id=$1 AND email=$2 FOR UPDATE",
        [company, profile.emailAddress.toLowerCase()],
      )
    ).rows[0] as Mailbox | undefined;
    const id = prior?.id ?? randomUUID();
    const refresh =
      token.refresh_token ||
      (prior?.active && (prior.provider ?? "GMAIL") === provider
        ? credentials(prior).refreshToken
        : "");
    if (!refresh)
      throw Error(
        "Offline mailbox permission is required. Reconnect with consent.",
      );
    const encrypted = seal(
      JSON.stringify({
        accessToken: token.access_token,
        refreshToken: refresh,
        expiresAt: Date.now() + token.expires_in * 1000,
      }),
      `gmail-token:${company}:${id}`,
    );
    await sql.query(
      "INSERT INTO gmail_mailboxes(id,company_id,email,connected_by,credentials,checkpoint,provider) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(company_id,email) DO UPDATE SET provider=excluded.provider,credentials=excluded.credentials,active=true,connected_by=excluded.connected_by,checkpoint=excluded.checkpoint,last_error=NULL,last_synced_at=NULL,connected_at=now()",
      [
        id,
        company,
        profile.emailAddress.toLowerCase(),
        user,
        encrypted,
        JSON.stringify({ phase: "BACKFILL", anchor: profile.historyId }),
        provider,
      ],
    );
    await sql.query(
      "INSERT INTO gmail_sync_jobs(mailbox_id,company_id) VALUES($1,$2) ON CONFLICT(mailbox_id) DO UPDATE SET next_run_at=now(),lease_owner=NULL,lease_until=NULL",
      [id, company],
    );
    await event(sql, company, user, "mailbox.connected", {
      mailboxId: id,
      provider,
    });
    return id;
  });
}
