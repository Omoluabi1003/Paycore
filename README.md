# PayCore

PayCore is a safety-first payroll and contractor settlement platform designed for nontechnical operators.

## Development and build verification

Use Node.js 24 and pnpm 10.34.7 (the version pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

`vercel.json` selects the Next.js framework preset, overriding a project's stale
"Other" preset that otherwise looks for a `public` output directory after building.
Vercel should use the repository root, Node.js 24,
and the default Next.js output directory. The `build` script runs `next build`;
no custom output directory, static export, or environment variables are required
for the account setup entry page. Live identity and database services are not connected yet. Git pushes to the PR branch should create preview deployments.
Keep the production branch set to `main` and review the preview before merging.

`pnpm-lock.yaml` locks the dependency graph. The workspace configuration explicitly
disables Sharp's optional install script; the platform package supplies its binary.
Next.js and React stay on their existing release lines with patched versions.

Settlement calculations use decimal arithmetic, convert each monetary input to
integer cents with half-up rounding, and round each percentage charge independently
to a cent. Negative settlements retain a review warning. Results outside the safe
integer-cent range fail closed. Tests include the $100.50 at 57% half-cent regression.

## Current implementation status

The public entry page offers an owner-authorized simulated sign-in and a usable sample payroll workspace with clearly labeled fictional contractors, guided preparation, statements, and sample PDF/CSV downloads. It accepts an email in client memory only, collects no passwords, and clears the email on sign-out or refresh. Supabase is not connected; preview state does not authenticate or authorize anyone. Contractor validation and role rules are unit tested; a proposed PostgreSQL migration is committed but has not been applied. Sign-in and saved contractor operations are not live. See [account setup](docs/ACCOUNT-SETUP.md) and [identity decision](docs/ADR-001-IDENTITY-AND-RECORDS.md) for the remaining integration and verification work.

## Product principles

1. **Simple by default**: routine payroll follows a guided workflow with plain-language status and validation.
2. **Financial safety**: calculations are deterministic, currency uses exact decimal arithmetic, and approved payroll is immutable.
3. **Human approval**: PayCore may calculate and flag anomalies, but a human must review and approve payroll before finalization.
4. **Auditability**: every material payroll change records who, what, when, and why.
5. **Least privilege**: access is role-based and sensitive data is exposed only when necessary.
6. **No secrets in source control**: credentials, bank details, tokens, and production secrets must never be committed.
7. **Recoverability**: payroll records require backups, versioned migrations, and tested restore procedures.

## Operator workflow

**Select pay period → review loads → review expenses/deductions → resolve warnings → preview payroll → approve → generate statement/export.**

The operator should not need to understand formulas or database concepts. PayCore explains exceptions in plain language and prevents unsafe finalization when required information is missing.

## Core modules

- Dashboard
- Contractors
- Loads / earnings
- Expenses and deductions
- Payroll runs
- Pay statements
- Reports and exports
- Settings and configurable payroll rules
- Users, roles, approvals, and audit history

## Safety model

- Draft payroll can be recalculated.
- Approval requires explicit confirmation.
- Approved payroll is stored as a financial snapshot and is not silently recalculated when rates or settings later change.
- Corrections to approved payroll use adjustment/reversal records rather than destructive edits.
- Duplicate load/transaction detection and pay-period validation run before approval.
- Sensitive values are masked in normal screens and excluded from application logs.
- Production authentication, authorization, session security, rate limiting, encryption, database policies, backups, monitoring, and dependency scanning are release requirements.

## Initial architecture

Target stack:

- Next.js + TypeScript
- PostgreSQL
- Server-side payroll calculation service
- Schema validation at every trust boundary
- PDF and spreadsheet exports
- Automated unit, integration, authorization, and payroll regression tests
- Vercel-compatible deployment

The original spreadsheet is treated as a business-rule reference and regression fixture, not as the production database.

## Delivery stages

### Stage 1: Foundation
Architecture, data model, authentication boundary, design system, payroll calculation contract, audit model, CI checks, and representative test fixtures.

### Stage 2: Operator experience
Dashboard, guided payroll wizard, contractor/load/expense management, validation center, preview and approval workflow.

### Stage 3: Production controls
PDF statements, exports, role separation, immutable approvals, adjustments, backup/restore validation, monitoring, security hardening, and deployment controls.

### Stage 4: Expansion
Imports, integrations, notifications, multi-company support, configurable jurisdiction-specific compliance, and optional anomaly detection.

## Important scope note

PayCore will calculate payroll according to configured business rules. Jurisdiction-specific tax, employment, contractor-classification, banking, and filing requirements must be validated before those features are represented as compliant or automated.






## Contractor-aware fictional walkthrough

The preview now uses contractor-specific percentage, per-mile and fixed-period agreements, automatic deductions, fictional activity entry and explainable settlement lines. See [calculation architecture and rollback](docs/CONTRACTOR-PAYROLL.md) and the [unexecuted migration proposal](docs/PAYROLL-MIGRATION-PROPOSAL.md). Approval, authentication, persistent audit and payments remain unavailable in the preview. Fixed sample downloads do not include draft edits.

## Manual contractor entry in the preview

The preview starts with no contractors. The specialist explicitly adds each fictional contractor, unique reference, percentage/per-mile/fixed-period pay terms, and optional agreed recurring deduction. Activity entry then supplies loads, one-time deductions, reimbursements, and adjustments; the deterministic settlement engine calculates totals. Changes reset preparation checks and review acknowledgement. Empty payroll cannot complete preparation. Entries remain in browser memory and reset on refresh; live identity, saving, and payments remain unconnected. Fixed sample downloads are separate examples and do not contain entered drafts. To roll back, revert the manual-entry change; no database migration is involved.

## Spreadsheet-style payroll desk

Routine preview entry uses an editable grid with explicit Add contractor row and Remove controls. Tab moves across fields; Enter/Shift+Enter moves down/up the same column. Tab-separated clipboard data fills existing rows only; add rows before pasting. Percentage rates use percentage values (70 means 70%); per-mile and fixed-period rates use dollars. Earnings and net pay are read-only calculated columns. Recurring deductions, period charges, and reimbursements are entered directly. Detailed activity is optional and adds to the period figures; do not enter the same work in both places. Invalid or incomplete edits retain the last valid payroll and block preparation/review until corrected or removed. Amount edits replace grid-managed activity rather than accumulating duplicate charges. All entries remain fictional, local, and reset on refresh. No live integrations or database migration are included. Revert the grid component, helper, and workspace wiring to restore the previous entry forms.

## Personalized demo profile

The preview suggests an editable display name from readable email local parts, without external identity lookup. Role addresses, numeric handles, and ambiguous values require a user-entered name. The user can optionally enter a company name; the sidebar uses that company or a personal workspace label, plus name-derived initials. Edit profile updates labels without resetting payroll. All profile details remain in React state and clear on sign-out or refresh; they never authorize operations or appear in fixed sample exports. Revert the profile helper and preview/sidebar changes to restore generic labels.
