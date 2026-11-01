# Invoice paperwork and saved company settings

Freight invoices use customer billing details, load reference, pickup/delivery and agreed line amounts. The preview, individual PDF and invoice bundle omit generic freight descriptions and quantity/unit arithmetic. The total remains authoritative integer-cent arithmetic; nonzero discounts, taxes and additional costs remain itemized. Zero adjustment rows are omitted. Generic service invoices retain their descriptions and ordinary notes/contact fields.

Factoring invoices show one standardized payee instruction, generated from the configured factoring company. Duplicate entered payee instructions are removed, including equivalent legal-suffix variants. Distinct entered payment terms remain in the same instruction block. Free-text instructions are retained when no factoring payee exists. Freight notes and invoice-contact boilerplate remain stored for internal use and do not appear on outgoing paperwork. Previous issued versions remain available when a correction is explicitly saved; historical stored facts are preserved.

Save recurring details under **Invoices → Company letterhead and factoring settings**. Company address, contacts, MC/USDOT identifiers, factoring name/address/contact and an authorized factoring invoice email are reused for new documents. Company fields on invoice drafts are read-only and come from these settings. Changing settings updates new/editable drafts; issued invoices keep their recorded letterhead. Payroll statement company details can also save the reusable company header. Payroll numbers and invoice pay dates remain specific to their period and do not carry forward as company defaults. The existing saved payroll schedule and contractor agreement carry-forward are unchanged.

Company settings are validated and stored locally under the current display profile/company key. They persist on the same browser/device; they are not a secure shared company database or verified identity. Changing the active profile/company remounts the workspace to avoid reusing the previous profile's in-memory records. Save drafts before changing profile. Bad settings do not prevent the saved payroll schedule from loading. Storage failure reports an error rather than claiming a successful save. Back up needed records before clearing browser data.

Invoice and payroll email preparation uses only the authorized factoring email configured in Company settings. There is no customer-email fallback, automatic recipient extraction from free text, hard-coded Sunbelt address, CC/BCC or automatic sending. Missing/invalid configuration blocks email preparation. Existing finalized invoices need this recipient configured before preparing email. Configure the address after verifying it with the factoring company. The reminder cron remains on safe hold; no live delivery adapter is enabled.

User-provided reference PDFs are private inputs and are not committed. Regression fixtures and rendered review documents use fictional data only. Validate the test suite, typecheck, build, preview/PDF agreement, email recipient, saved-setting reuse across refresh/periods, and responsive screens. Roll back by reverting the PR and redeploying. Older code strips the optional factoring fields; financial record schemas remain backward compatible. Preserve local company-settings storage before rollback if those settings will be needed later.

## Freight entry

New invoices open in freight mode. Enter only customer billing details, load number, pickup company/address, delivery company/address and agreed price. The description is generated from the load reference and the agreed price is represented internally as one charge. No description, quantity, unit-price or payment-instruction field appears in the freight form. Each new freight invoice starts with one load; existing multi-load drafts are preserved. Standard payment instructions are saved in Company settings and reused with the factoring details.

Invoice number and issue date are automatic. The internal tracking date initially matches the invoice date, is adjustable under Internal tracking and price adjustments, and is omitted from outgoing paperwork. This is not a promise of customer payment terms. Existing dates and price adjustments are retained.

Use itemized service invoice explicitly for non-freight work. Changing an editable service line to freight converts its complete calculated line amount to the agreed-price field, preserving cents and existing adjustments. Finalized invoices remain read-only. The freight details view shows load, pickup, delivery and agreed price instead of description/quantity/unit columns.

## Editing saved invoices

Draft invoices can be reopened with Edit invoice draft. Finalized invoices expose Edit invoice. Saving a correction requires a reason, keeps the invoice number/identity, and records who changed it and when. The prior issued record is stored as a frozen local revision and can be downloaded from Invoice revision history. Cancel leaves the saved invoice untouched. Current corrected PDFs show their revision number; email drafts identify the correction and state that it replaces the earlier version; earlier downloaded/sent files are not changed automatically. Download and share the correction with the factoring company if an earlier version was already sent.

Recorded payments and reversal evidence are preserved. Corrections cannot lower the total below net receipts, erase receipts, change invoice identity/company, or overwrite a stale version. Voided invoices remain closed. This edits invoices only; approved contractor payroll snapshots stay immutable. History is stored locally with the invoice book and is not a server-verified audit trail. There is a limit of 50 corrections per invoice and the existing browser storage size limit still applies.

Before rolling back to an older app version, back up the complete local invoice book including revisions; older code does not understand the new optional revision history and may strip it when saving. No automatic email, refund or payment occurs when an invoice is corrected.

## Fixed footer

Standard invoice footer is a company setting, not a per-invoice entry. If unset, saved company email/phone generate a contact footer automatically. A saved custom footer is reused verbatim. Leaving it blank uses the saved company email/phone; without contacts, no automatic footer is added. The footer prints once in preview/PDF and is captured in the issued invoice/revision snapshot. Internal freight notes remain internal; they are not used as the standard footer. Editing company settings does not rewrite issued records.

### Repairing incomplete company details

Company settings now include an optional legal business name, independent of the workspace display name. Save the full address, company contact, factoring name/address/email once. Saving complete settings refreshes existing drafts and clears their review acknowledgement; finalized invoices retain their original snapshot.

The company settings panel accepts a version 1 JSON setup file containing only `version` and `header`. Import fills the form for review; Save applies it to the active local profile. Import does not select another workspace or upload data. Private customer setup files must stay outside the repository and public PR attachments.

Freight invoices with missing company address or factoring name/address cannot be finalized, downloaded as outgoing PDFs, or prepared for email. The UI also requires complete saved contact and factoring settings before finalization. Existing incomplete records remain readable. For an issued invoice, **Apply saved company details** creates a tracked revision, preserves its number, amounts and receipts, and archives the earlier version. Historical downloads remain available with a historical-copy label, including incomplete originals.

Validation: 213 unit tests, typecheck, production build, and Chromium workflow covering import-before-save, draft synchronization, blocked incomplete output, issued repair, payment/history preservation, refresh and narrow mobile widths. A generated PDF was visually inspected with fictional data. Physical mobile browsers and remote persistence are not verified; settings and invoices remain local to their existing browser/profile storage.

Rollback: revert this change after exporting local invoice records. The legal name is optional; repaired invoice revisions retain their earlier snapshots. Reverting removes the incomplete-paperwork guards and repair/import UI, so review outgoing paperwork manually during rollback. No database migration, authentication provider or live email delivery is introduced.
