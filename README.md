# PayCore

PayCore is a safety-first payroll and contractor settlement platform designed for nontechnical operators.

## Development and build verification

Use Node.js 24 and pnpm 10.34.7 (the version pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level=moderate
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

`pnpm test` runs both `.test.mjs` and `.test.ts` files with Node 24. TypeScript tests use explicit `.ts` imports for the native runner. CI also checks production dependencies for moderate-or-higher advisories before testing and building.

Security maintenance pins Zod 4.6.7 and scopes patched PostCSS 8.5.32 / Sharp 0.35.5 overrides to Next 15.5.28 in `pnpm-workspace.yaml`. Keep the overrides until Next's upstream dependency floors include these fixes; regenerate the lockfile and rerun the audit when changing Next. Zod's history review-reason record uses explicit string keys and values; the saved draft format is unchanged.

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

## Automatic pay periods

The specialist enters the first inclusive start/end range and payroll time zone once. The demo remembers only this versioned schedule in browser localStorage, validates it on load, and calculates the fixed-day cycle containing today's payroll-zone date as a suggestion. The entered working range remains selected until the specialist changes it. Weekly/biweekly and other 1–31-day cycles are supported; calendar-month and semimonthly schedules are not inferred from a single range. Date arithmetic uses calendar days so daylight-saving changes do not shift boundaries. Before the anchor date, the first period appears as upcoming.

The date suggestion refreshes every 30 seconds and when the page becomes visible, without switching the working period. Explicitly opened new periods begin with empty draft entries; earlier in-tab drafts retain their period and can be selected from the period menu. Work, transactions, pay terms, summaries and review use the selected run. The pay-period step is automatic; earnings/deduction review remains manual. No payroll is approved or paid automatically. Schedule storage is browser-local and shared by demo visitors using the same browser; it is not an authenticated organization setting. No payroll figures or identity data are stored with it. Live persistent schedules and drafts remain unconnected. If browser storage is unavailable, the UI states that setup resets on refresh. Fixed sample exports remain separate examples. Rollback by reverting the automatic-period changes and clearing `paycore-preview-pay-schedule-v1` from browser storage.

## Downloads at the end of review

PDF/CSV sample downloads and sample email preparation appear once, after the final statements and totals, only after all preparation steps and review acknowledgement are complete with valid contractor entries and no blocking calculation issues. They no longer appear during setup, home, or data entry. Editing payroll or withdrawing acknowledgement hides the actions until review is repeated. The links explicitly identify fixed fictional samples; generating exports from entered drafts remains unimplemented. Email opens the mail client and requires a manual attachment. No email is sent by PayCore. Revert the preview/workspace changes to restore the prior placement.

## Decorative accounting imagery

A locally hosted, AI-generated accounting desk image decorates only the sign-in story and home welcome panel. Dark navy/teal overlays keep the photo faint; operational forms, grids, statements, and totals retain solid surfaces. The decorative CSS layers contain no semantic information or interactive elements and are hidden in print, forced-colors, and increased-contrast modes. The bundled WebP is approximately 75 KB and requires no external image service. It depicts generic documents rather than real payroll data. Revert the decorative CSS and remove the bundled image to roll back.

## Keep the selected payroll period

Setup opens the exact inclusive range entered, even when today is in a later cycle. The working-period start is remembered alongside the browser-local schedule and restored on refresh. Existing schedules without a working selection open their original first range. Date/visibility refreshes update the current-by-date suggestion only; they never change the selected working period. Open next period explicitly advances by one cycle, while the period selector can reopen retained in-tab drafts. No completion, approval, or payment is implied by changing periods. Payroll figures still reset on refresh. Regression coverage includes October 5–16 entered on October 17, restored selections, invalid selection alignment, and consecutive 12-day periods. Rollback by reverting these selection changes; old schedule validation ignores the optional workingStart property.


## Brand and sharing

The sculptural PayCore identity uses a seven-second opening splash, matching logo and device icons, coordinated PDF marks and a social sharing card. The public sharing destination is https://paycore-1.vercel.app/. Asset downloads are available at `/brand` after deployment. See [brand usage and validation](docs/BRAND.md).
