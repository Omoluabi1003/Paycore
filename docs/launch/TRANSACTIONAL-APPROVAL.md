# Transactional payroll approval service

This increment implements the application-level approval coordinator, not a deployed approval endpoint or production database adapter. Existing public demo approval remains disabled; no UI, session provider or payment integration is changed.

## Behavior

`approvePayroll` receives only a company selector, run ID, expected reviewed revision, idempotency key and review reasons. Actor, role, rates, calculations, balances, snapshots and dates are never accepted from request payloads. Identity and membership are verified on the server before repository access and rechecked after waiting for locks. Recent MFA and explicit APPROVER permission are mandatory. A company-controlled separation-of-duties policy can require a different person from the preparer; policy/metadata is validated and must come from the repository.

The service recalculates every contractor with the existing deterministic engine. Each applicable balance-limited rule must map to exactly one locked same-company/same-contractor non-escrow account. Ledger-derived balance replaces any stale rule balance before calculation. Zero balance produces no recovery; final installments are capped by the engine. Snapshot, source claims, automatic-deduction occurrence claims, exact linked ledger recoveries, receipt and safe audit metadata form one immutable commit bundle. All contractors validate before the first persistence call.

Approvers do not receive unrestricted finance posting permissions. `prepareApprovedRecovery` permits only the exact automatic deduction total of the freshly calculated approval snapshot and constructs deterministic scoped recovery IDs. It rejects escrow mappings; escrow accrual/release automation requires separate reviewed rules. Never expose this helper as a public arbitrary-posting endpoint or feed it a browser-provided approved snapshot.

Retries are bound to company, run, expected revision and canonically ordered review reasons. A committed matching receipt returns its original immutable snapshots without new writes. Reusing a key for a different request fails. Already approved/paid/locked/cancelled/reversed payroll cannot be approved under another key. Existing recoveries without an approval receipt fail as inconsistent data.

## Database adapter contract: launch blocker

`ApprovalRepository.transaction` must provide real all-or-nothing rollback, isolation and account/source/rule/run locks. The adapter must:

- Use verified tenant-scoped, least-privileged access. The selected company is never authorization by itself.
- Lock the run and all contributing source/rule/contractor/balance records in a deterministic order. Load complete relevant approved history inside those locks. Preserve original source eligibility and history checks.
- Maintain a reviewed revision that changes whenever any contributing source, mapping, policy or effective rule changes. Commit with compare-and-set status and expected revision.
- Atomically insert immutable approved snapshots, receipt, source claims, occurrence claims, recoveries and audit rows, and transition the run to APPROVED. No externally visible partial state.
- Uniquely constrain tenant-scoped receipt keys, source claims, contractor/rule/occurrence claims, balance posting IDs/source/idempotency keys, and account reversals. Prevent overlapping approved periods for a contractor with transactional validation and an appropriate exclusion/uniqueness strategy.
- Keep approved snapshots and ledger/audit history append-only at the database level. State changes such as paid/locked require separate authorized, audited operations; never edit the financial snapshot.
- Retry only transaction-safe serialization conflicts. All external notifications run after commit via a durable idempotent outbox. This service never sends email or initiates payments.

The in-memory test adapter serializes transactions and stages writes before commit so failures demonstrate service rollback and retry behavior. It is located in tests only. It is not proof of PostgreSQL isolation, row policies, lock order or durable exactly-once execution. A real disposable-database test suite must cover competing runs, crash/timeout retries, source/occurrence reuse, policy changes, pooled tenant isolation and rollback before enabling a production endpoint.

## Verification and rollback

Regression tests cover authorized approval, ledger-reloaded final installments, zero balance, immutable snapshots, source/occurrence claims, concurrent matching retries, key conflicts, whole-bundle rollback, permission/MFA/revocation denial, stale revision, separation of duties, missing balance mapping, calculation blockers and multi-contractor validation failure. The existing full suite, TypeScript and production build remain required. No browser flow changes; responsive behavior is unaffected.

No schema migration or environment variable is added and no live service is provisioned. Rollback by reverting the coordinator and approval-recovery helper; no stored records need changing. Future deployed financial corrections must use compensating transactions rather than deleting approved history.
