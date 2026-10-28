# PayCore Scan Inbox

The Scan Inbox is the operator queue for document-processing work.

## Purpose

It separates document intake from authoritative payroll activity. A scan may be scanning, need review, be ready for approval, or be completed without implying that payroll records or payments were created.

## Operator states

- **Scanning**: document processing is still underway.
- **Needs review**: at least one financial or matching decision requires a payroll specialist.
- **Ready**: extraction and reconciliation gates are clear for specialist review.
- **Completed**: the scan review workflow is complete. Production persistence and payroll commit remain separate concerns.

## Safety rules

1. No scan posts payroll activity automatically.
2. No uncertain financial value is silently guessed.
3. Every production financial value must retain source lineage.
4. Duplicate documents and duplicate candidate records must be checked before commit.
5. Source totals and extracted totals must reconcile when a trustworthy source total exists.
6. Specialist approval and payroll approval are separate events.
7. A future production commit must be transactional, idempotent, company-scoped and audited.

The current Inbox is a fictional preview and does not represent connected production storage or OCR.
