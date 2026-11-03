import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  MicrosoftClient,
  graphUrl,
  exchangeMicrosoftToken,
  MICROSOFT_SCOPES,
} from "../lib/server/microsoft/client.ts";
import {
  beginMicrosoftConnect,
  finishMicrosoftConnect,
  microsoftStateCompany,
} from "../lib/server/microsoft/oauth.ts";
import { beginGoogleConnect, stateCompany } from "../lib/server/gmail/oauth.ts";
import { syncMailbox } from "../lib/server/gmail/worker.ts";
import { seal, unseal } from "../lib/server/gmail/crypto.ts";
import { mailboxSourceLink } from "../lib/mailbox-links.ts";
import { providerFromMx } from "../lib/server/mailbox-provider.ts";
import {
  mailboxAutomationConfiguration,
  mailboxConfiguration,
} from "../lib/server/gmail/config.ts";
const key = "45".repeat(32),
  company = "synthetic-ms-company",
  user = "auth0|synthetic-ms-user",
  mailbox = randomUUID(),
  owner = randomUUID();
const invoice = (ref = "MS-100") =>
  `Synthetic Vendor LLC\nInvoice #: ${ref}\nDate: 2026-11-03\nTotal: $100.00`;
async function database() {
  const db = new PGlite();
  for (const file of [
    "001_contractors",
    "002_gmail_documents",
    "003_mailbox_providers",
  ])
    await db.exec(
      await fs.readFile(
        new URL(`../db/migrations/${file}.sql`, import.meta.url),
        "utf8",
      ),
    );
  await db.query("INSERT INTO workspaces(id) VALUES($1)", [company]);
  await db.query(
    "INSERT INTO document_company_memberships(company_id,user_id,company_name,roles) VALUES($1,$2,$3,$4)",
    [company, user, "Synthetic Company", ["FINANCE"]],
  );
  await db.query(
    "INSERT INTO gmail_mailboxes(id,company_id,email,connected_by,credentials,provider) VALUES($1,$2,$3,$4,$5,$6)",
    [
      mailbox,
      company,
      "billing@example.test",
      user,
      seal(
        JSON.stringify({
          accessToken: "synthetic-ms-access",
          refreshToken: "synthetic-ms-refresh",
          expiresAt: Date.now() + 3600000,
        }),
        `gmail-token:${company}:${mailbox}`,
        key,
      ),
      "MICROSOFT",
    ],
  );
  await db.query(
    "INSERT INTO gmail_sync_jobs(mailbox_id,company_id,lease_owner,lease_until) VALUES($1,$2,$3,now()+interval '5 minutes')",
    [mailbox, company, owner],
  );
  const transaction = async (c, u, action) =>
    db.transaction(async (tx) => {
      await tx.query(
        "SELECT set_config('paycore.workspace_id',$1,true),set_config('paycore.user_id',$2,true)",
        [c, u],
      );
      return action(tx);
    });
  return { db, transaction };
}
function graphMessage(id, text = invoice(id), attachment = false) {
  return {
    id,
    subject: "Invoice",
    from: {
      emailAddress: {
        name: "Synthetic Vendor",
        address: "vendor@example.test",
      },
    },
    body: {
      contentType: "text",
      content: attachment ? "See attached invoice." : text,
    },
    receivedDateTime: "2026-11-03T12:00:00Z",
    parentFolderId: "inbox-immutable",
    hasAttachments: attachment,
    webLink: `https://outlook.office.com/mail/deeplink/read/${id}`,
  };
}
const next =
  "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$skiptoken=second";
const delta =
  "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=next-check";
test("Microsoft-hosted MX records are identified independently from Gmail and unknown providers", () => {
  assert.equal(
    providerFromMx([{ exchange: "tenant.mail.protection.outlook.com." }]),
    "MICROSOFT",
  );
  assert.equal(
    providerFromMx([{ exchange: "ALT1.ASPMX.L.GOOGLE.COM." }]),
    "GMAIL",
  );
  assert.equal(providerFromMx([{ exchange: "mx.example.test" }]), "UNKNOWN");
});
test("Graph cursor/source validation prevents bearer-token forwarding or unsafe document links", async () => {
  for (const value of [
    "https://attacker.example/v1.0/me/messages/delta",
    "http://graph.microsoft.com/v1.0/me/messages/delta",
    "https://graph.microsoft.com.evil.test/v1.0/me/messages/delta",
    "https://user:pass@graph.microsoft.com/v1.0/me/messages/delta",
  ])
    assert.throws(() => graphUrl(value, true));
  let calls = 0;
  const client = new MicrosoftClient("fake", async () => {
    calls++;
    return Response.json({
      value: [],
      "@odata.nextLink": "https://attacker.example/steal",
    });
  });
  await assert.rejects(() => client.inboxPage(), /continuation/);
  assert.equal(calls, 1);
  assert.ok(
    mailboxSourceLink(
      "MICROSOFT",
      "billing@example.test",
      "msg",
      "javascript:alert(1)",
    ).startsWith("https://outlook.office.com/"),
  );
  assert.equal(
    mailboxSourceLink(
      "MICROSOFT",
      "billing@example.test",
      "msg",
      "https://outlook.office365.com/owa/?ItemID=abc",
    ),
    "https://outlook.office365.com/owa/?ItemID=abc",
  );
  assert.ok(
    mailboxSourceLink(
      "GMAIL",
      "billing@example.test",
      "msg",
      "https://attacker.example",
    ).startsWith("https://mail.google.com/"),
  );
});
test("Microsoft Graph inbox delta pages use immutable IDs, preserve the delta token and download real file attachments", async () => {
  const calls = [];
  const client = new MicrosoftClient(
    "synthetic-ms-access",
    async (url, options) => {
      calls.push({ url, options });
      const path = new URL(url).pathname;
      const query = new URL(url).searchParams;
      if (path.endsWith("/me"))
        return Response.json({
          mail: "billing@example.test",
          userPrincipalName: "other@example.test",
        });
      if (path.endsWith("/mailFolders/inbox"))
        return Response.json({ id: "inbox-immutable" });
      if (path.endsWith("/messages/delta"))
        return Response.json(
          query.has("$skiptoken")
            ? { value: [{ id: "two" }], "@odata.deltaLink": delta }
            : {
                value: [
                  { id: "one" },
                  { id: "removed", "@removed": { reason: "deleted" } },
                ],
                "@odata.nextLink": next,
              },
        );
      if (path.endsWith("/attachments/file-1"))
        return Response.json({
          "@odata.type": "#microsoft.graph.fileAttachment",
          contentBytes: Buffer.from(invoice("ATT-100")).toString("base64"),
        });
      if (path.endsWith("/attachments"))
        return Response.json({
          value: [
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              id: "file-1",
              name: "invoice.txt",
              contentType: "text/plain",
              size: 100,
              isInline: false,
            },
          ],
        });
      if (path.endsWith("/messages/two"))
        return Response.json(graphMessage("two", undefined, true));
      throw Error("Unexpected Graph request");
    },
  );
  assert.equal((await client.profile()).emailAddress, "billing@example.test");
  const first = await client.inboxPage();
  assert.deepEqual(first.messages, [{ id: "one" }]);
  assert.equal(first.nextPageToken, next);
  const second = await client.inboxPage(next);
  assert.equal(second.historyId, delta);
  const message = await client.message("two");
  assert.deepEqual(message.labelIds, ["INBOX"]);
  assert.equal(message.payload.parts[1].body.attachmentId, "file-1");
  const body = await client.attachment("two", "file-1");
  assert.equal(
    Buffer.from(body.data, "base64url").toString(),
    invoice("ATT-100"),
  );
  for (const call of calls) {
    assert.ok(call.url.startsWith("https://graph.microsoft.com/"));
    assert.equal(
      call.options.headers.Authorization,
      "Bearer synthetic-ms-access",
    );
    assert.ok(call.options.headers.Prefer.includes("ImmutableId"));
  }
});
test("Microsoft mailbox contents flow automatically through the shared worker, database and provider-specific original links", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    let history = false;
    const fake = async (url) => {
      const parsed = new URL(url),
        path = parsed.pathname;
      if (path.endsWith("/me"))
        return Response.json({ mail: "billing@example.test" });
      if (path.endsWith("/mailFolders/inbox"))
        return Response.json({ id: "inbox-immutable" });
      if (path.endsWith("/messages/delta")) {
        if (parsed.searchParams.has("$deltatoken")) {
          history = true;
          return Response.json({
            value: [{ id: "one" }],
            "@odata.deltaLink": delta,
          });
        }
        return Response.json({
          value: [{ id: "one" }],
          "@odata.deltaLink": delta,
        });
      }
      if (path.endsWith("/messages/one"))
        return Response.json(graphMessage("one"));
      throw Error("Unexpected URL");
    };
    const dependencies = {
      transaction,
      client: (token, provider) => {
        assert.equal(provider, "MICROSOFT");
        return new MicrosoftClient(token, fake);
      },
    };
    await syncMailbox(company, mailbox, owner, dependencies);
    let row = (await db.query("SELECT * FROM incoming_documents")).rows[0];
    assert.equal(row.status, "RECORDED");
    assert.equal(row.source_provider, "MICROSOFT");
    assert.ok(row.source_url.startsWith("https://outlook.office.com/"));
    assert.equal(row.fields.amount, "100.00");
    assert.equal(
      (await db.query("SELECT checkpoint FROM gmail_mailboxes")).rows[0]
        .checkpoint.historyId,
      delta,
    );
    await syncMailbox(company, mailbox, owner, dependencies);
    assert.ok(history);
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM incoming_documents")).rows[0]
        .n,
      1,
    );
    assert.equal(
      (await db.query("SELECT provider FROM gmail_processed_messages")).rows[0]
        .provider,
      "MICROSOFT",
    );
  } finally {
    await db.close();
  }
});
test("provider-specific processed identities do not hide a Microsoft message that shares an old Gmail ID", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    await db.query(
      "INSERT INTO gmail_processed_messages(company_id,mailbox_id,message_id,provider) VALUES($1,$2,'one','GMAIL')",
      [company, mailbox],
    );
    const gmailShaped = {
      profile: async () => ({
        emailAddress: "billing@example.test",
        historyId: "microsoft-delta",
      }),
      inboxPage: async () => ({ messages: [{ id: "one" }], historyId: delta }),
      message: async () => ({
        labelIds: ["INBOX"],
        internalDate: "1793707200000",
        sourceUrl: "https://outlook.office.com/mail/deeplink/read/one",
        payload: {
          mimeType: "text/plain",
          headers: [{ name: "Subject", value: "Invoice" }],
          body: { data: Buffer.from(invoice()).toString("base64url") },
        },
      }),
    };
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => gmailShaped,
    });
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM gmail_processed_messages"))
        .rows[0].n,
      2,
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM incoming_documents")).rows[0]
        .n,
      1,
    );
  } finally {
    await db.close();
  }
});
test("Microsoft token refresh rotates encrypted credentials using the Microsoft provider, not Google", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    await db.query("UPDATE gmail_mailboxes SET credentials=$1", [
      seal(
        JSON.stringify({
          accessToken: "old",
          refreshToken: "old-ms-refresh",
          expiresAt: 0,
        }),
        `gmail-token:${company}:${mailbox}`,
        key,
      ),
    ]);
    await syncMailbox(company, mailbox, owner, {
      transaction,
      refresh: async (params, provider) => {
        assert.equal(provider, "MICROSOFT");
        assert.equal(params.refresh_token, "old-ms-refresh");
        return {
          access_token: "rotated-ms",
          refresh_token: "rotated-ms-refresh",
          expires_in: 3600,
        };
      },
      client: (token) => {
        assert.equal(token, "rotated-ms");
        return {
          profile: async () => ({ historyId: "microsoft-delta" }),
          inboxPage: async () => ({ messages: [], historyId: delta }),
        };
      },
    });
    const stored = (await db.query("SELECT credentials FROM gmail_mailboxes"))
      .rows[0].credentials;
    assert.ok(!stored.includes("rotated-ms-refresh"));
    assert.equal(
      JSON.parse(unseal(stored, `gmail-token:${company}:${mailbox}`, key))
        .refreshToken,
      "rotated-ms-refresh",
    );
  } finally {
    await db.close();
  }
});
test("Microsoft OAuth has read-only delegated scopes, PKCE, owner binding and single-use provider-isolated state", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  process.env.APP_BASE_URL = "https://paycore.example.test";
  process.env.MICROSOFT_CLIENT_ID = "synthetic-ms-client";
  const { db, transaction } = await database();
  try {
    const url = new URL(
      await beginMicrosoftConnect(company, user, transaction),
    );
    assert.equal(url.hostname, "login.microsoftonline.com");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("scope"), MICROSOFT_SCOPES);
    assert.ok(!url.searchParams.get("scope").includes("Mail.Send"));
    assert.ok(!url.searchParams.get("scope").includes("Mail.ReadWrite"));
    const state = url.searchParams.get("state");
    assert.equal(microsoftStateCompany(state), company);
    assert.throws(() => stateCompany(state));
    const google = new URL(
      await beginGoogleConnect(company, user, transaction),
    );
    assert.throws(() =>
      microsoftStateCompany(google.searchParams.get("state")),
    );
    const dependencies = {
      transaction,
      exchange: async (params) => {
        assert.ok(params.code_verifier);
        assert.ok(params.redirect_uri.endsWith("/api/microsoft/callback"));
        return {
          access_token: "ms-access",
          refresh_token: "ms-refresh",
          expires_in: 3600,
          scope: "User.Read Mail.Read",
        };
      },
      profile: async () => ({
        emailAddress: "new-ms@example.test",
        historyId: "microsoft-delta",
      }),
    };
    await assert.rejects(
      () =>
        finishMicrosoftConnect(
          company,
          "other-user",
          state,
          "synthetic-code",
          dependencies,
        ),
      /expired/,
    );
    await finishMicrosoftConnect(
      company,
      user,
      state,
      "synthetic-code",
      dependencies,
    );
    const row = (
      await db.query("SELECT provider FROM gmail_mailboxes WHERE email=$1", [
        "new-ms@example.test",
      ])
    ).rows[0];
    assert.equal(row.provider, "MICROSOFT");
    await assert.rejects(
      () =>
        finishMicrosoftConnect(
          company,
          user,
          state,
          "synthetic-code",
          dependencies,
        ),
      /expired/,
    );
  } finally {
    await db.close();
  }
});
test("Google credentials are not required when the Microsoft connector and common services are configured", () => {
  const before = { ...process.env };
  try {
    for (const field of [
      "AUTH0_DOMAIN",
      "AUTH0_CLIENT_ID",
      "AUTH0_CLIENT_SECRET",
      "AUTH0_SECRET",
      "APP_BASE_URL",
      "DATABASE_URL",
      "CRON_SECRET",
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
    ])
      process.env[field] = "synthetic";
    process.env.GMAIL_ENCRYPTION_KEY = key;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    assert.equal(mailboxConfiguration("MICROSOFT").ready, true);
    assert.equal(mailboxConfiguration("GMAIL").ready, false);
    assert.equal(mailboxAutomationConfiguration().ready, true);
    assert.equal(
      mailboxAutomationConfiguration().providers.MICROSOFT.ready,
      true,
    );
  } finally {
    for (const field of Object.keys(process.env))
      if (!(field in before)) delete process.env[field];
    Object.assign(process.env, before);
  }
});
test("Microsoft token exchange uses its authority and never sends secrets to a cursor-supplied host", async () => {
  let target, body;
  const result = await exchangeMicrosoftToken(
    { grant_type: "refresh_token", refresh_token: "synthetic-refresh" },
    async (url, options) => {
      target = url;
      body = options.body;
      return Response.json({
        access_token: "synthetic-access",
        refresh_token: "rotated",
        expires_in: 3600,
        scope: "User.Read Mail.Read",
      });
    },
  );
  assert.ok(
    target.startsWith("https://login.microsoftonline.com/organizations/"),
  );
  assert.equal(body.get("grant_type"), "refresh_token");
  assert.ok(body.get("scope").includes("offline_access"));
  assert.equal(result.refresh_token, "rotated");
});

test("expired Microsoft delta state restarts the backlog without losing existing records", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    await db.query("UPDATE gmail_mailboxes SET checkpoint=$1", [
      JSON.stringify({ phase: "HISTORY", historyId: delta }),
    ]);
    const fake = new MicrosoftClient(
      "fake",
      async () => new Response("", { status: 410 }),
    );
    const result = await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => fake,
    });
    assert.equal(result.reset, true);
    assert.equal(
      (await db.query("SELECT checkpoint FROM gmail_mailboxes")).rows[0]
        .checkpoint.phase,
      "BACKFILL",
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM incoming_documents")).rows[0]
        .n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("a provider change preserves historical Gmail links and cannot reuse a Google refresh token", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  process.env.APP_BASE_URL = "https://paycore.example.test";
  const { db, transaction } = await database();
  try {
    const { recordSource } = await import("../lib/server/gmail/repository.ts");
    const { extractBilling } = await import("../lib/server/gmail/extract.ts");
    await db.query("UPDATE gmail_mailboxes SET provider='GMAIL'");
    const box = (await db.query("SELECT * FROM gmail_mailboxes")).rows[0],
      source = {
        name: "old-invoice.txt",
        mime: "text/plain",
        bytes: Buffer.from(invoice("OLD-100")),
        receivedAt: "2026-11-03T12:00:00Z",
        subject: "Invoice",
        sender: "Vendor <vendor@example.test>",
      };
    const parsed = await extractBilling(source);
    await transaction(company, user, (sql) =>
      recordSource(sql, box, "google-old-id", source, parsed),
    );
    const dependencies = {
      transaction,
      exchange: async () => ({
        access_token: "ms-new",
        expires_in: 3600,
        scope: "User.Read Mail.Read",
      }),
      profile: async () => ({
        emailAddress: "billing@example.test",
        historyId: "microsoft-delta",
      }),
    };
    let state = new URL(
      await beginMicrosoftConnect(company, user, transaction),
    ).searchParams.get("state");
    await assert.rejects(
      () =>
        finishMicrosoftConnect(
          company,
          user,
          state,
          "synthetic-code",
          dependencies,
        ),
      /Offline/,
    );
    assert.equal(
      (await db.query("SELECT provider FROM gmail_mailboxes")).rows[0].provider,
      "GMAIL",
    );
    state = new URL(
      await beginMicrosoftConnect(company, user, transaction),
    ).searchParams.get("state");
    await finishMicrosoftConnect(company, user, state, "synthetic-code", {
      ...dependencies,
      exchange: async () => ({
        access_token: "ms-new",
        refresh_token: "ms-new-refresh",
        expires_in: 3600,
        scope: "User.Read Mail.Read",
      }),
    });
    assert.equal(
      (await db.query("SELECT provider FROM gmail_mailboxes")).rows[0].provider,
      "MICROSOFT",
    );
    const old = (
      await db.query(
        "SELECT source_provider,source_url FROM incoming_documents",
      )
    ).rows[0];
    assert.equal(old.source_provider, "GMAIL");
    assert.ok(old.source_url.startsWith("https://mail.google.com/"));
    assert.equal(
      (await db.query("SELECT lease_owner FROM gmail_sync_jobs")).rows[0]
        .lease_owner,
      null,
    );
  } finally {
    await db.close();
  }
});

test("a message that disappears during fetching can still be imported when restored to the Inbox", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    const { GoogleError } = await import("../lib/server/gmail/client.ts");
    await db.query("UPDATE gmail_mailboxes SET checkpoint=$1", [
      JSON.stringify({ phase: "HISTORY", historyId: delta }),
    ]);
    let removed = true;
    const client = {
      historyPage: async () => ({
        history: [{ messagesAdded: [{ message: { id: "restored" } }] }],
        historyId: delta,
      }),
      message: async () => {
        if (removed) throw new GoogleError(404);
        return {
          labelIds: ["INBOX"],
          internalDate: "1793707200000",
          sourceUrl: "https://outlook.office.com/mail/deeplink/read/restored",
          payload: {
            mimeType: "text/plain",
            headers: [{ name: "Subject", value: "Invoice" }],
            body: {
              data: Buffer.from(invoice("RESTORED-100")).toString("base64url"),
            },
          },
        };
      },
    };
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => client,
    });
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM gmail_processed_messages"))
        .rows[0].n,
      0,
    );
    removed = false;
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => client,
    });
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM incoming_documents")).rows[0]
        .n,
      1,
    );
  } finally {
    await db.close();
  }
});
