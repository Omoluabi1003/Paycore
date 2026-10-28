# Factoring invoice template

The invoice document follows the supplied freight-template structure: company contact card on the left, actual PayCore logo on the right, invoice number/date above broker billing, separate right-hand factoring/remittance block, shaded load/pickup/delivery descriptions and an amount column, followed by totals and payment/contact instructions. PDFs embed the supplied Century Gothic Italic and Bold Italic fonts and retain ETL GIS Consulting LLC attribution.

Enter the authorized Sunbelt (or another factor) name, address and contact through the collapsed factoring section in the draft editor. No client identity/address is hard-coded or silently assigned to another company. Factoring information freezes with the finalized invoice and survives tab storage restoration. It does not generate deductions, send email or move funds.

The invoice preview and PDF omit the due date. The internal due date remains for existing receivable/overdue tracking and reports; this change does not rewrite it or discard existing invoice facts. Other company contact, notes, payment instructions, charges and calculation rules remain available. Existing invoices without factoring fields still render.

Verification: full automated suite (21 test files), typecheck, production build; desktop (1440px) and mobile (390px) entry, unsaved preview, saved-edit retention, finalized PDF export, no page overflow or browser errors. PDF visually inspected. Regressions verify due-date omission, two-column placement, persistence/immutability, unchanged totals, field limits and multi-page load rendering. All fixtures are synthetic.

Limitations: browser-tab exhibition storage only; no production persistence, payment or factoring integration. The responsive preview shares the document structure but is not an exact pagination simulator. Existing exported PDFs are not modified.

Rollback: revert this focused change. Old invoices remain compatible. Preserve browser data if keeping newly entered factoring fields during a rollback; older code will not retain unknown fields if an invoice is resaved.
