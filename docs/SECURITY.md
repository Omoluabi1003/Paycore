# PayCore Security Baseline

PayCore handles financial and personally identifiable information. Production release is blocked until these controls are implemented and tested.

## Mandatory controls

- Authentication with secure session management and MFA support.
- Role-based authorization with least privilege.
- Server-side authorization on every protected mutation and read.
- Explicit human approval before payroll finalization.
- Immutable approved/paid payroll snapshots.
- Append-only audit events for material financial actions.
- Sensitive fields masked by default.
- Secrets only in managed environment variables/secret stores.
- TLS in transit and managed encryption at rest.
- No sensitive payroll or bank data in application logs.
- Input/schema validation at all trust boundaries.
- CSRF/XSS/injection protections appropriate to the deployed stack.
- Rate limiting and abuse controls for authentication and sensitive endpoints.
- Automated dependency and code scanning.
- Versioned database migrations, encrypted backups, and tested restore procedures.
- Session expiry and forced re-authentication for high-risk actions where appropriate.

## Payroll invariants

1. Draft calculations may change; approved snapshots may not silently change.
2. Rates used for an approved run are stored with the run, not looked up dynamically later.
3. Duplicate transaction warnings must be resolved or explicitly acknowledged before approval.
4. Missing required contractor/rate/pay-period information blocks approval.
5. Negative net pay is a blocking warning unless an authorized policy explicitly permits it.
6. Corrections after approval are adjustments/reversals, never destructive history edits.
7. Every approval, reversal, payment-state change, and sensitive configuration change is attributable to a user and timestamp.

## Repository rule

Never commit production exports, SSNs/TINs, bank account/routing numbers, passwords, API keys, access tokens, private keys, or real payroll fixtures.