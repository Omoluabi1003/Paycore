"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { mailboxSourceLink } from "../lib/mailbox-links";
import type { MailboxProvider } from "../lib/mailbox-links";
import type { DocumentFields } from "../lib/document-import";
type Mailbox = {
  id: string;
  provider?: MailboxProvider;
  email: string;
  active: boolean;
  canDisconnect?: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  phase: string;
};
type Status = {
  providers?: Record<MailboxProvider, { ready: boolean }>;
  recommendedProvider?: MailboxProvider | "UNKNOWN";
  contactEmail?: string;
  configured?: boolean;
  automationReady?: boolean;
  authConfigured?: boolean;
  missing?: string[];
  companies?: { company_id: string; company_name: string }[];
  companyId?: string;
  mailboxes?: Mailbox[];
  canConnect?: boolean;
  canConnectMicrosoft?: boolean;
  error?: string;
};
type RecordRow = {
  source_provider?: MailboxProvider;
  source_url?: string;
  id: string;
  message_id: string;
  mailbox_email: string;
  source_name: string;
  fields: DocumentFields;
  issues: string[];
  received_at: string;
  recorded_at: string;
};
export default function MailboxWorkspace({
  view = "inbox",
  compact = false,
}: {
  view?: "inbox" | "activity" | "exceptions";
  compact?: boolean;
}) {
  const [connectionError, setConnectionError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("mailbox") === "connection-failed" ||
      params.get("gmail") === "connection-failed"
    )
      setConnectionError(
        "The mailbox connection was not completed. Try again or ask your email administrator to approve access.",
      );
  }, []);
  const [status, setStatus] = useState<Status | null>(null),
    [company, setCompany] = useState(""),
    [documents, setDocuments] = useState<RecordRow[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [error, setError] = useState(""),
    [signIn, setSignIn] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let nextLoad = 0;
    let poll = true;
    setLoading(true);
    async function load() {
      if (!mounted || inFlight || document.hidden) return;
      if (Date.now() < nextLoad) {
        timer = setTimeout(() => void load(), nextLoad - Date.now());
        return;
      }
      inFlight = true;
      let delay = 60000;
      function checkLimit(response: Response) {
        if (response.status === 429) {
          const seconds = Number(response.headers.get("Retry-After"));
          delay = Math.max(delay, Math.min(600000, (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000));
        }
      }
      try {
        const response = await fetch(
          `/api/gmail/status${company ? `?companyId=${encodeURIComponent(company)}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        checkLimit(response);
        const next = await response.json();
        if (!mounted) return;
        if (response.status === 401) {
          poll = false;
          setSignIn(true);
          setStatus(null);
          setDocuments([]);
          setLoading(false);
          return;
        }
        if (response.status === 503 && next.configured === false) {
          poll = false;
          setStatus(next);
          setDocuments([]);
          setLoading(false);
          return;
        }
        if (!response.ok)
          throw Error(
            next.error || "The mailbox service could not be reached.",
          );
        setSignIn(false);
        setStatus(next);
        if (!company && next.companyId) {
          setCompany(next.companyId);
          setLoading(false);
          return;
        }
        if (next.companyId) {
          const result = await fetch(
            `/api/gmail/documents?companyId=${encodeURIComponent(next.companyId)}&status=${view === "exceptions" ? "EXCEPTION" : "RECORDED"}&page=${page}`,
            { cache: "no-store", signal: controller.signal },
          );
          checkLimit(result);
          const body = await result.json();
          if (!result.ok)
            throw Error(body.error || "Documents could not be loaded.");
          if (mounted) {
            setDocuments(body.documents);
            setMore(body.hasMore);
          }
        }
        failures = 0;
        if (!next.companyId) poll = false;
        if (mounted) {
          setError("");
          setLoading(false);
        }
      } catch (reason) {
        failures++;
        delay = Math.max(delay, Math.min(300000, 30000 * 2 ** Math.min(failures, 4)));
        if (mounted && !controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Mailbox service unavailable.",
          );
          setDocuments([]);
          setStatus(null);
          setLoading(false);
        }
      } finally {
        inFlight = false;
        nextLoad = Date.now() + delay;
        if (mounted && poll && !document.hidden)
          timer = setTimeout(() => void load(), delay);
      }
    }
    function visibilityChanged() {
      if (timer) clearTimeout(timer);
      if (!document.hidden && poll) void load();
    }
    void load();
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      mounted = false;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [company, view, page]);
  async function disconnect(id: string) {
    try {
      const response = await fetch(
        `/api/gmail/disconnect?companyId=${encodeURIComponent(company)}&mailboxId=${encodeURIComponent(id)}`,
        { method: "POST" },
      );
      if (!response.ok) throw Error("The mailbox could not be disconnected.");
      setStatus((current) =>
        current
          ? {
              ...current,
              mailboxes: current.mailboxes?.map((box) =>
                box.id === id ? { ...box, active: false } : box,
              ),
            }
          : current,
      );
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  const heading =
    view === "exceptions"
      ? "Inbox exceptions"
      : view === "activity"
        ? "Incoming invoices and receipts"
        : "Automatic email tracking";
  return (
    <section className="panel gmail-workspace" aria-label={heading} aria-busy={loading}>
      <div className="section-heading">
        <div>
          <h2>{heading}</h2>
          <p>
            {view === "exceptions"
              ? "Only documents that could not be recorded reliably appear here."
              : "Billing documents are collected from your connected mailbox and recorded automatically in PayCore."}
          </p>
        </div>
        {compact && (
          <Link className="button button-secondary" href="/scan">
            Manage mailbox
          </Link>
        )}
      </div>
      {connectionError && <p role="alert">{connectionError}</p>}
      {loading && <p role="status">Checking mailbox connection…</p>}
      {error && <p role="alert">{error}</p>}
      {signIn && (
        <p>
          Sign in to your secure account to view company documents.{" "}
          <a
            className="button button-primary"
            href="/auth/login?returnTo=/scan"
          >
            Sign in securely
          </a>
        </p>
      )}
      {status?.configured === false && (
        <div className="gmail-setup">
          <h3>Mailbox automation needs setup.</h3>
          <p>
            The connection is not live yet. Your developer needs to configure
            secure account access, private storage and the email-provider
            connection before you can authorize your mailbox.
          </p>
          <details>
            <summary>Setup status</summary>
            <ul>
              {status.missing?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
      {status?.configured && (
        <>
          {status.automationReady === false && (
            <p role="status">
              Automatic scanning is paused until mailbox setup is complete.
              Existing records remain available.
            </p>
          )}
          {Boolean(status.companies?.length) && (
            <label className="gmail-company">
              Company
              <select
                value={company}
                onChange={(event) => {
                  setCompany(event.target.value);
                  setPage(0);
                  setDocuments([]);
                  setStatus((current) =>
                    current ? { ...current, mailboxes: [] } : current,
                  );
                }}
              >
                {status.companies?.map((item) => (
                  <option key={item.company_id} value={item.company_id}>
                    {item.company_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!status.companies?.length && (
            <p>
              Your secure account needs a company membership. Ask your company
              administrator to grant access.
            </p>
          )}
          {!compact && company && (
            <>
              <div className="gmail-connections">
                {status.mailboxes?.map((box) => (
                  <article key={box.id}>
                    <strong>{box.email}</strong>
                    <small>
                      {box.provider === "MICROSOFT"
                        ? "Microsoft 365 / Outlook"
                        : "Google Workspace"}
                    </small>
                    <p>
                      {!box.active
                        ? "Disconnected"
                        : box.phase === "BACKFILL"
                          ? box.last_synced_at
                            ? "Scanning existing inbox"
                            : "Initial inbox scan queued"
                          : "Automatic tracking connected"}
                    </p>
                    {box.last_synced_at && (
                      <p>
                        Last checked:{" "}
                        {new Date(box.last_synced_at).toLocaleString()}
                      </p>
                    )}
                    {box.last_error && <p role="status">{box.last_error}</p>}
                    {box.active && box.canDisconnect && (
                      <button
                        type="button"
                        className="button button-secondary"
                        aria-label={`Disconnect ${box.email}`}
                        onClick={() => void disconnect(box.id)}
                      >
                        Disconnect
                      </button>
                    )}
                  </article>
                ))}
              </div>
              {status.contactEmail && (
                <p>
                  Business email: <strong>{status.contactEmail}</strong>
                  {status.recommendedProvider === "MICROSOFT"
                    ? " · Domain routes through Microsoft 365"
                    : status.recommendedProvider === "GMAIL"
                      ? " · Domain routes through Google Workspace"
                      : ""}
                </p>
              )}
              {status.canConnect && (
                <div className="activity-actions">
                  {(status.providers?.MICROSOFT.ready ||
                    status.recommendedProvider === "MICROSOFT") && (
                    <form
                      method="post"
                      action={`/api/microsoft/connect?companyId=${encodeURIComponent(company)}`}
                    >
                      <button
                        className="button button-primary"
                        type="submit"
                        disabled={!status.providers?.MICROSOFT.ready || !status.canConnectMicrosoft}
                      >
                        Connect Microsoft 365 / Outlook
                      </button>
                    </form>
                  )}
                  {(status.providers?.GMAIL.ready ||
                    status.recommendedProvider === "GMAIL") && (
                    <form
                      method="post"
                      action={`/api/gmail/connect?companyId=${encodeURIComponent(company)}`}
                    >
                      <button
                        className="button button-secondary"
                        type="submit"
                        disabled={!status.providers?.GMAIL.ready}
                      >
                        Connect Gmail / Google Workspace
                      </button>
                    </form>
                  )}
                </div>
              )}
              {!status.canConnectMicrosoft && <p>Only Brice’s verified account can manage the Microsoft connection.</p>}
              {status.recommendedProvider === "MICROSOFT" &&
                !status.providers?.MICROSOFT.ready && (
                  <p>
                    Microsoft 365 connection needs developer setup before this
                    mailbox can be authorized.
                  </p>
                )}
              <p className="guide-rail-note">
                Authorize once. PayCore reads billing documents from your inbox
                and checks for new ones automatically. Mailbox access is
                read-only; this does not send emails, make payments or change
                payroll.
              </p>
            </>
          )}
          <div className="table-scroll" role="region" aria-label="Invoice and receipt records" tabIndex={0}>
            <table>
              <caption className="sr-only">{heading}</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Vendor / reference</th>
                  <th scope="col">Total</th>
                  <th scope="col">Contact details</th>
                  <th scope="col">
                    {view === "exceptions" ? "Needs attention" : "Source"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((item) => (
                  <tr key={item.id}>
                    <td>{item.fields.date || "Not identified"}</td>
                    <th scope="row">
                      {item.fields.vendor || "Not identified"}
                      <small>{item.fields.reference}</small>
                    </th>
                    <td>
                      {item.fields.amount
                        ? `USD ${item.fields.amount}`
                        : "Not identified"}
                    </td>
                    <td>
                      {item.fields.address}
                      <small>{item.fields.phone}</small>
                    </td>
                    <td>
                      {view === "exceptions" && (
                        <ul>
                          {item.issues.map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      )}
                      <a
                        href={mailboxSourceLink(
                          item.source_provider ?? "GMAIL",
                          item.mailbox_email,
                          item.message_id,
                          item.source_url,
                        )}
                        aria-label={`Open source email for ${item.fields.vendor || "unidentified vendor"}${item.fields.reference ? `, ${item.fields.reference}` : ""} (opens in a new tab)`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open source email
                      </a>
                      <small>{item.source_name}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!documents.length && (
            <p>
              {view === "exceptions"
                ? "No inbox exceptions found."
                : "No billing documents recorded yet. Connected mailboxes are checked automatically; no manual upload is needed."}
            </p>
          )}
          <nav className="activity-actions" aria-label="Document pages">
            <button
              className="button button-secondary"
              disabled={page === 0}
              onClick={() => { setDocuments([]); setPage((value) => value - 1); }}
            >
              Previous
            </button>
            <span role="status">Page {page + 1}</span>
            <button
              className="button button-secondary"
              disabled={!more}
              onClick={() => { setDocuments([]); setPage((value) => value + 1); }}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
