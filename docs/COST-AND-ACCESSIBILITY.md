# Cost protection and accessibility

## Enforced in code

Apply migration `005_cost_guards.sql` after 001–004 before deployment. Grant the
actual non-owner runtime role SELECT/INSERT/UPDATE on `request_rate_limits` and
SELECT/UPDATE on `mailbox_scheduler_gate`, in addition to its existing grants.
The request table has forced user-scoped RLS. Do not grant role/membership writes.
Missing migrations/grants fail closed; there is no process-local limiter fallback.

Authenticated status/document requests share 120 requests per 60-second window per
verified PayCore account. Connect/disconnect requests share 10 per 10-minute window.
Changing company, spoofing an IP/header, or invoking another application instance
does not reset the bucket. Rejected calls receive HTTP 429 and Retry-After; database
failure returns the existing generic service-unavailable response. The fixed-window
limiter can allow a burst across a window boundary and does not cover unauthenticated
invocations, all routes, login attempts or denial-of-service traffic at the edge.

The scheduler uses one database-backed global gate, with a five-minute cooldown and
six-minute lease for crash recovery. Mailbox leases remain separate. A run retains
the existing three-mailbox/180-second budget and now processes at most ten pages per
mailbox. Cursors persist between runs; reaching a budget never silently drops
remaining records. Calls during cooldown return without claiming jobs. Repeated
transient failures back off from 10 minutes to six hours; authorization failures wait
24 hours (reconnecting marks the job due immediately and resets failures). Successful progress
resets failures. There are no self-invoking worker requests or immediate retry loops.

Set `PAYCORE_MAILBOX_SYNC_ENABLED=false` and redeploy to pause future scheduled scans
before database/provider work. Existing in-flight invocations may finish. This switch
does not disable Vercel invocation/transfer billing or scheduled GitHub Actions runs;
also disable the Actions schedule through its existing repository variable and disable
or pause the deployment when needed. The default preserves the existing authorized
scan behavior. No production setting was changed during implementation.

Mailbox pages refresh only when visible, avoid overlapping reads, stop polling when
sign-in/setup is required, and delay retries after failures/429 responses. Server-side
scanning continues independently of the browser. Polling is not a security boundary.
The three fixed public fictional PDF/CSV examples are built statically and cached;
private API/auth responses retain no-store. Never put live records into those examples.

## Hosting controls still required

The project owner must enable and verify these in the actual hosting/account plan:

1. In Vercel project/team usage and spending settings, configure available budget
   notifications and supported Spend Management actions. Choose thresholds based on
   the approved budget; verify notification recipients and the action taken at the
   threshold. An alert is not a hard billing cap. Plan-specific automation may pause
   projects; confirm its scope, delay and exceptions before relying on it.
2. Enable available Firewall/WAF and DDoS controls. Add edge limits/challenges for
   public/API traffic and tune against legitimate sessions, OAuth callbacks and
   authorized cron calls. Do not cache authenticated responses or block provider
   callbacks indiscriminately. App-level limits still incur invocation/database cost.
3. Review function duration, memory, transfer, image optimization, database storage
   and OCR usage. Set operational alerts and designate an incident owner. Test the
   pause switch, failure backoff and restore procedure in staging. Review GitHub
   Actions usage separately. Cached static pages can still incur request/transfer cost.
4. Review rate-limit row retention and audit growth; maintain at most the known
   buckets per account and remove stale limiter rows with an approved maintenance
   identity when users are deleted. Do not delete financial or append-only audit data
   as part of limiter cleanup.

No dollar budget, edge policy or vendor spending cap has been activated here because
no deployment-management credentials or approved budget were available. This change
reduces work; it cannot guarantee a maximum hosting bill under attack.

## Accessibility scope

Scan, Inbox and Activity Register gain a skip link, focusable main content, keyboard
focus indicators for selects/textareas/scrollable records, a table caption/column
headers, descriptive source/disconnect controls and page/loading announcements. The
sign-in button, table headings and guide text fix measured normal-text contrast failures. Brand and
ETL GIS attribution remain unchanged. The local workspace and other product flows
retain their existing behavior.

Automated axe checks and keyboard/mobile checks are engineering evidence, not a
WCAG conformance certification or legal conclusion. Continue manual screen-reader,
zoom, reduced-motion, modal, validation and keyboard-only testing across the complete
payroll/invoice workflow and supported browsers. Text messaging remains unimplemented;
introducing SMS requires appropriate consent, opt-outs and applicable legal review.

## Rollout and rollback

This change includes PR #72's HTTP/audit baseline in the consolidated update. Deploy migration 005 and its grants
before the code, or keep scheduling paused until they are ready. Test 429 recovery,
OAuth and document access, a successful scan, provider failure backoff and overlapping
cron calls with synthetic staging data. Watch error rates and legitimate multi-tab
usage before tuning constants. The access limiter is user scoped, not company scoped.

Rollback must preserve migrations, processed-message/source evidence and existing
lease metadata. Pause scanning first: older code ignores the global gate, backoff
and pause switch, so disable its external schedules before reverting. Reverting
limiter code removes its protection. Do not label these changes SOC 2/ISO certified,
HIPAA compliant, accessibility compliant or a guaranteed billing cap.
