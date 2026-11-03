# Route map

- `/scan`: upload and review a real incoming invoice or receipt.
- `/scan?document=<id>`: reopen a local review or recorded document.
- `/scan/inbox`: pending document reviews and local history/backup download.
- `/scan/activity`: recorded incoming documents, also shown in the existing Activity Register.

These are browser-local records, not secure account or tenant boundaries. Production private-data routes will require authenticated server-side membership and authorization.
