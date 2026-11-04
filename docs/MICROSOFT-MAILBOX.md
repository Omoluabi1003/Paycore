# Microsoft 365 / Outlook mailbox connection

The requested business domain's public MX record points to `*.mail.protection.outlook.com`, identifying Microsoft 365 inbound routing. This does not prove the individual mailbox exists, is licensed, or has authorized PayCore. The Microsoft connector confirms a usable mailbox through Graph during consent. No live mailbox connection or credential provisioning was performed in development.

## Developer setup

1. Keep the Auth0 session, company membership, private PostgreSQL repository, encryption and scheduler setup from `DOCUMENT-IMPORT.md`. Company details and email addresses alone are not account credentials or authorization.
2. Apply `db/migrations/003_mailbox_providers.sql` after 001/002 using the admin/migration identity before deploying this provider support. Existing mailbox/message/source rows remain Gmail by default. Existing financial records are not deleted. Runtime grants from 002 continue to apply to new columns.
3. Register a Web application in Microsoft Entra. For the default `organizations` authority, configure organizational multitenant sign-in; alternatively use the registered app's actual tenant ID/domain for a single-tenant app. Set the exact Web redirect URI to `<APP_BASE_URL>/api/microsoft/callback`.
4. Add **delegated** Microsoft Graph `User.Read` and `Mail.Read`, and request `offline_access` for background refresh. No `Mail.ReadWrite`, `Mail.Send`, application-wide mail permission or shared-mailbox permission is requested. Tenant policy may require the client's Microsoft 365 administrator to approve the app.
5. Configure `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and `MICROSOFT_TENANT_ID` in the deployment secret settings. `organizations` is the default tenant authority. Never request the client's mailbox password in PayCore or chat. Google app credentials are not required for Microsoft-only operation.
6. Preserve the existing `GMAIL_ENCRYPTION_KEY`. Its legacy variable name now protects tokens/originals for both providers. Do not rotate or replace it simply because a mailbox uses Microsoft. Use the same service scheduler and secret; its legacy `/api/cron/gmail-sync` URL handles both providers.
7. Sign into the secure PayCore account, select the authorized company, and choose **Connect Microsoft 365 / Outlook**. The supplied business address is a login hint only. Microsoft performs sign-in and consent. The connected mailbox address comes from Graph, not an editable PayCore profile.
8. Verify a known invoice is imported and a newly received invoice appears on a later scheduled run without a manual upload or approval. Verify source links open the corresponding Outlook message. Do not call the connection live before these checks.

Missing Entra app credentials, missing database/schema setup, or missing client consent cannot be supplied by knowing an email address. Setup screens state what is unavailable instead of inventing a connected mailbox.

## Implementation

OAuth uses read-only delegated scopes, offline refresh, PKCE and encrypted random state bound to the authenticated company/user. Provider-specific authenticated encryption contexts prevent a Google OAuth state from being used on a Microsoft callback or vice versa. State expires after ten minutes and is consumed once. Callback persistence rechecks current company permission. Only owner/admin and finance roles can connect/disconnect.

Graph uses `/me` and the user's Inbox, with immutable message IDs. Initial delta pagination covers existing Inbox messages; the final delta link becomes the incremental checkpoint. Later runs follow validated Graph continuation links, ignore deletions, and check the actual parent folder before recording. Delta expiry restarts a duplicate-safe initial scan. File attachments are downloaded through Graph and enter the same native PDF, text/HTML/CSV and local OCR pipeline as Gmail. Linked/reference/embedded-item attachments remain explicit extraction exceptions. Shared/delegated mailboxes and sovereign Microsoft clouds are not supported in this release.

Continuation URLs are restricted to HTTPS `graph.microsoft.com/v1.0`, with delta cursors limited to message-delta resources. Bearer tokens cannot be forwarded to arbitrary cursor URLs. Outlook source URLs are restricted to known Microsoft Outlook hosts. Tokens and source payloads remain encrypted in the same company-scoped repository; no access token is returned to the browser.

The database records each source's original provider and URL, so changing a mailbox's provider does not rewrite older source links. Processed-message identities include provider to avoid colliding Google/Microsoft IDs. Exact content hashes and normalized vendor/reference checks still prevent duplicate billing records across providers. Refresh tokens are never carried from one provider to another during reconnection.

The public provider hint uses a bounded, cached MX lookup for the known company contact domain. It recommends a connection type; it never grants access, proves ownership or changes an active mailbox provider automatically. Unknown/custom hosts do not get guessed IMAP credentials or scraped login pages.

## Validation and rollback

Unit/integration tests use actual PostgreSQL semantics through PGlite and mocked Graph responses. They cover schema preservation, provider isolation, delta pagination, file attachment extraction, automatic recording, immutable IDs, token rotation, OAuth state replay/cross-user/cross-provider rejection and continuation/source URL restrictions. Live Microsoft consent, tenant licensing/admin policy and production mailbox data remain unverified until deployment setup is complete.

Rollback: disable the scheduler first and disconnect/remove Microsoft scan jobs before reverting to a Gmail-only worker. Do not run old Gmail-only worker code against active Microsoft credentials. Retain source records, provider metadata and the encryption key. The schema additions are backward-compatible with existing Gmail rows; keep them during a code rollback rather than dropping originals or audit data.

## Brice-only mailbox management

Microsoft connection management is restricted to `brice@makfreightservices.com`.
The PayCore Auth0 session must contain that verified email (`email_verified: true`),
and an active company membership with OWNER_ADMIN or FINANCE remains required.
Other company members can retain their permitted document access; they cannot
connect, replace, or disconnect this Microsoft mailbox. Local company profiles,
editable contact details, request headers and a Microsoft login hint do not grant access.

Apply `db/migrations/004_mailbox_owner.sql` with the migration identity before deploying.
The callback validates Microsoft's signed OpenID token, audience, nonce, expiry and
MAK tenant `d2fad647-1619-4648-8d67-16a04f3c3646`, then matches its object ID to Graph
`/me` and requires Brice's primary mailbox address. The Microsoft object ID and
PayCore account subject are retained across disconnects. A different account cannot
replace either binding. Account migration requires reviewed administrator recovery;
there is no browser reset for this binding. Existing unbound Brice connections must
be reauthorized before scanning resumes. Google cannot claim Brice's address.

Brice signs in and consents on Microsoft-hosted pages. PayCore must never collect
his Microsoft password. Entra app registration, secure server credentials, existing
Auth0/database/encryption configuration, and mailbox consent are still required.
To use Microsoft credentials for the PayCore sign-in too, configure the approved
Microsoft enterprise connection in Auth0 Universal Login and ensure it supplies a
trusted verified email claim; do not manufacture verification from a typed address.
No live mailbox has been connected or read during implementation.

Rollback: disable mailbox scheduling before reverting this restriction; retaining
migration 004 is safe. Do not silently revert to unrestricted management.
