# Fuel receipt detail table

Run payroll → Add detailed loads, charges, or adjustments → Fuel receipt details and source check now provides the six requested columns: date, document number, description/fuel card used, place or store, city & state, and amount. Use card labels or last four digits, not full payment-card data.

Choose a contractor and enter one receipt on the blank row, then Add fuel receipt. Entries create ordinary FUEL_DEDUCTION transactions in that contractor/pay period; existing fuel deductions appear in the same table automatically. The footer totals the saved receipt rows in integer cents. Possible repeated references are flagged using existing duplicate checks. An optional expected source total compares the receipts without adding a transaction or deduction. Mismatches continue to block approval through the existing engine. Clearing the source check leaves all receipts/deductions unchanged.

As requested, this release changes the six columns only. It does not add a company-paid/no-deduction option or reinterpret the example's green “No deduction to driver” text. All listed receipts retain the existing fuel-deduction behavior. Other deduction rules and approved amounts are not changed.

Draft receipts can be corrected with a reason. Place/store and city/state travel with the original/changed correction evidence, saved drafts, calculation snapshots and the statement PDF's existing six-column detail section. Legacy receipts with no stored location display a dash; their locations are not guessed or copied from examples. Approved history stays frozen. Nothing is automatically approved or paid.

On narrow screens the table scrolls horizontally within its card. The surrounding page remains responsive. The data is still part of the existing local workspace; this does not add production authentication or a shared database.

Validate add/correct flows, duplicate-reference warnings, exact totals, source match/mismatch, no double deduction, saved-draft recovery, snapshot/PDF locations, and mobile layout. Roll back by reverting this PR and redeploying; no data migration is required. Export needed records before rollback because older schema parsers may strip the optional location fields when saving. Core financial fields remain compatible.
