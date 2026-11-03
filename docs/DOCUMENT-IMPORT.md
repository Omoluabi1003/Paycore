# Incoming invoice and receipt import

Scan accepts one incoming business invoice or receipt at a time. Readable PDFs and text files are parsed locally into editable billing fields. Single-record CSVs support `vendor`, `reference`, `date`, `total`, and optional `address`, `phone`, `currency`, `loadReference` and `kind` columns (with common invoice/receipt aliases). Quoted commas and newlines are supported; multi-record CSVs fail explicitly rather than dropping records. Dates support ISO or US month/day/year; this release records USD only.

PDF extraction uses the pinned PDF.js dependency with a bundled same-origin worker, not a hosted OCR or AI service. Maximum input is 25 MB, 30 PDF pages and 100,000 extracted characters. Images and PDFs without selectable text create a manual-entry review with a clear OCR limitation. No image OCR, Excel import, background processing or email provider is connected. Password-protected/corrupt PDFs surface an error. Ambiguous totals and known foreign currencies leave the amount empty. Extraction is a suggestion; it is never financial approval.

## Review and records

Uploading saves a REVIEW record under the active browser workspace profile. Required reviewed fields are vendor, document reference, calendar date and positive USD amount. Amount validation uses integer cents. Address, phone, category, load reference and contractor/expense label are optional. Assignment is a descriptive link label, not a verified contractor foreign key.

The reviewer must explicitly check the facts against the original before recording. Editing a field resets confirmation. Recording stamps actor/time and makes the record read-only. Approved records appear under incoming documents in the existing Activity Register and at `/scan/activity`. Pending records appear in Exceptions and `/scan/inbox`; the previous fictional Scan Inbox queue is removed. Incoming records do not create customer invoices, payroll transactions, deductions, approval or payments.

Exact SHA-256 duplicates are blocked across active review/recorded entries. Matching normalized vendor/reference values produce a warning; a distinct file requires a separate-document explanation of at least 10 characters. Dismissed reviews remain in local history and do not block a replacement. Duplicate matching is limited to this incoming-document collection; it does not deduplicate against historical manually entered payroll receipts.

Records preserve file name, type, size, fingerprint, extracted text, reviewed values and reviewer evidence. Original binary files are not archived; retain them separately. The current-session file can be downloaded from the review screen. Source text is displayed as escaped text, and source PDFs are not embedded as executable content. No document data is sent to an extraction server.

## Storage and limits

Local records use `paycore-document-import-v1:<encoded-profile-scope>` with the same display-name/company pairing as existing local workspaces. Data survives refresh and route navigation on that origin. Different origins (including PR previews) and profiles have separate collections. Storage is validated before writes and unreadable copies are preserved. Writes read current storage to avoid stale recorded-state overwrites and react to other-tab storage events. Cross-tab localStorage writes are not a database transaction; strict concurrent uniqueness needs the future backend.

This is browser-local profile segregation, not secure user authentication or tenant authorization. Do not treat it as a production payroll archive. There is a cap of 300 records and 8 MB decoded JSON; browser quotas may be lower. Storage failures leave a visible error. No server endpoint accepts private uploads. Secure shared storage, authenticated membership checks, retained original objects, antivirus/OCR processing, durable jobs and billing-mailbox OAuth remain separate backend work before unattended/public handling of private records.

## Verification and rollback

Unit tests cover extraction, ambiguous/foreign totals, real calendar dates, exact cents, review gates, fingerprints, reference-duplicate explanations, immutable recorded state, workspace scope and corrupted state, plus quoted/multi-record CSV cases. Browser checks cover real PDF/text input, persistence, explicit approval, duplicates, image fallback and mobile widths. Production build, typecheck and dependency audit are required.

Rollback by reverting this feature commit. No existing payroll, invoice or approval schema is migrated. Retain the localStorage document key for recovery; reverting removes the UI but should not clear user records. No original files or real company/customer data belong in repository fixtures.

The inbox includes a JSON records-backup download (metadata, extracted text and review evidence, not original files). Store backups privately. Backup restoration is not part of this release.
