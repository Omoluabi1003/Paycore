import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { seal, unseal, cronAuthorized } from "../lib/server/gmail/crypto.ts";
import { extractBilling, messageParts } from "../lib/server/gmail/extract.ts";
import { syncMailbox } from "../lib/server/gmail/worker.ts";
import { recordSource } from "../lib/server/gmail/repository.ts";
import {
  GoogleError,
  GmailClient,
  exchangeToken,
  GMAIL_SCOPE,
} from "../lib/server/gmail/client.ts";
const key = "12".repeat(32),
  company = "test-company",
  user = "auth0|synthetic-user",
  mailbox = randomUUID(),
  owner = randomUUID();
const billing =
  "Synthetic Vendor LLC\nInvoice #: TEST-100\nDate: 2026-11-03\nAddress: 100 Example Road\nPhone: 555-0100\nTotal: $100.00";
const source = {
  name: "test-invoice.txt",
  mime: "text/plain",
  bytes: Buffer.from(billing),
  receivedAt: "2026-11-03T12:00:00Z",
  subject: "Invoice TEST-100",
  sender: "Synthetic Vendor <vendor@example.test>",
};
function message(text = billing, labels = ["INBOX"]) {
  return {
    labelIds: labels,
    internalDate: String(Date.parse(source.receivedAt)),
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "Subject", value: "Your invoice" },
        { name: "From", value: source.sender },
      ],
      body: { data: Buffer.from(text).toString("base64url") },
    },
  };
}
async function database() {
  const db = new PGlite();
  await db.exec(
    await fs.readFile(
      new URL("../db/migrations/001_contractors.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await fs.readFile(
      new URL("../db/migrations/002_gmail_documents.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(await fs.readFile(new URL("../db/migrations/003_mailbox_providers.sql",import.meta.url),"utf8"));
  await db.exec(await fs.readFile(new URL("../db/migrations/004_mailbox_owner.sql",import.meta.url),"utf8"));
  await db.query("INSERT INTO workspaces(id) VALUES($1),($2)", [
    company,
    "other-company",
  ]);
  await db.query(
    "INSERT INTO document_company_memberships(company_id,user_id,company_name,roles) VALUES($1,$2,$3,$4)",
    [company, user, "Synthetic Company", ["FINANCE"]],
  );
  await db.query(
    "INSERT INTO gmail_mailboxes(id,company_id,email,connected_by,credentials) VALUES($1,$2,$3,$4,$5)",
    [
      mailbox,
      company,
      "vendor@example.test",
      user,
      seal(
        JSON.stringify({
          accessToken: "synthetic-access",
          refreshToken: "synthetic-refresh",
          expiresAt: Date.now() + 3600000,
        }),
        `gmail-token:${company}:${mailbox}`,
        key,
      ),
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
test("encrypted credentials/source bytes cannot be opened for another company and cron denies missing/incorrect secrets", () => {
  const encrypted = seal("synthetic refresh token", "company-a:mailbox", key);
  assert.ok(!encrypted.includes("synthetic"));
  assert.equal(
    unseal(encrypted, "company-a:mailbox", key),
    "synthetic refresh token",
  );
  assert.throws(() => unseal(encrypted, "company-b:mailbox", key));
  assert.throws(() => unseal(encrypted + "x", "company-a:mailbox", key));
  assert.equal(cronAuthorized(null, undefined), false);
  assert.equal(cronAuthorized("Bearer wrong", "secret"), false);
  assert.equal(cronAuthorized("Bearer secret", "secret"), true);
});
test("plain/HTML billing is extracted without approval, while unreadable and ambiguous documents become exceptions", async () => {
  const parsed = await extractBilling(source);
  assert.equal(parsed.fields.vendor, "Synthetic Vendor LLC");
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.relevant, true);
  const ambiguous = await extractBilling({
    ...source,
    bytes: Buffer.from(billing + "\nGrand total: $200.00"),
  });
  assert.ok(ambiguous.issues.length);
  const image = await extractBilling({ ...source, mime: "image/png" });
  assert.ok(image.issues.length);
  const html = await extractBilling({
    ...source,
    mime: "text/html",
    bytes: Buffer.from(
      billing
        .split("\n")
        .map((line) => `<p>${line}</p>`)
        .join(""),
    ),
  });
  assert.equal(html.fields.amount, "100.00");
  const invalid = await extractBilling({ ...source, mime: "application/pdf" });
  assert.ok(invalid.issues.length);
});
test("MIME traversal finds real attachments, nested text and excludes incidental inline logos", () => {
  const result = messageParts({
    parts: [
      {
        filename: "logo.png",
        mimeType: "image/png",
        headers: [{ name: "Content-Disposition", value: "inline" }],
        body: { data: "AA" },
      },
      { parts: [{ mimeType: "text/plain", body: { data: "AA" } }] },
      { filename: "invoice.pdf", body: { attachmentId: "attachment-1" } },
    ],
  });
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].filename, "invoice.pdf");
  assert.equal(result.bodies.length, 1);
});
test("worker automatically scans backlog, persists structured records and advances to incremental history without manual review", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    const gmail = {
      profile: async () => ({
        historyId: "100",
        emailAddress: "vendor@example.test",
      }),
      inboxPage: async () => ({
        messages: [{ id: "message-1" }, { id: "not-billing" }],
      }),
      message: async (id) => {
        const value =
          id === "message-1" ? message() : message("Ordinary team update");
        if (id !== "message-1") value.payload.headers[0].value = "Team update";
        return value;
      },
    };
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => gmail,
    });
    const rows = (await db.query("SELECT * FROM incoming_documents")).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "RECORDED");
    assert.equal(rows[0].fields.amount, "100.00");
    assert.ok(!rows[0].source_encrypted.includes("Synthetic"));
    assert.deepEqual(
      (await db.query("SELECT checkpoint FROM gmail_mailboxes")).rows[0]
        .checkpoint,
      { phase: "HISTORY", historyId: "100" },
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM gmail_processed_messages"))
        .rows[0].n,
      2,
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM gmail_document_events"))
        .rows[0].n,
      2,
    );
  } finally {
    await db.close();
  }
});
test("pagination survives retries, repeated files do not duplicate records, and ambiguous vendor/reference repeats are isolated", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    let second = false;
    const gmail = {
      profile: async () => ({ historyId: "100" }),
      inboxPage: async (token) => {
        if (!token) return { messages: [{ id: "one" }], nextPageToken: "next" };
        second = true;
        return { messages: [{ id: "two" }, { id: "three" }] };
      },
      message: async (id) =>
        message(id === "three" ? billing + "\nAnother source note" : billing),
    };
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => gmail,
    });
    assert.equal(
      (await db.query("SELECT checkpoint FROM gmail_mailboxes")).rows[0]
        .checkpoint.pageToken,
      "next",
    );
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => gmail,
    });
    assert.ok(second);
    const rows = (
      await db.query(
        "SELECT status,issues FROM incoming_documents ORDER BY recorded_at,id",
      )
    ).rows;
    assert.equal(rows.length, 2);
    assert.equal(rows.filter((row) => row.status === "RECORDED").length, 1);
    assert.equal(rows.filter((row) => row.status === "EXCEPTION").length, 1);
    assert.match(
      rows.find((row) => row.status === "EXCEPTION").issues.join(" "),
      /duplicate/,
    );
  } finally {
    await db.close();
  }
});
test("a transient Gmail error retains its checkpoint and processed state for a safe retry", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    const gmail = {
      profile: async () => ({ historyId: "100" }),
      inboxPage: async () => ({
        messages: [{ id: "one" }],
        nextPageToken: "next",
      }),
      message: async () => {
        throw new GoogleError(429);
      },
    };
    await assert.rejects(() =>
      syncMailbox(company, mailbox, owner, {
        transaction,
        client: () => gmail,
      }),
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM incoming_documents")).rows[0]
        .n,
      0,
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM gmail_processed_messages"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("SELECT checkpoint FROM gmail_mailboxes")).rows[0]
        .checkpoint.phase,
      "BACKFILL",
    );
  } finally {
    await db.close();
  }
});
test("history replays are idempotent; messages outside Inbox are not permanently excluded if later moved into Inbox", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    await db.query("UPDATE gmail_mailboxes SET checkpoint=$1", [
      JSON.stringify({ phase: "HISTORY", historyId: "100" }),
    ]);
    let labels = ["SENT"];
    const gmail = {
      historyPage: async () => ({
        history: [
          {
            messagesAdded: [{ message: { id: "one" } }],
            labelsAdded: [{ labelIds: ["INBOX"], message: { id: "one" } }],
          },
        ],
        historyId: "101",
      }),
      message: async () => message(billing, labels),
    };
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => gmail,
    });
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM gmail_processed_messages"))
        .rows[0].n,
      0,
    );
    labels = ["INBOX"];
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => gmail,
    });
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => gmail,
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
test("expired history resets to a fresh backlog scan and revoked/expired leases cannot write", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    await db.query("UPDATE gmail_mailboxes SET checkpoint=$1", [
      JSON.stringify({ phase: "HISTORY", historyId: "100" }),
    ]);
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => ({
        historyPage: async () => {
          throw new GoogleError(404);
        },
      }),
    });
    assert.equal(
      (await db.query("SELECT checkpoint FROM gmail_mailboxes")).rows[0]
        .checkpoint.phase,
      "BACKFILL",
    );
    await db.query(
      "UPDATE gmail_sync_jobs SET lease_until=now()-interval '1 minute'",
    );
    await assert.rejects(
      () =>
        syncMailbox(company, mailbox, owner, {
          transaction,
          client: () => ({}),
        }),
      /lease/,
    );
  } finally {
    await db.close();
  }
});
test("PostgreSQL RLS prevents cross-company reads even with an unscoped query, and audit records cannot be changed", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    const box = (await db.query("SELECT * FROM gmail_mailboxes")).rows[0];
    await transaction(company, user, (sql) =>
      recordSource(sql, box, "one", source, {
        fields: {
          kind: "INVOICE",
          vendor: "Synthetic Vendor",
          reference: "X",
          date: "2026-11-03",
          amount: "100.00",
          currency: "USD",
          address: "",
          phone: "",
          category: "BUSINESS_EXPENSE",
          loadReference: "",
          assignment: "",
        },
        issues: [],
        relevant: true,
      }),
    );
    await db.exec(
      "CREATE ROLE document_runtime NOLOGIN; GRANT SELECT ON incoming_documents,document_company_memberships TO document_runtime;",
    );
    await db.exec("SET ROLE document_runtime");
    await db.query("SELECT set_config('paycore.workspace_id',$1,false)", [
      "other-company",
    ]);
    assert.equal(
      (await db.query("SELECT * FROM incoming_documents")).rows.length,
      0,
    );
    await db.query("SELECT set_config('paycore.workspace_id',$1,false)", [
      company,
    ]);
    assert.equal(
      (await db.query("SELECT * FROM incoming_documents")).rows.length,
      1,
    );
    await db.query("SELECT set_config('paycore.user_id',$1,false)", [
      "other-user",
    ]);
    assert.equal(
      (await db.query("SELECT * FROM document_company_memberships")).rows
        .length,
      0,
    );
    await db.exec("RESET ROLE");
    await assert.rejects(
      () => db.query("UPDATE gmail_document_events SET action='changed'"),
      /append-only/,
    );
  } finally {
    await db.close();
  }
});
test("Google client uses read-only Gmail endpoints, token exchange retains requested scope and surfaces retryable HTTP failures", async () => {
  const calls = [];
  const fake = async (url, options) => {
    calls.push({ url, options });
    return Response.json(
      url.includes("/token")
        ? {
            access_token: "fake",
            refresh_token: "refresh",
            expires_in: 3600,
            scope: GMAIL_SCOPE,
          }
        : { emailAddress: "vendor@example.test", historyId: "100" },
    );
  };
  assert.equal(
    (await new GmailClient("fake", fake).profile()).historyId,
    "100",
  );
  assert.equal(
    (
      await exchangeToken(
        { grant_type: "authorization_code", code: "synthetic-code" },
        fake,
      )
    ).scope,
    GMAIL_SCOPE,
  );
  assert.ok(calls[0].url.startsWith("https://gmail.googleapis.com/"));
  assert.equal(calls[0].options.headers.Authorization, "Bearer fake");
  await assert.rejects(
    () =>
      new GmailClient(
        "fake",
        async () => new Response("", { status: 429 }),
      ).profile(),
    (error) => error instanceof GoogleError && error.status === 429,
  );
});

test("server OCR reads an image receipt locally and real PDF text extraction preserves totals", async () => {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(1200, 450),
    context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, 1200, 450);
  context.fillStyle = "black";
  context.font = "32px sans-serif";
  [
    "SYNTHETIC VENDOR LLC",
    "INVOICE #: OCR-100",
    "Date: 2026-11-03",
    "Total: $100.00",
  ].forEach((line, i) => context.fillText(line, 40, 60 + i * 70));
  const image = await extractBilling({
    ...source,
    name: "invoice.png",
    mime: "image/png",
    bytes: canvas.toBuffer("image/png"),
  });
  assert.equal(image.fields.amount, "100.00");
  assert.equal(image.fields.reference, "OCR-100");
  assert.deepEqual(image.issues, []);
  const { invoicePdf } = await import("../lib/invoice-pdf.ts");
  const { emptyInvoiceBook, saveInvoiceDraft, issueInvoice } = await import(
    "../lib/invoices.ts"
  );
  const invoice = {
    id: "synthetic-pdf",
    companyId: company,
    number: "PDF-100",
    issuer: "Synthetic Vendor LLC",
    issuerAddress: "100 Example Road",
    customer: "Synthetic Customer",
    customerEmail: "customer@example.test",
    billingAddress: "200 Example Road",
    issuedOn: "2026-11-03",
    dueOn: "2026-11-17",
    currency: "USD",
    lines: [
      {
        id: "line-1",
        description: "Synthetic service",
        quantityMillis: 1000,
        unitPriceCents: 10000,
      },
    ],
    discountCents: 0,
    taxBasisPoints: 0,
    notes: "",
    status: "DRAFT",
    payments: [],
    paymentReversals: [],
    audit: [],
  };
  const at = source.receivedAt;
  const book = issueInvoice(
    saveInvoiceDraft(emptyInvoiceBook(company), invoice, user, at),
    invoice.id,
    user,
    at,
  );
  const pdf = await extractBilling({
    ...source,
    name: "invoice.pdf",
    mime: "application/pdf",
    bytes: invoicePdf(book.invoices[0], "2026-11-03"),
  });
  assert.equal(pdf.fields.amount, "100.00");
  assert.equal(pdf.fields.reference, "PDF-100");
  assert.deepEqual(pdf.issues, []);
});

test("refresh tokens rotate under encryption, and a disconnected mailbox cannot continue scanning", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    await db.query("UPDATE gmail_mailboxes SET credentials=$1", [
      seal(
        JSON.stringify({
          accessToken: "old",
          refreshToken: "old-refresh",
          expiresAt: 0,
        }),
        `gmail-token:${company}:${mailbox}`,
        key,
      ),
    ]);
    await syncMailbox(company, mailbox, owner, {
      transaction,
      refresh: async (parameters) => {
        assert.equal(parameters.refresh_token, "old-refresh");
        return {
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
        };
      },
      client: (token) => {
        assert.equal(token, "new-access");
        return {
          profile: async () => ({ historyId: "100" }),
          inboxPage: async () => ({ messages: [] }),
        };
      },
    });
    const stored = (await db.query("SELECT credentials FROM gmail_mailboxes"))
      .rows[0].credentials;
    assert.ok(!stored.includes("new-refresh"));
    assert.equal(
      JSON.parse(unseal(stored, `gmail-token:${company}:${mailbox}`, key))
        .refreshToken,
      "new-refresh",
    );
    await db.query("UPDATE gmail_mailboxes SET active=false");
    await assert.rejects(
      () => syncMailbox(company, mailbox, owner, { transaction }),
      /connection was removed/,
    );
  } finally {
    await db.close();
  }
});

test("Google OAuth uses offline read-only PKCE and state is bound to the authenticated owner, expiring after one callback", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  process.env.APP_BASE_URL = "https://paycore.example.test";
  process.env.GOOGLE_CLIENT_ID = "synthetic-client";
  const { db, transaction } = await database();
  try {
    const { beginGoogleConnect, stateCompany, finishGoogleConnect } =
      await import("../lib/server/gmail/oauth.ts");
    const url = new URL(await beginGoogleConnect(company, user, transaction));
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("scope"), GMAIL_SCOPE);
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    const state = url.searchParams.get("state");
    assert.equal(stateCompany(state), company);
    assert.throws(() => stateCompany(state + "x"));
    const deps = {
      transaction,
      exchange: async (params) => {
        assert.ok(params.code_verifier.length > 30);
        return {
          access_token: "new-token",
          refresh_token: "new-refresh",
          expires_in: 3600,
          scope: GMAIL_SCOPE,
        };
      },
      profile: async () => ({
        emailAddress: "new-mailbox@example.test",
        historyId: "200",
      }),
    };
    await assert.rejects(
      () =>
        finishGoogleConnect(
          company,
          "other-user",
          state,
          "synthetic-code",
          deps,
        ),
      /expired/,
    );
    await finishGoogleConnect(company, user, state, "synthetic-code", deps);
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM gmail_mailboxes")).rows[0].n,
      2,
    );
    await assert.rejects(
      () => finishGoogleConnect(company, user, state, "synthetic-code", deps),
      /expired/,
    );
  } finally {
    await db.close();
  }
});

test("a scanned PDF is rendered and OCRed automatically rather than sent to a manual upload/review path", async () => {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(1200, 450),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1200, 450);
  ctx.fillStyle = "black";
  ctx.font = "32px sans-serif";
  [
    "SYNTHETIC VENDOR LLC",
    "INVOICE #: SCAN-100",
    "Date: 2026-11-03",
    "Total: $100.00",
  ].forEach((line, i) => ctx.fillText(line, 40, 60 + i * 70));
  const jpg = canvas.toBuffer("image/jpeg");
  const stream = Buffer.from("q 600 0 0 225 0 0 cm /Im1 Do Q");
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 225] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>",
    ),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width 1200 /Height 450 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
      ),
      jpg,
      Buffer.from("\nendstream"),
    ]),
    Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),
      stream,
      Buffer.from("\nendstream"),
    ]),
  ];
  const chunks = [Buffer.from("%PDF-1.4\n")],
    offsets = [];
  let length = chunks[0].length;
  for (const [i, obj] of objects.entries()) {
    offsets.push(length);
    const value = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      obj,
      Buffer.from("\nendobj\n"),
    ]);
    chunks.push(value);
    length += value.length;
  }
  chunks.push(
    Buffer.from(
      `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => String(offset).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`,
    ),
  );
  const result = await extractBilling({
    ...source,
    name: "scanned-invoice.pdf",
    mime: "application/pdf",
    bytes: Buffer.concat(chunks),
  });
  assert.equal(result.fields.reference, "SCAN-100");
  assert.equal(result.fields.amount, "100.00");
  assert.deepEqual(result.issues, []);
});

test("the scheduler claims mailbox leases atomically and another worker cannot claim active leases", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    const { claimMailboxJobs } = await import("../lib/server/gmail/worker.ts");
    await db.query(
      "UPDATE gmail_sync_jobs SET lease_owner=NULL,lease_until=NULL",
    );
    assert.equal((await claimMailboxJobs(db, owner)).length, 1);
    const other = randomUUID();
    assert.equal((await claimMailboxJobs(db, other)).length, 0);
    await db.query(
      "UPDATE gmail_sync_jobs SET lease_until=now()-interval '1 minute'",
    );
    assert.equal((await claimMailboxJobs(db, other)).length, 1);
    await assert.rejects(
      () => syncMailbox(company, mailbox, owner, { transaction }),
      /lease/,
    );
  } finally {
    await db.close();
  }
});

test("an oversized email becomes an exception instead of permanently blocking the inbox checkpoint", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    const { GoogleResponseLimit } = await import(
      "../lib/server/gmail/client.ts"
    );
    const gmail = {
      profile: async () => ({ historyId: "100" }),
      inboxPage: async () => ({
        messages: [{ id: "too-large" }, { id: "normal" }],
      }),
      message: async (id) => {
        if (id === "too-large") throw new GoogleResponseLimit();
        return message();
      },
      messageMetadata: async () => ({
        labelIds: ["INBOX"],
        internalDate: String(Date.parse(source.receivedAt)),
      }),
    };
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => gmail,
    });
    const rows = (
      await db.query("SELECT status,fields FROM incoming_documents")
    ).rows;
    assert.equal(rows.filter((row) => row.status === "EXCEPTION").length, 1);
    assert.equal(rows.filter((row) => row.status === "RECORDED").length, 1);
    assert.equal(
      rows.find((row) => row.status === "EXCEPTION").fields.vendor,
      "",
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM gmail_processed_messages"))
        .rows[0].n,
      2,
    );
    assert.equal(
      (await db.query("SELECT checkpoint FROM gmail_mailboxes")).rows[0]
        .checkpoint.phase,
      "HISTORY",
    );
  } finally {
    await db.close();
  }
});

test("body-only invoices backed by Gmail attachment IDs are downloaded and recorded automatically", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    let fetched = false;
    const body = message();
    body.payload.body = {
      attachmentId: "body-attachment",
      size: billing.length,
    };
    assert.equal(messageParts(body.payload).bodies.length, 1);
    const gmail = {
      profile: async () => ({ historyId: "100" }),
      inboxPage: async () => ({ messages: [{ id: "body-only" }] }),
      message: async () => body,
      attachment: async (messageId, partId) => {
        assert.equal(partId, "body-attachment");
        fetched = true;
        return { data: Buffer.from(billing).toString("base64url") };
      },
    };
    await syncMailbox(company, mailbox, owner, {
      transaction,
      client: () => gmail,
    });
    assert.ok(fetched);
    const row = (await db.query("SELECT status,fields FROM incoming_documents"))
      .rows[0];
    assert.equal(row.status, "RECORDED");
    assert.equal(row.fields.amount, "100.00");
  } finally {
    await db.close();
  }
});

test("the company selector excludes approver-only and contractor memberships before choosing its default", async () => {
  process.env.GMAIL_ENCRYPTION_KEY = key;
  const { db, transaction } = await database();
  try {
    const { listDocumentMemberships } = await import(
      "../lib/server/gmail/repository.ts"
    );
    await db.query(
      "INSERT INTO document_company_memberships(company_id,user_id,company_name,roles) VALUES($1,$2,$3,$4)",
      ["other-company", user, "AAA Approver Company", ["APPROVER"]],
    );
    let rows = await transaction("", user, (sql) =>
      listDocumentMemberships(sql, user),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].company_id, company);
    await db.query(
      "UPDATE document_company_memberships SET roles=$1 WHERE company_id=$2",
      [["CONTRACTOR"], "other-company"],
    );
    rows = await transaction("", user, (sql) =>
      listDocumentMemberships(sql, user),
    );
    assert.equal(rows[0].company_id, company);
    assert.equal(rows.length, 1);
  } finally {
    await db.close();
  }
});

test('Google connection hints the supplied contact only for a verified matching company membership',async()=>{process.env.GMAIL_ENCRYPTION_KEY=key;process.env.APP_BASE_URL='https://paycore.example.test';process.env.GOOGLE_CLIENT_ID='synthetic-client';const {db,transaction}=await database();try{const {MAK_COMPANY_IDENTITY:identity}=await import('../lib/company-identity.ts');const {beginGoogleConnect}=await import('../lib/server/gmail/oauth.ts');let url=new URL(await beginGoogleConnect(company,user,transaction));assert.equal(url.searchParams.has('login_hint'),false);await db.query('UPDATE document_company_memberships SET company_name=$1 WHERE company_id=$2',[identity.header.legalName,company]);url=new URL(await beginGoogleConnect(company,user,transaction));assert.equal(url.searchParams.get('login_hint'),identity.header.email);assert.equal(url.searchParams.get('scope'),GMAIL_SCOPE);}finally{await db.close();}});
