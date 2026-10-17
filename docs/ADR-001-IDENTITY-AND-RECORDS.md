# ADR 001: Free managed identity and organization-scoped records

Status: revised for the owner requirement to use free services. Supabase integration is deferred; a clearly labeled simulated account experience is authorized. No identity provider or database is provisioned.

PayCore follows GeoAware-Core security, accessibility, architecture, and human-approval principles while retaining its own payroll domain.

Use Supabase Free for managed identity and PostgreSQL, within its quotas. No paid plans or add-ons without owner approval. Before real record access, configure invitation-only enrollment, MFA, recovery, session verification, and organization membership. Browser-supplied user IDs, roles, and workspace IDs have no authority. Do not infer privilege from an email address.

The current preview accepts an email in client memory only; it is not verified or transmitted. It never collects passwords or personal data. Refresh returns to sign-in; sign-out clears the presentation state. Both screens disclose that Supabase is not connected. This state is not an access control and must not reach any private API or database.

The first planned record contains contractor name and internal reference. Bank details, tax IDs, rates, balances, real imports, approvals, and payments remain unavailable until their controls are implemented. The client walkthrough uses fixed fictional contractor records, guided preparation, calculated sample statements, and sample exports. No real record-entry, approval, or payment action is enabled.

lib/contractors.ts validates the planned server boundary; it is not session verification. db/migrations/001_contractors.sql is proposed and unexecuted. Before using Supabase, adapt isolation policies to verified user identity and explicit organization membership. Do not expose the current transaction-context policy through browser APIs. Elevated credentials stay server-side; runtime database access must be non-owner, non-superuser, NOBYPASSRLS, and least privilege.

For any server transaction-context implementation, set the workspace context transaction-locally, use parameterized queries and explicit workspace filters, and never let context persist between pooled requests. Verify membership before database access. Create contractor and audit rows atomically; duplicate references within one organization must roll back both. Audit records contain identifiers/action/time without duplicating personal fields and must be append-only.

Before exposing records, integration tests must prove cross-organization read/write denial, missing-context denial, duplicate/audit rollback, audit immutability, and pooled context isolation. Browser tests must cover expired sessions, invitation-only enrollment, role restrictions, and protected server operations. Existing unit tests do not prove these integrations.

Configure email delivery for invitations/recovery and independent backups with restore verification. Free-service limits and inactivity behavior require operational planning. The source workbook stays private and is not uploaded to providers as test data.

Payroll calculation remains deterministic. Approved snapshots must be immutable and require human approval. Future AI must not approve payroll, modify bank details, or execute payments; internet research stays separate from private records.

Rollback: revert application deployment independently; do not drop populated tables. Schema rollback requires backup and restore verification.


