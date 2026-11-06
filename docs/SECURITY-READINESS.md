# Security readiness review

Status: engineering improvements only; no SOC 2 attestation, ISO 27001 certification,
or HIPAA compliance determination. This document is an implementation map, not an
auditor-approved control assessment.

| Area | Repository evidence | Outstanding operator evidence/action |
| --- | --- | --- |
| Access control | Auth0 integration; company membership/role checks; opaque server-issued capabilities; Brice-only Microsoft management | Configure and enforce MFA, review memberships, test offboarding/session revocation |
| Confidentiality | AES-GCM mailbox/source encryption with tenant-bound context; no-store private routes; no-referrer responses | Verify production TLS, storage encryption, secret custody and rotation; assess browser-local financial records |
| Auditability | Append-only financial/document events, company RLS, transactional document-read events | Central monitoring, access to audit evidence, alert testing, approved archive/retention |
| Browser request protection | Exact configured Origin and Fetch Metadata checks on mailbox mutations; PKCE/single-use OAuth state; baseline response headers | Assess nonce-based script CSP; configure distributed edge/identity-provider rate limits |
| Change and vulnerability management | PR-based changes, tests/typecheck/build, production dependency audit, Dependabot configuration | Branch protection, reviewer rules, enabled scanners, patch response targets and remediation records |
| Availability and recovery | Bounded workers, scoped transactions, scheduler leases | Encrypted backups, measured restore tests, recovery objectives, continuity drills |
| Governance and privacy | Security requirements and implementation limitations documented | Approved policies, asset/data inventory, risk register, vendor assessments, training and retention/deletion procedures |

SOC 2 requires a scoped independent CPA examination; Type II additionally examines
control operation over an agreed period. ISO 27001 requires an operating information
security management system and independent certification assessment. HIPAA applies
based on regulated activities/data and contractual roles, not simply having an
invoice parser. Determine applicability before accepting health information.

For each operator action, assign an owner, due date, evidence location and review
cadence in the organization's controlled tracking system. Do not place private
audit evidence, credentials, payroll exports or health information in this repository.
No production identity-provider settings, database grants, retention policies or
cloud security settings were changed by this refactor.

## Validation and rollout

Run `pnpm test`, `pnpm typecheck` and `pnpm build`. Verify actual production response
headers on successful, failed and redirected API/auth requests; verify OAuth and
invoice/PDF flows in an authenticated staging environment. Confirm the runtime role
can insert document-read events and cannot update/delete audit history. Audit-write
failure intentionally prevents a document read. Monitor resulting event volume and
permission errors. Local tests use synthetic data and do not establish operational
control effectiveness.

No new migration or environment variable is required. `APP_BASE_URL` must be a
canonical HTTPS origin without credentials, paths, query strings or fragments;
HTTP loopback is accepted for local testing. Keep existing migrations 001–004 and
existing runtime-role grants. Local financial records are not migrated by this change.

Rollback code through a reviewed PR if necessary; keep existing records, encryption
keys and audit history. Removing read auditing or private-response protections
reduces safeguards and must be recorded as a control gap. Do not change marketing
or client assurance claims based on this rollout alone.
