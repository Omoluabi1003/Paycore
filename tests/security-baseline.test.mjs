import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { configuredOrigin, requireSameOrigin, HttpError } from "../lib/server/security/http.ts";
import { securityHeaders, privateHeaders } from "../lib/server/security/headers.ts";
import { resolveCompanyAccess } from "../lib/server/access.ts";
import { readDocuments } from "../lib/server/gmail/read-documents.ts";

const origin = "https://paycore.example.test";
test("mutation protection requires the configured origin and rejects cross-site browser metadata", () => {
  const request = (headers, method = "POST") => new Request(`${origin}/api/gmail/disconnect`, { method, headers });
  requireSameOrigin(request({ origin, "sec-fetch-site": "same-origin" }), origin);
  requireSameOrigin(request({ origin }), origin); // Older clients without Fetch Metadata still need Origin.
  for (const headers of [ {}, { origin: "null" }, { origin: "https://attacker.example.test", host: "paycore.example.test" }, { origin: `${origin}.attacker.test` }, { origin, "sec-fetch-site": "cross-site" }, { origin, "sec-fetch-site": "same-site" } ])
    assert.throws(() => requireSameOrigin(request(headers), origin), error => error instanceof HttpError && error.status === 403);
  assert.throws(() => requireSameOrigin(request({ origin }, "GET"), origin), HttpError);
});

test("deployment origin cannot use remote HTTP, credentials, query strings or redirect fragments", () => {
  assert.equal(configuredOrigin(`${origin}/`), origin);
  assert.equal(configuredOrigin("http://localhost:3057"), "http://localhost:3057");
  for (const value of [ "", "http://paycore.example.test", "https://user:password@paycore.example.test", `${origin}/other`, `${origin}?next=attacker`, `${origin}#fragment`, "file:///tmp/paycore" ])
    assert.throws(() => configuredOrigin(value));
});

test("security baseline prevents cross-origin framing, MIME sniffing, referrer leakage and private caching", () => {
  const headers = new Headers(securityHeaders.map(({ key, value }) => [key, value]));
  assert.equal(headers.get("referrer-policy"), "no-referrer");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(headers.get("content-security-policy"), /frame-ancestors 'self'/);
  assert.match(headers.get("content-security-policy"), /base-uri 'none'/);
  assert.match(headers.get("content-security-policy"), /form-action 'self' https:\/\/login\.microsoftonline\.com https:\/\/accounts\.google\.com/);
  const cache = new Headers(privateHeaders.map(({ key, value }) => [key, value]));
  assert.match(cache.get("cache-control"), /private, no-store/);
  assert.equal(cache.get("cdn-cache-control"), "no-store");
  assert.equal(cache.get("vercel-cdn-cache-control"), "no-store");
});

async function capability(companyId, userId, roles = ["AUDITOR"]) {
  const now = Date.now();
  return resolveCompanyAccess({
    verifySession: async () => ({ userId, expiresAt: now + 60000, authenticatedAt: now, assurance: "PASSWORD", revoked: false }),
    findMembership: async () => ({ userId, companyId, roles, active: true }),
  }, "synthetic-verified-session", companyId, now);
}

test("document reads require a real company capability and commit minimal append-only access evidence", async () => {
  const db = new PGlite(), company = "audit-company", user = "auth0|synthetic-auditor", mailbox = randomUUID(), id = randomUUID();
  try {
    for (const name of ["001_contractors", "002_gmail_documents", "003_mailbox_providers", "004_mailbox_owner"])
      await db.exec(await fs.readFile(new URL(`../db/migrations/${name}.sql`, import.meta.url), "utf8"));
    await db.query("INSERT INTO workspaces(id) VALUES($1),($2)", [company, "other-audit-company"]);
    await db.query("INSERT INTO gmail_mailboxes(id,company_id,email,connected_by,credentials) VALUES($1,$2,$3,$4,$5)", [mailbox,company,"synthetic@example.test",user,"synthetic-encrypted-credentials"]);
    await db.query("INSERT INTO incoming_documents(id,company_id,mailbox_id,message_id,source_name,sha256,source_encrypted,fields,status,issues,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())", [id,company,mailbox,"synthetic-message","synthetic-invoice.txt","a".repeat(64),"synthetic-encrypted-source",JSON.stringify({ vendor: "Synthetic Vendor", amount: "100.00" }),"RECORDED",[]]);
    await db.exec("CREATE ROLE read_audit_runtime; GRANT USAGE ON SCHEMA public TO read_audit_runtime; GRANT SELECT ON incoming_documents,gmail_mailboxes,gmail_document_events TO read_audit_runtime; GRANT INSERT ON gmail_document_events TO read_audit_runtime; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO read_audit_runtime");
    const transaction = (c, u, fn) => db.transaction(async sql => {
      await sql.exec("SET LOCAL ROLE read_audit_runtime");
      await sql.query("SELECT set_config('paycore.workspace_id',$1,true),set_config('paycore.user_id',$2,true)", [c,u]);
      return fn(sql);
    });
    const access = await capability(company,user);
    let touched = false;
    await assert.rejects(() => readDocuments({ ...access }, "RECORDED", 0, async () => { touched = true; }), /access/);
    await assert.rejects(async () => readDocuments(await capability(company,user,["CONTRACTOR"]), "RECORDED", 0, transaction));
    assert.equal(touched,false);
    const result = await readDocuments(access,"RECORDED",0,transaction);
    assert.equal(result.documents[0].id,id);
    assert.equal(result.hasMore,false);
    const audit = (await db.query("SELECT * FROM gmail_document_events")).rows[0];
    assert.equal(audit.actor,user);
    assert.equal(audit.company_id,company);
    assert.equal(audit.action,"documents.read");
    assert.deepEqual(audit.details,{ status:"RECORDED",page:0,count:1,documentIds:[id] });
    assert.ok(!JSON.stringify(audit.details).includes("Synthetic Vendor"));
    const other = await readDocuments(await capability("other-audit-company",user),"RECORDED",0,transaction);
    assert.deepEqual(other.documents,[]);
    await assert.rejects(() => db.query("UPDATE gmail_document_events SET action='changed'"),/append-only/);
    await assert.rejects(() => readDocuments(access,"RECORDED",-1,transaction),/Invalid document query/);
    // Missing audit-write permission must fail the entire read, not silently return records.
    await db.exec("REVOKE INSERT ON gmail_document_events FROM read_audit_runtime");
    await assert.rejects(() => readDocuments(access,"RECORDED",0,transaction), /permission denied/);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM gmail_document_events")).rows[0].count,2);
  } finally { await db.close(); }
});
