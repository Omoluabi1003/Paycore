import { isBrice } from "../microsoft/ownership.ts";
import {
  MicrosoftClient,
  exchangeMicrosoftToken,
} from "../microsoft/client.ts";
import type { MailboxProvider } from "../../mailbox-links.ts";
import type { MailboxClient } from "./client.ts";
import { randomUUID } from "node:crypto";
import { scoped, pool } from "./database.ts";
import type { Sql } from "./database.ts";
import {
  GmailClient,
  exchangeToken,
  GoogleError,
  GoogleResponseLimit,
} from "./client.ts";
import {
  CheckpointSchema,
  credentials,
  saveCredentials,
  assertLease,
  sourceStatus,
  recordSource,
  event,
} from "./repository.ts";
import type { Mailbox, Checkpoint } from "./repository.ts";
import { extractBilling, messageParts, billingMarker } from "./extract.ts";
import type { MailSource, GmailPart } from "./extract.ts";
import { digest } from "./crypto.ts";
import { emptyDocumentFields } from "../../document-import.ts";
export type WorkerDependencies = {
  transaction: typeof scoped;
  refresh: (
    parameters: Record<string, string>,
    provider?: MailboxProvider,
  ) => ReturnType<typeof exchangeToken>;
  client: (token: string, provider?: MailboxProvider) => MailboxClient;
  extract: typeof extractBilling;
  now: () => number;
};
const defaults: WorkerDependencies = {
  transaction: scoped,
  refresh: (parameters, provider) =>
    provider === "MICROSOFT"
      ? exchangeMicrosoftToken(parameters)
      : exchangeToken(parameters),
  client: (token, provider) =>
    provider === "MICROSOFT"
      ? new MicrosoftClient(token)
      : new GmailClient(token),
  extract: extractBilling,
  now: Date.now,
};
class TimeBudget extends Error {}
export async function syncMailbox(
  company: string,
  id: string,
  owner: string,
  overrides: Partial<WorkerDependencies> = {},
  deadline = Date.now() + 180000,
) {
  const deps = { ...defaults, ...overrides };
  const transaction = <T>(fn: Parameters<typeof scoped<T>>[2]) =>
    deps.transaction(company, "gmail-worker", async (sql) => {
      await assertLease(sql, company, id, owner);
      return fn(sql);
    });
  const box = await transaction(
    async (sql) =>
      (
        await sql.query(
          "SELECT * FROM gmail_mailboxes WHERE company_id=$1 AND id=$2 AND active=true",
          [company, id],
        )
      ).rows[0] as Mailbox,
  );
  if (!box) throw Error("Mailbox not active.");
  if (isBrice(box.email) && (box.provider !== "MICROSOFT" || !box.microsoft_owner_id))
    throw Error("Mailbox owner verification required. Reconnect Microsoft.");
  let token = credentials(box);
  if (token.expiresAt < deps.now() + 60000) {
    const refreshed = await deps.refresh(
      {
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      },
      box.provider ?? "GMAIL",
    );
    token = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      expiresAt: deps.now() + refreshed.expires_in * 1000,
    };
    await transaction((sql) => saveCredentials(sql, box, token));
  }
  const gmail = deps.client(token.accessToken, box.provider ?? "GMAIL");
  if (isBrice(box.email)) {
    const profile = await gmail.profile() as { emailAddress?: string; accountId?: string };
    if (!isBrice(profile.emailAddress) || profile.accountId?.toLowerCase() !== box.microsoft_owner_id)
      throw Error("Microsoft mailbox ownership changed. Reconnect Microsoft.");
  }
  let checkpoint: Checkpoint = CheckpointSchema.parse(box.checkpoint);
  if (checkpoint.phase === "BACKFILL" && !checkpoint.anchor) {
    checkpoint = { ...checkpoint, anchor: (await gmail.profile()).historyId };
    await transaction((sql) =>
      sql.query(
        "UPDATE gmail_mailboxes SET checkpoint=$3 WHERE company_id=$1 AND id=$2",
        [company, id, JSON.stringify(checkpoint)],
      ),
    );
  }
  let page: any;
  try {
    page =
      checkpoint.phase === "BACKFILL"
        ? await gmail.inboxPage(checkpoint.pageToken)
        : await gmail.historyPage(checkpoint.historyId!, checkpoint.pageToken);
  } catch (error) {
    if (
      error instanceof GoogleError &&
      [404, 410].includes(error.status) &&
      checkpoint.phase === "HISTORY"
    ) {
      await transaction((sql) =>
        sql.query(
          "UPDATE gmail_mailboxes SET checkpoint=$3 WHERE company_id=$1 AND id=$2",
          [
            company,
            id,
            JSON.stringify({ phase: "BACKFILL", anchor: undefined }),
          ],
        ),
      );
      return { reset: true, processed: 0 };
    }
    if (
      error instanceof GoogleError &&
      error.status === 400 &&
      checkpoint.pageToken
    ) {
      const reset = { ...checkpoint };
      delete reset.pageToken;
      await transaction((sql) =>
        sql.query(
          "UPDATE gmail_mailboxes SET checkpoint=$3 WHERE company_id=$1 AND id=$2",
          [company, id, JSON.stringify(reset)],
        ),
      );
      return { reset: true, processed: 0 };
    }
    throw error;
  }
  const ids =
    checkpoint.phase === "BACKFILL"
      ? (page.messages ?? []).map((message: any) => message.id)
      : (page.history ?? []).flatMap((history: any) => [
          ...(history.messagesAdded ?? []).map(
            (entry: any) => entry.message.id,
          ),
          ...(history.labelsAdded ?? [])
            .filter((entry: any) => entry.labelIds?.includes("INBOX"))
            .map((entry: any) => entry.message.id),
        ]);
  let processed = 0;
  for (const messageId of [...new Set<string>(ids)]) {
    if (deps.now() > deadline) throw new TimeBudget();
    const seen = await transaction(async (sql) =>
      Boolean(
        (
          await sql.query(
            "SELECT message_id FROM gmail_processed_messages WHERE company_id=$1 AND mailbox_id=$2 AND message_id=$3 AND provider=$4",
            [company, id, messageId, box.provider ?? "GMAIL"],
          )
        ).rows.length,
      ),
    );
    if (seen) continue;
    let message: any;
    try {
      message = await gmail.message(messageId);
    } catch (error) {
      if (error instanceof GoogleResponseLimit) {
        const metadata = await gmail.messageMetadata(messageId);
        if ((metadata.labelIds ?? []).includes("INBOX")) {
          const timestamp = Number(metadata.internalDate);
          const source: MailSource = {
            name: "Oversized email",
            sourceUrl: metadata.sourceUrl,
            mime: "application/vnd.paycore.mailbox-exception+json",
            bytes: Buffer.from(
              JSON.stringify({ messageId, issue: "message-size-limit" }),
            ),
            receivedAt: new Date(
              Number.isFinite(timestamp) ? timestamp : deps.now(),
            ).toISOString(),
            subject: "",
            sender: "",
          };
          await transaction((sql) =>
            recordSource(sql, box, messageId, source, {
              fields: emptyDocumentFields(),
              issues: [
                "Email exceeds the automatic scan limit. Open the original email.",
              ],
              relevant: true,
            }),
          );
          await transaction((sql) =>
            sql.query(
              "INSERT INTO gmail_processed_messages(company_id,mailbox_id,message_id,provider) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
              [company, id, messageId, box.provider ?? "GMAIL"],
            ),
          );
        }
        continue;
      }
      if (error instanceof GoogleError && error.status === 404) {
        // It may have moved or been deleted while listing. A later Inbox restore
        // must remain eligible, so do not permanently mark it as processed.
        continue;
      }
      throw error;
    }
    if (!(message.labelIds ?? []).includes("INBOX")) continue;
    if ((message.labelIds ?? []).includes("INBOX")) {
      const payload = message.payload as GmailPart,
        headers = payload.headers ?? [];
      const header = (name: string) =>
        headers.find((entry) => entry.name.toLowerCase() === name)?.value ?? "";
      const subject = header("subject"),
        sender = header("from"),
        timestamp = Number(message.internalDate);
      const receivedAt = new Date(
        Number.isFinite(timestamp) ? timestamp : deps.now(),
      ).toISOString();
      const parts = messageParts(payload);
      const candidates = [
        ...parts.files,
        ...(parts.bodies.some((part) => part.mimeType === "text/plain")
          ? parts.bodies
              .filter((part) => part.mimeType === "text/plain")
              .slice(0, 1)
          : parts.bodies
              .filter((part) => part.mimeType === "text/html")
              .slice(0, 1)),
      ];
      let recordedAttachment = false;
      for (const part of candidates) {
        if (!part.filename && recordedAttachment) continue;
        if (deps.now() > deadline) throw new TimeBudget();
        const name = part.filename || "Email body",
          mime = part.mimeType ?? "application/octet-stream";
        let bytes: Uint8Array;
        if ((part.body?.size ?? 0) > 10 * 1024 * 1024) {
          bytes = Buffer.from(
            `Oversized Gmail attachment: ${messageId}:${name}`,
          );
        } else if (part.body?.data)
          bytes = Buffer.from(part.body.data, "base64url");
        else if (part.body?.attachmentId) {
          const attachment = await gmail.attachment(
            messageId,
            part.body.attachmentId,
          );
          bytes = Buffer.from(attachment.data ?? "", "base64url");
        } else continue;
        const existing = await transaction((sql) =>
          sourceStatus(sql, company, digest(bytes)),
        );
        if (existing) {
          if (part.filename && existing === "RECORDED")
            recordedAttachment = true;
          continue;
        }
        const source: MailSource = {
          name,
          mime,
          bytes,
          receivedAt,
          subject,
          sender,
          sourceUrl: message.sourceUrl,
        };
        let result = await deps.extract(source);
        if ((part.body?.size ?? 0) > 10 * 1024 * 1024)
          result = {
            ...result,
            fields: emptyDocumentFields(),
            relevant: billingMarker(`${subject} ${name}`),
            issues: ["Attachment exceeds 10 MB. Open the original email."],
          };
        if (result.relevant) {
          await transaction((sql) =>
            recordSource(sql, box, messageId, source, result),
          );
          if (part.filename && !result.issues.length) recordedAttachment = true;
        }
      }
    }
    await transaction((sql) =>
      sql.query(
        "INSERT INTO gmail_processed_messages(company_id,mailbox_id,message_id,provider) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [company, id, messageId, box.provider ?? "GMAIL"],
      ),
    );
    processed++;
  }
  const next: Checkpoint = page.nextPageToken
    ? { ...checkpoint, pageToken: page.nextPageToken }
    : checkpoint.phase === "BACKFILL"
      ? {
          phase: "HISTORY",
          historyId:
            box.provider === "MICROSOFT" ? page.historyId : checkpoint.anchor,
        }
      : { phase: "HISTORY", historyId: page.historyId ?? checkpoint.historyId };
  await transaction(async (sql) => {
    await sql.query(
      "UPDATE gmail_mailboxes SET checkpoint=$3,last_synced_at=now(),last_error=NULL WHERE company_id=$1 AND id=$2",
      [company, id, JSON.stringify(next)],
    );
    await event(sql, company, "gmail-worker", "mailbox.synced", {
      mailboxId: id,
      processed,
    });
  });
  return { processed, more: Boolean(page.nextPageToken) };
}
export async function runGmailScheduler() {
  const owner = randomUUID();
  const jobs = await claimMailboxJobs(pool(), owner);
  const outcomes: object[] = [];
  const deadline = Date.now() + 180000;
  for (const job of jobs) {
    if (Date.now() > deadline) {
      await pool().query(
        "UPDATE gmail_sync_jobs SET lease_owner=NULL,lease_until=NULL WHERE mailbox_id=$1 AND lease_owner=$2",
        [job.mailbox_id, owner],
      );
      outcomes.push({ deferred: true });
      continue;
    }
    let error: string | null = null;
    try {
      let result;
      do {
        result = await syncMailbox(
          job.company_id,
          job.mailbox_id,
          owner,
          {},
          deadline,
        );
      } while (result.more && Date.now() < deadline);
      outcomes.push({ ok: true });
    } catch (reason) {
      error =
        reason instanceof GoogleError && [400, 401].includes(reason.status)
          ? "Mailbox authorization expired. Reconnect this mailbox."
          : reason instanceof TimeBudget
            ? "More messages remain; automatic scan will continue."
            : "Mailbox scan will retry automatically.";
      outcomes.push({ ok: false });
      await scoped(job.company_id, "gmail-worker", async (sql) => {
        await sql.query(
          "UPDATE gmail_mailboxes SET last_error=$3 WHERE company_id=$1 AND id=$2 AND EXISTS(SELECT 1 FROM gmail_sync_jobs WHERE mailbox_id=$2 AND lease_owner=$4)",
          [job.company_id, job.mailbox_id, error, owner],
        );
      });
    } finally {
      await pool().query(
        "UPDATE gmail_sync_jobs SET lease_owner=NULL,lease_until=NULL,next_run_at=now()+interval '5 minutes' WHERE company_id=$1 AND mailbox_id=$2 AND lease_owner=$3",
        [job.company_id, job.mailbox_id, owner],
      );
    }
  }
  return { mailboxes: jobs.length, outcomes };
}

export async function claimMailboxJobs(sql: Sql, owner: string) {
  return (
    await sql.query(
      "UPDATE gmail_sync_jobs SET lease_owner=$1,lease_until=now()+interval '5 minutes' WHERE mailbox_id IN (SELECT mailbox_id FROM gmail_sync_jobs WHERE next_run_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 3) RETURNING company_id,mailbox_id",
      [owner],
    )
  ).rows;
}
