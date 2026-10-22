# PayCore Scan next-phase brief

Continue from the current Scan foundation. Do not replace the deterministic payroll engine or weaken financial safeguards.

## Next build

1. Add authenticated, company-scoped ScanDocument, ScanJob, ExtractedField, CandidateRecord, ScanDecision and SourceLineage persistence only after production identity/database infrastructure exists.
2. Add private object storage with file-type, size and malware validation and retention/deletion policy.
3. Implement a provider adapter interface for document recognition. Evaluate OCR/document-intelligence providers using a payroll benchmark corpus before selecting one. Never claim perfect OCR; optimize for zero silent financial errors.
4. Preprocess image/photo inputs for rotation, perspective, blur, contrast and page boundaries. Preserve the original file and transformations as provenance.
5. Add PDF/table/spreadsheet extraction adapters. CSV/XLSX should parse structurally rather than OCR when possible.
6. Build mapping templates keyed to company + source format/version. Learned mappings may propose fields but may not create financial rules.
7. Build contractor matching using stable identifiers first and human-confirmed fuzzy matching second.
8. Build exact-file hashes, source fingerprints and domain duplicate detection. Never silently discard a candidate.
9. Build side-by-side source review with page/region highlighting and zoom.
10. Cross-foot document totals, subtotals and row totals where present. Contradictions override OCR confidence and force review.
11. Commit approved scans through a server transaction with idempotency key, source lineage and audit events. Never let the browser commit an untrusted extracted snapshot directly.
12. Add historical migration mode as staged records separate from live payroll until approved.
13. Add durable background jobs, progress, retry, cancellation and failure recovery for large scans.
14. Add accessibility, mobile capture, keyboard review and bulk-resolution flows.

## Acceptance scenarios

- Exact duplicate document is detected before extraction creates duplicate payroll records.
- A visually ambiguous 6/8 in a dollar amount cannot silently pass when cross-footing disagrees.
- A 70-page statement can process asynchronously and resume review after refresh.
- Specialist can click any extracted amount and locate its source page/region.
- A known recurring report layout proposes prior mappings but still validates current values.
- Unknown contractor does not get silently assigned by fuzzy name alone.
- Source total mismatch blocks approval.
- Possible duplicate transaction blocks or requires explicit resolution.
- Scan approval never approves payroll.
- Re-running an approved scan commit cannot duplicate records.
- Historical scan never alters official YTD until migration approval creates authoritative history.

## UI language

Prefer Scan Documents, Scanning, Reading payroll data, Matching contractors, Checking totals, Checking duplicates, Scan complete, Verified, Needs your attention, Could not read, Review Scan and Approve Scan. Keep OCR/provider/debug language out of normal specialist workflows.
