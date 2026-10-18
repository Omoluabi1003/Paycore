# Freight invoice exhibit

Optional load number, pickup name/address and delivery name/address belong to each invoice line. Expand “Load, pickup and delivery” to enter these facts. Customer phone/fax are optional. Customer reuse includes those contacts. Existing service invoices remain valid without freight fields.

Unsaved read-only previews and exported PDFs show the entered freight details. These descriptive facts never create deductions, payroll activity or payment instructions. Invoice amounts continue to use integer cents and quantity thousandths. First-save automatic numbers and immutable finalized snapshots are preserved.

Exhibition storage remains scoped to the current browser tab/profile/company. This is not a production invoice service, cross-user sequence, email delivery or payment integration. Only synthetic data is used for verification.

Validation: full test suite, typecheck, production build; desktop/mobile entry, preview, saved-edit retention and PDF export. Freight regression covers persistence, finalization, unchanged amounts and field limits.

Rollback: revert this focused change. Earlier records remain compatible; previously exported PDFs remain unchanged. Keep browser data backups if retaining the newly entered optional route fields across rollback.
