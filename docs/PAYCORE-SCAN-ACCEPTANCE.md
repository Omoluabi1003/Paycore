# PayCore Scan acceptance gates

PayCore Scan is a financial intake system. OCR/document recognition is not authoritative by itself.

## Required before production activation

1. Private object storage with organization-scoped authorization and retention policy.
2. Server-side authenticated scan jobs. Never trust company, actor, contractor or approval identity from browser state.
3. At least two representative OCR/document-understanding candidates benchmarked against a labeled payroll corpus containing native PDFs, scanned PDFs, photographs, tables and degraded pages.
4. Critical financial fields must fail closed when uncertain or conflicting. No silent guessing.
5. Source lineage retained for every committed value: document, page/sheet/row or bounding region, raw text and extractor identity.
6. Duplicate document and transaction detection before commit.
7. Integer-cent reconciliation when the source exposes a total. A mismatch blocks commit.
8. Documents without a trustworthy source total require explicit specialist review policy rather than synthetic reconciliation.
9. Transactional commit with an idempotency key. A retry must not create duplicate payroll activity.
10. Scan approval does not approve payroll and never initiates payment.
11. Malware/type/size validation and safe file handling before extraction.
12. Durable background processing with retry limits, dead-letter/failure state and operator-visible status.
13. Audit events for upload, extraction, edits, confirmations, rejection and commit.
14. Tenant-isolation tests, authorization tests, duplicate tests, reconciliation tests and adversarial OCR fixtures must pass.
15. Historical migration remains separate from current-period intake and cannot silently alter approved history.

## OCR quality policy

The product goal is zero silent financial transcription errors, not a marketing claim of infallible OCR. Measure field-level accuracy by document type. Dollar amounts, contractor identity, load/reference numbers, dates, miles and deduction categories receive stricter review rules than nonfinancial descriptive text.

## Operator language

Use: Scan Documents, Scanning, Scan complete, Verified, Needs your attention, Could not read, Review Scan, Approve Scan.

Keep provider/OCR engineering terminology out of the normal specialist workflow.
