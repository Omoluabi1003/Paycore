# Automatic inbox tracking routes

- `/scan`: Business mailbox connection and automatic-tracking status.
- `/scan/inbox`: extraction exceptions.
- `/scan/activity`: automatically recorded incoming documents.
- `/api/gmail/status`, `/api/gmail/documents`: verified Auth0 session plus live company membership.
- `/api/gmail/connect`, `/api/gmail/callback`, `/api/gmail/disconnect`: authorized OAuth lifecycle.
- `/api/cron/gmail-sync`: secret-authenticated background scanning and extraction.

Private records live in the database, not localStorage. These routes do not accept browser profile claims as identity.

- `/api/microsoft/connect`, `/api/microsoft/callback`: verified company Microsoft 365 authorization. Existing Gmail-prefixed read/scheduler routes support both providers for compatibility.
