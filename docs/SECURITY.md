# PayCore Security Baseline

PayCore handles financial and personally identifiable information. Production release is blocked until these controls are implemented and tested.

## Mandatory controls

- Authentication with secure session management and MFA support.
- Role-based authorization with least privilege.
- Server-side authorization on every protected mutation and read.
- Explicit human approval before payroll finalization.
- Immutable approved/paid payroll snapshots.
- Append-only audit events for material financial actions.
- Sensitive fields masked by default.
- Secrets only in managed environment variables/secret stores.
- TLS in transit and managed encryption at rest.
- No sensitive payroll or bank data in application logs.
- Input/schema validation at all trust boundaries.
- CSRF/XSS/injection protections appropriate to the deployed stack.
- Rate limiting and abuse controls for authentication and sensitive endpoints.
- Automated dependency and code scanning.
- Versioned database migrations, encrypted backups, and tested restore procedures.
- Session expiry and forced re-authentication for high-risk actions where appropriate.

## Payroll invariants

1. Draft calculations may change; approved snapshots may not silently change.
2. Rates used for an approved run are stored with the run, not looked up dynamically later.
3. Duplicate transaction warnings must be resolved or explicitly acknowledged before approval.
4. Missing required contractor/rate/pay-period information blocks approval.
5. Negative net pay is a blocking warning unless an authorized policy explicitly permits it.
6. Corrections after approval are adjustments/reversals, never destructive history edits.
7. Every approval, reversal, payment-state change, and sensitive configuration change is attributable to a user and timestamp.

## Repository rule

Never commit production exports, SSNs/TINs, bank account/routing numbers, passwords, API keys, access tokens, private keys, or real payroll fixtures.
## Implemented HTTP and document-access controls

The shared `lib/server/security` helpers supply response headers and validate
browser mutation origins against deployment configuration. Mailbox connect and
disconnect routes require the exact configured Origin; Fetch Metadata, when
present, must also indicate same-origin or a direct navigation. This complements,
and never replaces, the existing verified session, company membership, role and
Brice-only Microsoft ownership checks. OAuth callbacks use their existing encrypted,
expiring, single-use state; they are intentionally excluded from browser POST checks.

API and Auth0 responses receive no-store instructions for browser/CDN caches.
The baseline also prevents MIME sniffing, cross-origin framing, base-tag injection,
embedded objects and form submissions outside PayCore and the two approved OAuth
provider hosts, suppresses referrers and advertises
HSTS. Same-origin framing remains available. The CSP deliberately does not claim
full script protection: Next.js hydration and existing local document flows still
need a separately tested nonce-based policy before restricting script execution.
Camera/microphone/geolocation/payment browser APIs are disabled; reassess those
permissions before introducing features that need them.

Authenticated document-list reads commit `documents.read` events in the existing
company-scoped, append-only event store. Events contain the actor, company, time,
status, page, returned document IDs and count. They do not duplicate invoice
fields, mailbox addresses, source links or credentials. The read fails if its audit
write cannot commit. Existing deployments must keep the documented runtime-role
INSERT and sequence grants for `gmail_document_events`; no new migration is needed.
Audit volume increases with document polling. Define monitored archival/retention
before production scale; do not bypass append-only protections to purge evidence.
Both scheduler routes use the same timing-safe bearer-secret comparison.

Dependency auditing remains in CI. Dependabot configuration requests weekly npm
and GitHub Actions update PRs; maintainers must enable supported repository features,
review updates, and retain patch/remediation evidence. This is not a code-scanning
service or a promise that every vulnerability will be detected.

## Assurance boundary and remaining work

This repository has no established SOC 2 report or ISO 27001 certificate. Code
changes do not establish either. No HIPAA-covered use has been established; do not
onboard protected health information without an applicability assessment, appropriate
agreements, safeguards and approved hosting/vendors. HIPAA has no official government
product certification.

The financial workspace still includes browser-local persistence and local approval
flows. An editable browser profile is not a production identity or an authoritative,
centrally audited financial record. Migrate those records and financial operations
to authenticated, company-scoped server storage before treating that workspace as
an assured multi-user payroll service. The mailbox backend's controls do not extend
automatically to browser-local records.

The accountable operator must also establish and retain evidence for:

- Enforced identity-provider MFA, access reviews, prompt deprovisioning and incident
  session revocation; deployment secrets and approved OAuth configuration.
- Verified database TLS, restricted non-owner runtime grants, encrypted storage,
  key rotation/recovery and tested backups/restores. These are not proved by local tests.
- Distributed abuse/rate limits at the identity provider and application edge,
  monitoring/alerts, vulnerability/code scanning, and security incident response drills.
- Data inventory, approved retention/deletion and lawful access procedures across
  original emails, parsed records, immutable audit evidence, browser copies and backups.
- Vendor reviews/contracts, staff training, risk treatment, change approvals and
  business-continuity exercises with named owners and review dates.

Scope and evidence must be reviewed with the independent SOC 2 CPA firm or ISO 27001
certification auditor. Do not mark controls effective merely because a checklist or
implementation exists. See `docs/SECURITY-READINESS.md` for the review boundary.

For account rate limits, scheduler budgets/backoff, the scan pause switch and targeted
accessibility checks, see `docs/COST-AND-ACCESSIBILITY.md`. Edge defenses and vendor
spending settings still require operator configuration.
