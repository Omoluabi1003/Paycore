# Automatic inbox tracking routes

- `/scan`: Gmail connection and automatic-tracking status.
- `/scan/inbox`: extraction exceptions.
- `/scan/activity`: automatically recorded incoming documents.
- `/api/gmail/status`, `/api/gmail/documents`: verified Auth0 session plus live company membership.
- `/api/gmail/connect`, `/api/gmail/callback`, `/api/gmail/disconnect`: authorized OAuth lifecycle.
- `/api/cron/gmail-sync`: secret-authenticated background scanning and extraction.

Private records live in the database, not localStorage. These routes do not accept browser profile claims as identity.
