# PayCore commercial launch specification

Accepted product direction: Contractor Compensation, Settlement and Payroll Operations Platform. The specialist enters and verifies facts; deterministic code recognizes effective contractor-specific rules and calculates settlements; authorized humans review and approve; append-oriented audit records preserve the evidence. AI may explain or prioritize verified facts but cannot change rules, approve, execute payments, or alter history.

## Required product surfaces

- **Next Payroll Command Center:** working/next period, cutoff/payment dates, active/ready/review/blocked contractors, captured/review loads, eligible revenue, earnings, automatic/manual deductions, reimbursements, net settlements, readiness and direct next actions.
- **Contractor 360:** Overview, Activity, Compensation, Deductions, Balances, Statements, Documents, Audit. Effective agreement, activity, projected settlement, recurring obligations, advance/escrow balances, approved-history YTD, statements and exceptions.
- **Onboarding:** identity/contact/business, payment arrangement, effective compensation, authorized deductions, opening balances, documents, review, activation. Missing configuration or conflicting rules blocks activation.
- **Activity register:** company/contractor-scoped loads, other earnings, fuel, insurance, advances, escrow, maintenance, registration, IFTA, factoring, reimbursements, adjustments and other deductions. Preserve eligibility, source, external ID and creator. Approved sources cannot silently be reused.
- **Payroll workbench:** search/status filters, revenue and method, earnings, automatic/manual deductions, reimbursements/adjustments, net and READY/REVIEW/BLOCKED/APPROVED/PAID/LOCKED status. Expand source lines, exceptions, explanation, statement and comparison.
- **Exception center/inbox:** blocking validation, duplicate/negative/variance/override/rate/balance/recurrence review and informational agreement/payoff notices, disputes, document review, approvals and payment-confirmation tasks. Plain-language resolution actions; never color alone. Persist material reasons.
- **Contractor portal:** own authorized current/historical settlements, loads, calculations, obligations/balances, YTD, status, permitted documents, downloads and disputes. Server authorization independent of internal administration.
- **Documents:** agreement, authorization and supporting metadata separate from calculations; private storage, uploader/date, retention and access controls.
- **Reporting:** company-scoped financial/operational/risk aggregates with source drilldown and authorized exports. Historical reports and repeatable PDFs derive from approved snapshots.
- **Simulator:** explicitly marked, isolated what-if calculations; never mutate authoritative records. Applying a scenario requires explicit permission and action.
- **Notifications/adapters:** in-app/email preferences and observable delivery, no unnecessary financial disclosures. Stable retry-safe adapters for accounting, TMS, fuel, imports, documents, 1099 and future authorized payment providers.

## Financial and security invariants

Money uses safe integer cents and integer basis points with deterministic rounding. Individual effective-dated compensation supports percentage, flat per load/period, per mile, manual earnings and verified configured combinations. No universal percentages or invented workbook rules. Deduction rules support fixed/percentage/per-load/per-mile/installment/manual methods and one-time/payroll/calendar/balance-limited frequencies. Draft calculations consume no balances; final recovery cannot exceed the ledger balance.

Lifecycle: DRAFT → REVIEW → explicit APPROVED → permitted payment-state transition → LOCKED. Cancellation and compensating reversal/adjustment preserve history. Approval must atomically lock/revalidate sources and balances, store immutable snapshots, post ledger and audit, enforce idempotency and reject partial completion. No live payments without a separately designed, authorized integration. Official YTD includes approved history and compensating corrections only.

Membership supports OWNER_ADMIN, PAYROLL_SPECIALIST, PAYROLL_MANAGER, APPROVER, FINANCE, AUDITOR, CONTRACTOR and explicit combinations. Verify production sessions and memberships server-side for every private operation. No privilege inferred from email or preview state. Tenant scope must exist in queries, constraints, policies, exports, documents and portal records. Sensitive actions may require recent MFA. No real PII or secrets in fixtures/logs.

Preserve PayCore/ETL GIS Consulting LLC branding, responsive accessible design, existing functionality, tests and Vercel/CI compatibility. Use restrained visuals, keyboard/focus support, clear hierarchy and plain-language exceptions. Sensitive calculations run server-side. Paginate large registers; index company/contractor/period/source lookups. Nonessential integrations cannot block financial review.

## Delivery sequence and launch gate

1. Production domain foundation: identity, memberships, authorization, contractor/rules/activity, ledger and audit.
2. Payroll intelligence: deterministic engines, workbench, exceptions, readiness, explanations, YTD.
3. Financial control: transactional approval, immutable snapshots, reversals/adjustments, reproducible statements, audit and separation of duties.
4. Experience/scale: secure portal, documents, inbox, notifications, analytics, simulator.
5. Integration platform: idempotent import framework, adapters, retry/duplicate monitoring, explicit payment integration boundary.
6. Commercial hardening: security/tenant tests, dependency scanning, tested backup restore, load/accessibility review, production/error monitoring and operational runbooks.

Launch requires every definition-of-done criterion in the owner's specification, including genuine authentication, persistent tenant-isolated data, complete audit, transactional exactly-once approval/balance posting, historical reproduction, operational monitoring and tested restoration. A passing static build or preview deployment is not launch clearance. Never merge automatically.

See [implementation evidence](STATUS.md) and [the first foundation increment](DOMAIN-FOUNDATION.md). The original workbook remains a private business-rule reference; verified rules require synthetic regression cases before implementation.
