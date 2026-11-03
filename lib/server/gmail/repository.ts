import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DocumentFieldsSchema, documentIssues } from "../../document-import.ts";
import type { Sql } from "./database.ts";
import { seal, unseal, digest } from "./crypto.ts";
import type { Credentials } from "./client.ts";
import type { MailSource, ExtractedBilling } from "./extract.ts";
export const CheckpointSchema = z.object({
  phase: z.enum(["BACKFILL", "HISTORY"]),
  anchor: z.string().optional(),
  pageToken: z.string().optional(),
  historyId: z.string().optional(),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;
export type Mailbox = {
  id: string;
  company_id: string;
  email: string;
  credentials: string;
  checkpoint: Checkpoint;
  active: boolean;
};
export async function event(
  sql: Sql,
  company: string,
  actor: string,
  action: string,
  details: object = {},
) {
  await sql.query(
    "INSERT INTO gmail_document_events(company_id,actor,action,details) VALUES($1,$2,$3,$4)",
    [company, actor, action, JSON.stringify(details)],
  );
}
export async function assertLease(
  sql: Sql,
  company: string,
  mailbox: string,
  owner: string,
) {
  const row = (
    await sql.query(
      "SELECT j.mailbox_id FROM gmail_sync_jobs j JOIN gmail_mailboxes m ON m.id=j.mailbox_id AND m.company_id=j.company_id WHERE j.company_id=$1 AND j.mailbox_id=$2 AND j.lease_owner=$3 AND j.lease_until>now() AND m.active=true FOR UPDATE OF j,m",
      [company, mailbox, owner],
    )
  ).rows[0];
  if (!row) throw Error("Mailbox lease expired or connection was removed.");
}
export function credentials(box: Mailbox): Credentials {
  return z
    .object({
      accessToken: z.string().min(1),
      refreshToken: z.string().min(1),
      expiresAt: z.number().finite(),
    })
    .parse(
      JSON.parse(
        unseal(box.credentials, `gmail-token:${box.company_id}:${box.id}`),
      ),
    );
}
export async function saveCredentials(
  sql: Sql,
  box: Mailbox,
  value: Credentials,
) {
  await sql.query(
    "UPDATE gmail_mailboxes SET credentials=$3 WHERE company_id=$1 AND id=$2 AND active=true",
    [
      box.company_id,
      box.id,
      seal(JSON.stringify(value), `gmail-token:${box.company_id}:${box.id}`),
    ],
  );
}
export async function sourceExists(sql: Sql, company: string, sha: string) {
  return Boolean(
    (
      await sql.query(
        "SELECT id FROM incoming_documents WHERE company_id=$1 AND sha256=$2",
        [company, sha],
      )
    ).rows[0],
  );
}
export async function recordSource(
  sql: Sql,
  box: Mailbox,
  messageId: string,
  source: MailSource,
  result: ExtractedBilling,
) {
  const sha = digest(source.bytes);
  await sql.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    JSON.stringify([
      box.company_id,
      result.fields.vendor.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      result.fields.reference.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    ]),
  ]);
  if (await sourceExists(sql, box.company_id, sha)) return false;
  const fields = DocumentFieldsSchema.parse(result.fields),
    issues = [...new Set([...result.issues, ...documentIssues(fields)])];
  if (fields.vendor && fields.reference) {
    const duplicate = (
      await sql.query(
        "SELECT id FROM incoming_documents WHERE company_id=$1 AND regexp_replace(upper(fields->>'vendor'),'[^A-Z0-9]','','g')=$2 AND regexp_replace(upper(fields->>'reference'),'[^A-Z0-9]','','g')=$3 LIMIT 1",
        [
          box.company_id,
          fields.vendor.toUpperCase().replace(/[^A-Z0-9]/g, ""),
          fields.reference.toUpperCase().replace(/[^A-Z0-9]/g, ""),
        ],
      )
    ).rows[0];
    if (duplicate)
      issues.push("Possible duplicate vendor and invoice/receipt number.");
  }
  const id = randomUUID();
  const sourceEncrypted = seal(
    JSON.stringify({
      mime: source.mime,
      data: Buffer.from(source.bytes).toString("base64"),
    }),
    `gmail-source:${box.company_id}:${id}`,
  );
  const inserted = await sql.query(
    "INSERT INTO incoming_documents(id,company_id,mailbox_id,message_id,source_name,sha256,source_encrypted,fields,status,issues,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(company_id,sha256) DO NOTHING RETURNING id",
    [
      id,
      box.company_id,
      box.id,
      messageId,
      source.name.slice(0, 180),
      sha,
      sourceEncrypted,
      JSON.stringify(fields),
      issues.length ? "EXCEPTION" : "RECORDED",
      issues,
      source.receivedAt,
    ],
  );
  if (!inserted.rows.length) return false;
  await event(
    sql,
    box.company_id,
    "gmail-worker",
    issues.length ? "document.exception" : "document.recorded",
    { documentId: id, mailboxId: box.id, messageId },
  );
  return true;
}

export async function sourceStatus(sql: Sql, company: string, sha: string) {
  return (
    await sql.query(
      "SELECT status FROM incoming_documents WHERE company_id=$1 AND sha256=$2",
      [company, sha],
    )
  ).rows[0]?.status as string | undefined;
}

export async function listDocumentMemberships(sql: Sql, userId: string) {
  return (
    await sql.query(
      "SELECT company_id,company_name,roles FROM document_company_memberships WHERE user_id=$1 AND active=true AND roles && $2::text[] ORDER BY company_name",
      [
        userId,
        [
          "OWNER_ADMIN",
          "FINANCE",
          "AUDITOR",
          "PAYROLL_SPECIALIST",
          "PAYROLL_MANAGER",
        ],
      ],
    )
  ).rows;
}
