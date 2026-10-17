# Account and records integration status

The public entry now shows account setup status instead of fictional payroll totals. It does not collect credentials. The logo, splash, richer color palette, and ETL GIS Consulting LLC attribution are retained.

Implemented and locally testable: contractor input validation, explicit role allowlist, actor/workspace attribution, and a minimal audit command. Proposed but not yet executed: PostgreSQL migration with organization isolation, reference uniqueness, and append-only audit storage.

Not implemented or live: sign-in, session verification, database connection, contractor endpoints/forms, persistence, payroll imports, approvals, or payments. Do not represent this branch as production-ready payroll.

Next integration steps:
1. Restore Vercel connector access to the `omoluabis-projects` scope.
2. Connect organization-owned Clerk and Neon resources; keep provider secrets server-side and separate preview/production data.
3. Install and lock provider packages in a network-enabled environment. This session could not download packages; no unverified dependency or fake login has been added.
4. Add managed sign-in and server session verification; configure invitation-only access, MFA, role mappings, and organization selection.
5. Apply and verify the proposed migration in a disposable database with a restricted runtime identity before applying to production.
6. Implement contractor create/list as protected server operations with atomic audits, then verify isolation and persistence end to end.

See ADR-001-IDENTITY-AND-RECORDS.md for decisions and release gates. Never upload the source payroll workbook or real contractor details to the public repository.
