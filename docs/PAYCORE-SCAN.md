# PayCore Scan

PayCore Scan is the financial-document intake layer for PayCore. Its operator promise is simple: **Scan it. Verify it. PayCore does the data entry.**

## Operator language

Use human language in the UI: Scan Documents, Scanning, Scan complete, Verified, Needs your attention, Could not read, Review Scan, Approve Scan. OCR, parser, ingestion and extractor terminology belongs in engineering and diagnostic surfaces, not routine payroll screens.

## Pipeline

`Scan -> enhance/classify -> extract -> normalize -> match -> validate -> detect duplicates -> reconcile -> human review -> approve scan -> commit`

The first implementation defines this contract without pretending that a production OCR provider is connected. Future PDF/image OCR, spreadsheets, TMS and accounting adapters must produce the same normalized candidate records.

## Zero-silent-error policy

PayCore must not promise that damaged documents are always machine-readable. The financial safety requirement is stronger: **no uncertain financial value is silently committed.** Low-confidence or contradictory values enter review. An unreadable value blocks approval. A source-total mismatch blocks approval. Possible duplicates block approval until resolved.

Confidence is an internal signal. Routine screens translate it into Verified, Needs review or Could not read. Confidence alone is never sufficient for high-risk financial acceptance when deterministic reconciliation or domain validation disagrees.

## Source lineage

Every extracted value must retain enough provenance to return the specialist to its source: document id, original file name, page or sheet/row, region when available, raw recognized text, normalized value, extractor/version and the specialist's eventual decision. Committed payroll transactions must retain lineage to the approved scan record rather than becoming orphaned numbers.

## Reconciliation

Where the source provides totals, PayCore cross-foots extracted records against those totals using integer cents. Differences block scan approval. Documents without a trustworthy source total require an explicit alternate verification policy before production commit; the preview must not label them reconciled merely because extraction completed.

## Duplicate protection

Use document hashes for exact-file duplicate detection and domain fingerprints for transaction-level candidates such as company + contractor + load/reference + date + amount. Fuzzy duplicate suggestions may assist review but must not silently discard transactions.

## Human authority

Scanning prepares proposed records. It does not approve payroll, create payments or silently alter contractor compensation. The specialist resolves ambiguous mappings and values. Financially material overrides require a reason and audit event. A later server implementation must revalidate scan approval and commit records transactionally; browser state is not an authorization or immutability boundary.

## Planned scanner experience

The workspace should support PDF, scanned PDF, image/photo, CSV and XLSX first, followed by TMS/accounting adapters. Mobile capture should eventually detect page edges, perspective, blur and missing corners before submission. Review should show source and extracted values side by side and highlight the originating page region when supported.

## Historical scan

Historical payroll migration uses the same pipeline but writes only to a staged migration set until reviewed. It may propose contractors, settlements, deductions, compensation history and balances, but it must never invent missing financial facts. Historical YTD must ultimately derive from approved imported settlement history, not an untraceable typed running total.

## Production gates

Before real payroll documents are accepted, PayCore Scan requires authenticated company scope, encrypted private document storage, malware/file validation, retention policy, server-side authorization, durable background jobs, OCR/document provider evaluation, provider privacy review, audit logging, transactional commit, duplicate constraints, monitoring, backup/restore and end-to-end tests. Never send payroll documents to an external OCR service until its data-handling terms and PayCore configuration are approved for the intended customer data.
