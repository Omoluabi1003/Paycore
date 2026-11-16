# PayCore entry experience and future Auth0 migration

## Present state: local preview, not authentication
`app/animated-access.tsx` is a presentation-only component. It collects a name, email address, and optional company name in an ordinary HTML form. `app/preview-access.tsx` keeps the existing browser-local profile mechanism. This is **not** a login, signup, verified email address, or secure session. The page explicitly says so. Do not ask for passwords in this mode.

The two-panel switch is a visual interaction between **Open workspace** and **Explore PayCore**, not a fake login/signup. Its transitions use CSS only, are responsive, and honor reduced-motion preferences. Opening the workspace continues to use the existing client-side handler and localStorage key (`paycore.workspace.session.v1`); it does not change stored payroll logic or user data.

## Planned secure identity and persistence
The application already declares `@auth0/nextjs-auth0` and `pg` dependencies. That alone does not establish that live Auth0 or database-backed accounts are configured. When security infrastructure is ready:

1. Use Auth0 Universal Login/Signup, configured through the supported Auth0 Next.js SDK routes. Do not implement custom in-app password storage or misrepresent local profile access as authentication.
2. Replace the local `onOpen` entry action with an explicit secure-auth entry adapter or Auth0 redirect **only when** server configuration is complete and tested. Preserve the existing visual introduction, with clear mode distinctions.
3. After Auth0 callback, verify the **server-side session** and map the Auth0 subject (`sub`) to a database user. Persist tenant, organization, and permissions in PostgreSQL, never in client-controlled state alone.
4. Use server-side authorization for all customer data access, organization membership, payroll changes and financial outputs. Apply tenant boundaries in queries and log audit-relevant actions.
5. Provide a deliberate migration/import path for local browser drafts with ownership confirmation, consent, deduplication, and a review step. **Never automatically trust a localStorage profile as a verified account.**
6. Enforce CSRF and session controls through the identity SDK and server; store secrets exclusively in secured environment configuration.

## Acceptance criteria now
- Desktop: two panels occupy one card; clicking *Explore PayCore* slides the colored panel to the other side. The reverse action restores the form.
- Mobile: one intentional card at a time, switch clearly visible and keyboard-accessible.
- Form remains valid and opens the local workspace using the existing callback; no passwords are collected.
- Existing locally saved workspaces continue loading exactly as before.
- The current Samsung Edge navigation is unaffected.
- Validate `pnpm run typecheck`, `pnpm run test`, `pnpm run build`, plus mobile and desktop visual review.

## Rollback
Revert the animated-entry PR: it changes only entry presentation and not the workspace database schema, account model, or secure authentication setup.
