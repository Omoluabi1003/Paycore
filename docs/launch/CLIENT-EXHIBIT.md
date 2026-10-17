# Client exhibit: explicitly simulated payroll

The browser demo supports a complete entered-data exhibit without a live identity provider, database, ledger or payment connection. A persistent top notice says Demo mode / No real payments. Consequential controls say Simulate approval, Mark paid in demo and Lock demo payroll. Do not describe these local actions as production connections or actual approval/payment.

## Walkthrough

1. Enter an email/display profile and company label; use fictional details.
2. Set the exact first working period and time zone. Date-based suggestions do not move the chosen period.
3. Add contractor rows, pay terms and period figures. Enter detailed loads/charges/reimbursements/adjustments as needed; avoid entering the same work twice.
4. Optionally configure a demo advance under detailed activity. Enter its outstanding balance and repayment amount. The settlement engine caps repayment at the balance; grid edits preserve this plan.
5. Review earnings and deductions. Acknowledge the statement totals. Record a reason for each calculation warning before approval; blockers cannot be bypassed.
6. Simulate approval. The calculated snapshot freezes and input controls disable. No production service is called and no real balance is consumed.
7. Mark paid in demo, then lock, or lock directly. Financial snapshots never change; a local exhibit event list records transitions and simulated remaining balances.
8. Download demo PDF/CSV files generated locally from the frozen entered figures and selected period. Prepare demo email opens the mail client without recipients or automatic attachments/sending.

Exports only appear at the final lifecycle section after simulated approval. They do not use public fixed-sample export endpoints, which remain available as existing examples. CSV cells neutralize spreadsheet formula prefixes. PDF generation uses escaped ASCII/transliterated text, exact integer-cent money formatting, and automatic multi-page line wrapping; non-Latin typography is not fully supported by the built-in PDF font. Demo YTD is labeled as the current exhibit period, not official cumulative history.

Switching periods retains approved demo snapshots in the current tab. Refresh/sign-out clears figures, snapshots and event history; the browser-local pay schedule/working period remains. There is no claimed durable audit trail, production session, real bank/email connection or contractor portal in this increment. Use synthetic figures only.

## Validation and rollback

Domain tests cover review/blocker/warning gates, frozen snapshots, non-consuming advance previews, payoff cap, state transitions, preservation of financial values, grid-edit preservation of advance rules, entered-data CSV/PDF, formula-prefix escaping, exact safe-integer formatting and PDF pagination/xref offsets. Browser validation covers the entered-data lifecycle, matching downloads, editing lock, period restoration and mobile page containment.

No schema migration, environment secrets or payment integration is introduced. The existing protected production-domain services remain separate and are not imported by this client exhibit. Rollback by reverting demo components/helpers and workspace wiring; no authoritative records are changed.
