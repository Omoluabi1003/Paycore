-- Apply before deploying the Brice-only Microsoft connection restriction.
-- Binding survives disconnection. Account replacement requires administrator recovery.
BEGIN;
ALTER TABLE gmail_mailboxes ADD COLUMN microsoft_owner_id text;
COMMIT;
