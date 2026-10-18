# Reports exhibition increment

## Finding the feature
Open Reports in the workspace navigation, then choose Invoices or Contractor payroll. Invoice-only users can choose Open reports before setting up any payroll schedule. Reports load on demand. Entered invoice drafts stay mounted when switching into Reports, preserving unsaved edits until the user saves, cancels or leaves the workspace/period.

## Data and filters
Reports open on Finalized records, across available years. Invoice dates filter by issue date; payroll dates filter by period end, as their labels state. Year, from/through dates, status and customer/contractor search combine. Reversed date ranges show a plain-language error. Tables paginate at 25 rows, preserve record-level preview and never communicate status with color alone. Tabs support arrows/Home/End; controls have explicit accessible names.

Invoice summaries display finalized invoiced amounts, recorded receipts net of reversals and outstanding balances. Draft amounts have a separate card; void records do not contribute to receivables. Drafts and voids can be inspected explicitly. Invoice report previews show current recorded receipts and balances, with a do-not-pay label on void records.

Contractor summaries show earnings, automatic plus entered deductions, reimbursements, adjustments and net settlements. Financial records derive from approved snapshots and available approved history. History is deduplicated by company/run/contractor; other-company records are excluded. Draft projections require an explicit Draft/All filter and a valid grid; incomplete edits never surface last-valid figures as current. Historical payment state and original header files are not fabricated. Employee taxes, bank clearing and actual payment execution are not implemented.

These are exhibition company/profile boundaries, not production authorization. Invoice records remain browser-tab scoped. Payroll history available in the session is not a durable archive. No private reference document or client identity/figures are committed.

## Download behavior
Summary PDF/CSV requires a nonempty filtered set containing finalized records only. The files identify the company, filters, source rows, totals and fictional exhibit status. Summary PDFs embed the supplied italic and bold italic fonts, repeat headings when paginating, and preserve negative amounts. CSV cells protect against spreadsheet formula injection. Summary totals use BigInt cents to avoid precision loss when aggregating many individually safe amounts.

Select 1–50 finalized non-void invoices to download a combined PDF. Each invoice starts on its own page with its own identity/status; original issued figures and current recorded receipts are retained. A page-level checkbox selects only downloadable rows; changing filters clears selection. Summaries use the entire filtered result, while document bundles use the explicit selection.

Select current approved contractor statements for a combined PDF. The renderer filters original snapshots by contractor ID without renumbering statement IDs or replacing approval/header/history. Existing full-payroll exports are unchanged. Historical rows without their original document header remain previewable and included in approved summary downloads, but individual historical statement downloading stays unavailable rather than inventing a document. No email is sent or funds moved by report actions.

## Deployment and rollback
No migrations, environment variables, dependencies or storage-format changes. Stack on the document-preview PR; do not merge automatically. Revert this increment to remove Reports and selection-based exports, retaining upstream invoice/payroll previews and existing final document downloads.

## Verification performed
All 21 test files pass; typecheck, production build and whitespace checks pass. Synthetic regressions cover date/status/search filtering, company scoping, approved-history deduplication, invalid-draft suppression, draft/void receivable exclusion, partial receipts, BigInt aggregate formatting, original statement-ID preservation, forbidden historical document selection, invoice bundle validation, summary pagination/determinism and CSV formula protection. Existing tests were not weakened.

Production-build Chromium at 1440x900 and 390x900 exercised invoice-only reports before schedule setup, finalized/default and explicit draft filters, dates/search/errors, draft download gating, row previews, unchanged session storage during reporting, returning to unsaved invoice notes, invoice summary PDF/CSV and selected invoice PDF downloads, payroll draft previews, explicit human review/approval, approved summary and selected statement PDFs, and historical summaries after advancing to the next period. Historical document selection remains disabled. No runtime errors or document overflow. Desktop/mobile screenshots inspected; PDF extraction verifies exact totals and original statement identifiers, and both italic fonts are embedded. Synthetic example: $100 invoiced less $25 recorded receipt leaves $75 outstanding; $1,000 revenue at entered 50% yields $500 contractor earnings/net.
