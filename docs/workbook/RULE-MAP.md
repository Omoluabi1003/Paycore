# Client workbook → PayCore acceptance map

This map was derived by read-only local inspection of the supplied workbook: one worksheet, 75 rows, 17 columns, 26 formulas. No workbook, contractor identity, bank details, raw monetary values or source percentage values are committed. All regression data is independently invented and clearly synthetic. Formula cell references below identify structure, not production policy.

## Observed structure and explicit interpretation

| Workbook area | Observed behavior | PayCore interpretation / evidence |
| --- | --- | --- |
| Identity/period header, rows 2–12 | Contractor, dates, rates and YTD fields | Explicit specialist-entered contractor, pinned working period, per-contractor effective agreement; no automatic roster |
| E18, E25, C46 | Sum of load amounts less an embedded percentage, then reused as earnings | Configured compensation engine; exact percentage and meaning of retained share **unconfirmed**, never copied as a default |
| G18, G25, C47 | YTD column sum and carry-forward | Approved-history `yearToDate`; no editable accumulated total or current-draft inclusion |
| C29:C41, C42 | Categorized deductions summed once | Structured deduction lines and grouped statement; cash advance, escrow, insurance, fuel, separate truck/trailer registration, IFTA, factoring, maintenance, other |
| D29:D41, D42, H47 | YTD deductions sum/carry | Approved snapshots and compensating corrections only; workbook opening-history migration still requires verification |
| K46 | Earnings less deductions | Deterministic net; explicit reimbursements/adjustments when entered; synthetic exact-cent regression |
| K47 | YTD earnings less YTD deductions | Approved-history engine; never add drafts or silently omit approved reversals |
| K21, K25 | Net carried into another summary/payment-facing section | Snapshot-based statement presentation, explicit demo status; no real payment inferred |
| K59 | Fuel-detail amounts summed | Fuel deduction transactions are the detail source. Optional expected detail total reconciles; it is not another charge. Mismatch blocks approval |
| G71, H71 | Loaded/empty mileage column sums | Load records retain separate loaded/empty miles; keep mileage distinct from revenue |
| K64:K69, I71, K71 | Individual load revenue multiplied by embedded percentages; load/earnings totals | Per-source configured compensation and load explanations; no common rate assumed across contractors |
| C38 | Percentage applied to one referenced load amount | **Owner confirmed: selected loads only.** New explicit `SELECTED_LOAD_REVENUE` factoring base with selected eligible load IDs; no all-revenue fallback |

The worksheet contains independent, manually populated areas. A visible fuel detail total does not prove a formula links it to the summary fuel cell. Likewise, similar amounts in the two load sections do not establish identical source records. PayCore links each entered fact by ID and shows it once rather than reproducing manual copying.

## Confirmed requirements implemented in this increment

- Truck and trailer registration have distinct rule/transaction categories and statement rows. Existing unspecified registration remains supported; historical snapshots are not relabeled.
- Fuel detail is summed from its source transactions. Optional expected source-total mismatch/invalidity blocks approval. The expected total is retained in snapshots and through grid edits.
- Selected-load factoring requires a nonempty, unique set of eligible same-contractor, same-period loads and an explicitly configured rate. Excluded/missing loads, duplicated IDs or ignored selection fields fail closed. Unselected revenue never increases the charge. The UI requires individual detailed loads rather than treating a period-total grid entry as a specific load.
- The review screen presents loads/earnings, grouped deductions, net and approved-history YTD in a workbook-familiar layout. Demo PDF includes category summaries. No workbook money or hidden percentage is imported automatically.

## Unconfirmed rules: do not claim exact production workbook parity

1. The actual percentage agreements and effective dates for each contractor.
2. Whether the top-level retained share and lower driver share are the same agreement, separate business arrangements, or separate statements.
3. Rounding: the sheet has unrounded percentage formulas; display formatting is not proof of financial rounding policy. Aggregate-before-rounding, per-load rounding, and subtracting a rounded retained share can differ by a cent. Existing PayCore per-source half-away-from-zero behavior remains unchanged pending confirmation.
4. Which particular load records incur factoring in each period, plus the authorized rate/frequency. The owner confirmed selection scope, not a universal rate or a permanent load set.
5. Fuel responsibility/authorization, recurring versus manual treatment, opening advances/escrow and historical YTD completeness.
6. Any adjustment or reimbursement business rules not established by the sheet.

## Synthetic acceptance cases

`tests/workbook-parity.test.mjs` creates independent two-load revenue, a configured synthetic compensation rate, separate fuel receipts and registration charges, a reimbursement and a selected-load factoring rule. It asserts exact earnings, fuel detail/category agreement, total deductions and net; unselected revenue has no factoring effect. It covers multiple explicit factoring loads, missing/excluded/duplicate selection denial, fuel mismatch approval blocking, frozen reconciliation evidence, approved-only YTD and grid-edit retention.

These tests establish behavior of explicit rules, not agreement with private cached workbook outputs. Before accepting production migration, the client must verify the remaining interpretations and authorize private comparison against trusted workbook outputs. Preserve discrepancies as exceptions; never change tests to hide them.

## Privacy, rollout and rollback

The uploaded workbook remains outside the repository. No external workbook upload, automatic import, live database migration or payment action occurs. New schema fields/categories are additive; old configured rules and public fictional fixtures keep their behavior. Existing explicitly configured factoring bases remain compatible; the new client-facing factoring form only creates selected-load rules. Existing approved snapshots are never recalculated. Production database enum/schema changes require a separate reviewed migration once a production store exists. Rollback by reverting these additive rules/UI/helpers and tests; retain approved evidence and do not rewrite history.
