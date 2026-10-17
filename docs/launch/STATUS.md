# Launch readiness: evidence and remaining work

**Commercial launch: BLOCKED.** This is an implementation inventory, not a readiness certification. Existing public demo behavior is preserved. No production identity/database connection or migration has been executed.

| Area | Current implementation | Required evidence before launch |
| --- | --- | --- |
| Identity/session | Demo email presentation; no production provider | Provider-verified sessions, invitation/recovery/MFA, session/revocation/browser tests |
| Membership/authorization | New trusted-server resolver/permission model and own-contractor guards, unit tested | Managed identity and database membership adapters, protected endpoints, denial tests against real services |
| Tenant isolation | Scoped domain guards; older unexecuted context-policy SQL proposal | Identity-backed policies, non-owner runtime grants, cross-tenant and pooled connection integration tests |
| Contractor/rules | Preview manual rows, deterministic effective compensation/deductions | Persistent Contractor 360/onboarding/documents, rule change attribution and activation gates |
| Capture | In-tab period grid and detailed activity | Persistent eligible activity, imports/source IDs, audit and authorized CRUD |
| Compensation/deductions | Settlement unit engine, basis-point rounding, per-contractor rules, occurrence/balance caps | Combination rules, server execution over locked persistent sources, verified workbook coverage |
| Balance ledger | New immutable preparation/replay/reversal domain with integer arithmetic | Durable append-only schema, account locks, unique source/idempotency/reversal keys, atomic payroll and audit writes |
| Approval/history/YTD | Domain snapshot/reversal/YTD functions plus transactional approval coordinator/port; no public live approval | Transactional approval, separation of duties, immutable DB snapshots, exactly-once posting, approved-history integration cases |
| Readiness/exceptions | Visible command center, searchable workbench/activity, Contractor 360 drilldowns, exception center and deterministic readiness in preview | Command Center, persistent resolutions/inbox, source completeness, statistical variance and end-to-end review |
| Statements/exports | Client demo exports from frozen entered snapshots; public fixed fictional samples retained | Authorized exports from immutable real snapshots, unique IDs, reproducible PDFs, payment/YTD metadata |
| Contractor portal | Own-record permission guard only; no live portal | Independent server-scoped portal routes, access/dispute/document/statement integration tests |
| Documents/notifications | No live service | Private authorized storage/retention, preferences, delivery monitoring and safe messages |
| Simulator/analytics | No authoritative implemented subsystem | Isolated what-if calculations, scoped aggregates/drilldown and source evidence |
| Integrations/payments | No live adapters/payments | Retry-safe adapter contracts/imports and explicit payment infrastructure authorization |
| Operations | Existing CI test/type/build and Vercel Git preview | Security review/scanning/headers/rate limits, backups and restore drill, monitoring, load/accessibility/browser evidence |

## Financial regression coverage

Existing settlement tests cover contractor-specific rates, rule conflicts/effective dates, recurring/one-time/installment deductions, non-consuming previews, reimbursement/deduction arithmetic, negative-net review, source duplication/approved reuse, snapshot immutability, approved-only YTD and compensating reversal. These are **domain tests**, not persistence/authorization integration proofs.

New ledger tests cover prepared activity leaving history untouched, exact zero payoff, over-recovery rejection, safe-integer limits, duplicate request replay and payload conflict, duplicate source rejection, immutable entries, exact compensating reversal and company/contractor/account mismatch denial. New access tests cover missing/revoked/expired sessions, membership mismatch, role separation, explicit multi-role approval, recent MFA and own-contractor boundaries.

Coordinator tests now stage snapshot/source/occurrence/ledger/audit writes atomically and cover concurrent retries and rollback using an in-memory transactional adapter. Real-database proof is still missing: approved payroll atomically posts ledger once, retries cannot double-post under database concurrency, whole-run crash rollback, policy-enforced tenant isolation, real provider/session expiry, authorized exports, secure contractor portal, reproducible historical PDFs, tested backup restoration, production telemetry and browser end-to-end launch acceptance. Do not mark these passed based on mocks.

See [transactional approval](TRANSACTIONAL-APPROVAL.md) for the application-service increment and mandatory persistence adapter constraints.

The [client exhibit](CLIENT-EXHIBIT.md) now provides clearly labeled local simulated approval/paid/locked transitions and entered-data exports. These do not satisfy production authorization, persistence, ledger or payment launch gates.

The [operations center](OPERATIONS-CENTER.md) adds visible frontend workflows; production persistence, broader Contractor 360 modules and operational readiness remain launch work.

The [client workbook acceptance map](../workbook/RULE-MAP.md) inventories locally inspected formula structures without private data. Synthetic regressions now cover selected-load factoring (owner-confirmed scope), fuel reconciliation and separate truck/trailer registration. Exact private workbook parity remains unclaimed until agreement rates, section semantics and rounding are verified. The review screen offers a workbook-familiar grouped settlement view.

## Activity desk and demo recovery

The activity register now filters and paginates detailed facts, marks repeated references for review, and allows individually entered draft transactions to be corrected with a reason. Correction evidence retains before/after data in the demo draft. Calculations remain deterministic and corrections reset review. Grid-derived figures must be edited in the payroll desk; loads are currently read-only in the register. Approved exhibits are frozen.

Explicit Save demo draft / Restore saved draft controls use versioned, size-limited sessionStorage, scoped by display profile, company label and pay period. Restore validates record scopes, restores incomplete grid rows without asserting readiness, strips unrecognized/history fields and resets approval acknowledgements. Copies contain fictional data only, are not encrypted backups, and are limited to the current browser tab. Closing a tab normally discards session storage; browser session restoration may retain it. Users can forget the saved copy. No auto-save, production authentication, durable shared storage, receipt upload or production audit service is claimed.

Next production slice: connect authenticated company memberships to a transactional store; enforce server permissions for activity correction, draft revision conflicts and audit events. Infrastructure credentials/providers remain unconfigured. No migration/environment changes in this exhibit increment. Rollback: revert this UI/domain increment and restore the previous deployment; saved demo copies use an isolated key prefix and may be removed without modifying financial history.
