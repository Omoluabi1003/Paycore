# Route map

- `/scan`: extraction and review of supplied fictional samples; private file selection is disabled.
- `/scan?document=<id>`: reopen a sample review/record.
- `/scan/inbox`: pending sample reviews, history and backup download.
- `/scan/activity`: recorded samples, also shown in the Activity Register.
- `/sample-invoice.pdf`: fixed public fictional PDF fixture, with no workspace input.
- `/api/document-access`: fail-closed private-import access status (HTTP 503).

Profile names and sample routes are not authorization boundaries. Every future private-data read and write requires authenticated server-side company membership checks.
