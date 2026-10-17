# Preview account and Supabase integration status

The owner authorized temporary simulated sign-in while Supabase integration is deferred. This is a presentation preview, not authentication or a security boundary.

Available now: a fixed fictional account (preview@paycore.example), sign-in, an empty workspace, and sign-out. State lives in client memory; refresh returns to sign-in. No cookies, browser storage, password collection, database calls, or Supabase requests are used. Contractor and payroll sections are informational, with no fictional payroll amounts or record-entry controls.

Use Supabase Free for authentication and PostgreSQL later, subject to quotas. Do not enable paid plans or add-ons without owner approval. Replace preview state with verified server sessions, organization membership, explicit permissions, invitation-only enrollment, account recovery, and MFA before exposing private records. Never use preview state to authorize a read or write. Keep elevated keys server-side.

Adapt the proposed PostgreSQL migration to Supabase verified identity and membership policies. Its transaction-context design is not a ready-to-use browser access policy. Test organization isolation, atomic audits, and persistence against a disposable database. The existing migration has not been executed or integration tested.

Configure email delivery for invitations/recovery, backups and restore checks, and session expiry before production. Account for free-tier quotas and inactivity behavior. Real sign-in, saved records, payroll approvals, and payments are not live. No real payroll workbook or personal information is used.
