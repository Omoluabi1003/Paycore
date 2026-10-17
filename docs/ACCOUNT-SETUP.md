# Preview account and Supabase integration status

The owner authorized temporary simulated sign-in while Supabase integration is deferred. This is a presentation preview, not authentication or a security boundary.

Available now: an editable required email field, preview entry, an empty workspace, and sign-out. State lives in client memory; refresh returns to sign-in. No cookies, browser storage, password collection, database calls, or Supabase requests are used. Contractor and payroll sections are informational, with no fictional payroll amounts or record-entry controls.

Use Supabase Free for authentication and PostgreSQL later, subject to quotas. Do not enable paid plans or add-ons without owner approval. Replace preview state with verified server sessions, organization membership, explicit permissions, invitation-only enrollment, account recovery, and MFA before exposing private records. Never use preview state to authorize a read or write. Keep elevated keys server-side.

Adapt the proposed PostgreSQL migration to Supabase verified identity and membership policies. Its transaction-context design is not a ready-to-use browser access policy. Test organization isolation, atomic audits, and persistence against a disposable database. The existing migration has not been executed or integration tested.

Configure email delivery for invitations/recovery, backups and restore checks, and session expiry before production. Account for free-tier quotas and inactivity behavior. Real sign-in, saved records, payroll approvals, and payments are not live. No real payroll workbook or personal information is used.

The typed email is used only as in-memory presentation input. It is not verified, saved, logged, sent to Supabase, or submitted to any server. Sign-out and refresh clear it. Any syntactically valid email can open the preview; this grants no access to real records.


## Client walkthrough update

The owner requires a usable client presentation without waiting for Supabase. Email entry now opens the guided sample payroll workspace instead of disconnected placeholder cards. The fixture module contains three fictional contractors and deterministic calculated settlements. Preparation checks and statement breakdowns work in client memory and reset on refresh/sign-out. Real approvals/payments remain unavailable.

Public GET endpoints /sample-payroll.pdf and /sample-payroll.csv export only fixed fictional fixtures. They accept no identity, record ID, or private input. Never replace these public fixture imports with real database reads. Production exports require a separate verified-session and organization-scoped implementation over approved snapshots.

Prepare email uses mailto to open the local mail app with sample wording. It does not send, choose recipients, or attach files automatically. The presenter must attach the downloaded PDF and review/send the draft. There is no email delivery service or charge.
