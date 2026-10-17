# ADR 001: Managed identity and organization-scoped records

Status: proposed; integration blocked on service access. No identity provider or database has been provisioned.

PayCore is moving from a visual prototype to private payroll operations. Follow GeoAware-Core's security, accessibility, architecture, and human-approval principles while keeping PayCore's payroll domain separate.

Use Clerk for managed, invitation-only sign-in and MFA, and Neon PostgreSQL for durable organization-scoped records. This avoids storing passwords in PayCore. Before provisioning, confirm service plans, data region, retention, and organization ownership with the owner. Do not enable public self-registration or derive privilege from an email address.

Verified server sessions supply actor, active organization, and membership role on every read and write. Resolve explicit role mappings on the server; missing or unknown memberships deny access. Browser-supplied roles and workspace identifiers have no authority. Never use the pure access helpers as session verification.

The first supported record is a contractor name and internal reference. Tax identifiers, bank details, rates, balances, and real payroll imports remain out of scope until their storage, retention, and approval controls exist. The public entry page collects no credentials or payroll information. The prior fictional dashboard is not reachable from it.

`lib/contractors.ts` validates the planned server boundary. It is not a live endpoint. `db/migrations/001_contractors.sql` is a proposed migration, not evidence of a connected or tested database. No runtime database credentials or data are committed.

For the runtime, create a dedicated non-owner, non-superuser, NOBYPASSRLS database role. Grant only SELECT/INSERT on the three tables, with no UPDATE/DELETE/TRUNCATE, schema CREATE, or migration permissions. Enable row isolation on every table. Within one transaction, set the workspace context with transaction-local `set_config('paycore.workspace_id', verifiedWorkspaceId, true)`; use parameterized queries and explicit workspace filters as well. Context must never persist between pooled requests. Database context is defense in depth: the trusted server must verify membership first.

Create each contractor and its corresponding audit event atomically in the same transaction. A duplicate reference within an organization must fail without creating either row; the same reference in another organization is valid. Audit rows contain identifiers, action, and time, without copies of names or other personal fields. Do not expose raw database errors to users.

Before exposing records, integration tests against a disposable database must prove cross-organization read/write denial, missing-context denial, duplicate rollback, audit rollback and immutability, and pool-context isolation. Browser tests must prove expired-session rejection, invitation-only access, member role restrictions, and protected server routes. These tests cannot be replaced by the current pure unit tests.

Payroll finalization and payments remain unavailable. Later work must implement immutable approved snapshots and explicit human approval. AI cannot approve payroll, alter bank information, or execute payments. Internet research must remain separated from private payroll data.

Rollback: retain the entry page until access is verified. Roll back application deployment independently; do not drop tables containing records. Any schema rollback needs a backup and restoration check.
