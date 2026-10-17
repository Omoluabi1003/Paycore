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
| Readiness/exceptions | Calculation blockers/warnings and explanations in preview | Command Center, persistent resolutions/inbox, source completeness, statistical variance and end-to-end review |
| Statements/exports | Public fixed fictional samples only, shown after review | Authorized exports from immutable real snapshots, unique IDs, reproducible PDFs, payment/YTD metadata |
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
