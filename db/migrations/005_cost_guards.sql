-- Apply with the migration identity before the cost-guard code.
BEGIN;
CREATE TABLE request_rate_limits (
 user_id text NOT NULL, bucket text NOT NULL CHECK(bucket IN ('documents','mailbox-management')),
 window_started_at timestamptz NOT NULL DEFAULT now(), hits integer NOT NULL CHECK(hits>0),
 PRIMARY KEY(user_id,bucket)
);
ALTER TABLE request_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY own_request_limits ON request_rate_limits
 USING(user_id=nullif(current_setting('paycore.user_id',true),''))
 WITH CHECK(user_id=nullif(current_setting('paycore.user_id',true),''));
REVOKE ALL ON request_rate_limits FROM PUBLIC;
-- Internal scheduler metadata, like gmail_sync_jobs; never exposed to browser APIs.
CREATE TABLE mailbox_scheduler_gate (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), owner uuid,
 lease_until timestamptz, next_allowed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO mailbox_scheduler_gate(id) VALUES(true);
REVOKE ALL ON mailbox_scheduler_gate FROM PUBLIC;
ALTER TABLE gmail_sync_jobs ADD COLUMN consecutive_failures integer NOT NULL DEFAULT 0 CHECK(consecutive_failures>=0);
COMMIT;
-- Runtime grants, issued by the administrator for their actual runtime role:
-- GRANT SELECT,INSERT,UPDATE ON request_rate_limits TO <runtime_role>;
-- GRANT SELECT,UPDATE ON mailbox_scheduler_gate TO <runtime_role>;
-- Existing gmail_sync_jobs grants remain necessary. Do not grant membership writes.
