# Phase 1 increment: access and balance-ledger domain

## Implemented

`lib/server/access.ts` validates identity returned by a trusted session-verification adapter, resolves active membership by that verified user and requested company, and issues a frozen in-process access context. Browser-supplied roles/actors have no input path. Permission checks reject fabricated/deserialized contexts. Access contexts are request-local; resolve afresh for every protected operation so membership changes/revocation take effect. Never cache them across requests or send them to a browser.

Owner administration does not automatically grant approval. Assign APPROVER explicitly, including to owners when intended. Specialist prepares; manager reviews/prepares and posts authorized balances; finance posts permitted balance movements; auditor reads; contractor uses only own-record portal access. Sensitive configuration, ledger posting and approval require MFA authenticated within ten minutes. These guards are not a payment execution API.

`lib/server/balance-ledger.ts` models company/contractor-scoped advance, escrow, recoverable expense, company credit and other accounts. Balance derives from signed safe-integer-cent entries. Opening/increase adds; recovery reduces a recoverable balance; escrow release reduces escrow. Reversal exactly negates a same-account original once. Negative balances, unsafe totals, duplicates, wrong signs and scope mismatches fail. The source record retains actor/time/reason; audit metadata contains scoped identifiers without financial amounts or free-text reason duplication.

`prepareLedgerPosting` returns an immutable proposed entry/balance/audit; it does not mutate the supplied history or write records. A matching idempotency key/payload returns the original entry with no new audit. A different payload with the same key fails. This detects retries in the supplied history; it is **not concurrent exactly-once persistence**.

## Required production composition

Use the existing managed-identity decision as a starting point; no provider has been provisioned here. Bind `verifySession` only to a server-side provider verifier that checks session validity/revocation and MFA evidence. Bind `findMembership` only to an authorized membership repository. Never implement either with request form fields, decoded-but-unverified JWTs, client localStorage, preview email or a role cookie.

The future database transaction must:

1. Resolve verified identity/membership, permission and recent MFA.
2. Open a transaction under a non-owner/NOBYPASSRLS runtime identity; set verified tenant scope transaction-locally where applicable.
3. Load and lock the company/contractor/account plus relevant payroll sources/rules; enforce tenant filters and composite foreign keys.
4. Load the scoped ledger history or a verified transactional projection; call the preparation function.
5. For a new result, insert entry and audit plus any approved immutable snapshot/source claims in the same transaction. For a replay, return the original result without another side effect.
6. Enforce database uniqueness for `(company_id, account_id, idempotency_key)`, `(company_id, account_id, source_id)`, entry identity and same-account reversal target. Add FK/check constraints and append-only UPDATE/DELETE/TRUNCATE protection; deny direct client writes. Locking and constraints must serialize races.
7. Commit everything or roll back everything. Only then acknowledge approval or dispatch an idempotent notification job. No real payment action is introduced by this contract.

Ledger account/category semantics must be mapped explicitly to approved compensation/deduction lines. Never turn a draft calculation into a posting or let an untrusted caller assert that a settlement is approved. Refund/credit workflows that intentionally permit negative balances need separate, reviewed rules; this initial domain fails closed instead.

## Migration and integration status

No migration is needed for this pure domain increment and none was applied. Existing `001_contractors.sql` remains an unexecuted proposal; its context-based RLS must not be exposed through browser APIs. The production schema and managed auth integration require a separate reviewed migration with disposable-database concurrency, rollback, immutability, tenant and restore tests. No new environment variables or secrets are required by these modules; provider/DB configuration remains unprovisioned.

The browser workspace continues as a clearly labeled demo. These new modules are not imported by client components or public fixture export routes. They do not make those routes production-authenticated. Browser/responsive behavior is unaffected by this server-domain-only increment; no new browser flow exists to certify.

## Verification and rollback

Run the complete Node test suite, Next type generation/TypeScript and production build. Unit tests use synthetic identity adapters and financial entries only. They cannot establish production service readiness.

Rollback: revert this increment. No stored records, runtime environment, schema, existing UI behavior or external integration is changed. Preserve the owner's launch specification and gap inventory when reverting implementation. Once persistence is implemented, financial rollback must use compensating records and deployment rollback; never delete a populated ledger.
