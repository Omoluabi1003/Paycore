# PayCore Scan next production gates

The preview experience is intentionally ahead of the production scanning backend. The following gates must be completed before Scan is allowed to create authoritative payroll activity.

## Gate 1: private intake
- authenticated company-scoped upload
- private object storage
- MIME/signature/size validation
- malware scanning where supported
- immutable document fingerprint
- duplicate-document detection

## Gate 2: deterministic extraction paths
- CSV/XLSX parser first
- text PDF extraction
- image/scanned-PDF recognition adapter
- page and source-region coordinates
- raw extracted text retained with normalized candidate values

## Gate 3: financial verification
- contractor matching
- explicit category mapping
- integer-cent normalization
- duplicate candidate detection
- source-total reconciliation
- unreadable/conflicting critical values fail closed

## Gate 4: specialist review
- source beside interpretation
- exact source-region highlighting
- review reason for every override
- actor and timestamp
- reusable layout mapping without learning financial decisions

## Gate 5: authoritative commit
- server-side authorization
- company isolation
- idempotency key
- one database transaction
- candidate-to-payroll lineage
- append-only audit event
- no payment initiation

## Gate 6: historical migration
- separate historical mode
- effective dates never invented
- opening balances require review
- approved historical snapshots distinguish migrated data from native PayCore activity

No gate may weaken the rule: uncertain financial data never silently becomes payroll data.
