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
for this demo. Git pushes to the PR branch should create preview deployments.
Keep the production branch set to `main` and review the preview before merging.

`pnpm-lock.yaml` locks the dependency graph. The workspace configuration explicitly
disables Sharp's optional install script; the platform package supplies its binary.
Next.js and React stay on their existing release lines with patched versions.

Settlement calculations use decimal arithmetic, convert each monetary input to
integer cents with half-up rounding, and round each percentage charge independently
to a cent. Negative settlements retain a review warning. Results outside the safe
integer-cent range fail closed. Tests include the $100.50 at 57% half-cent regression.

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
