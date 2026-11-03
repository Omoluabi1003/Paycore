-- PostgreSQL 15+. Apply after 001 with a migration identity, not the runtime role.
BEGIN;
CREATE TABLE document_company_memberships (
 company_id text NOT NULL REFERENCES workspaces(id), user_id text NOT NULL,
 company_name text NOT NULL, roles text[] NOT NULL, active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(company_id,user_id), CHECK (cardinality(roles)>0)
);
CREATE INDEX document_membership_user ON document_company_memberships(user_id) WHERE active=true;
CREATE TABLE gmail_mailboxes (
 id uuid PRIMARY KEY, company_id text NOT NULL REFERENCES workspaces(id), email text NOT NULL,
 connected_by text NOT NULL, active boolean NOT NULL DEFAULT true,
 credentials text NOT NULL, checkpoint jsonb NOT NULL DEFAULT '{"phase":"BACKFILL"}',
 connected_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz,
 last_error text, UNIQUE(company_id,email), UNIQUE(company_id,id)
);
CREATE TABLE gmail_sync_jobs (
 mailbox_id uuid PRIMARY KEY, company_id text NOT NULL,
 lease_owner uuid, lease_until timestamptz, next_run_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id,mailbox_id) REFERENCES gmail_mailboxes(company_id,id) ON DELETE CASCADE
);
CREATE TABLE gmail_oauth_states (
 state_hash text PRIMARY KEY, company_id text NOT NULL REFERENCES workspaces(id),
 user_id text NOT NULL, verifier text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE gmail_processed_messages (
 company_id text NOT NULL, mailbox_id uuid NOT NULL, message_id text NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(mailbox_id,message_id),
 FOREIGN KEY(company_id,mailbox_id) REFERENCES gmail_mailboxes(company_id,id)
);
CREATE TABLE incoming_documents (
 id uuid PRIMARY KEY, company_id text NOT NULL, mailbox_id uuid NOT NULL,
 message_id text NOT NULL, source_name text NOT NULL, sha256 text NOT NULL,
 source_encrypted text NOT NULL, fields jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('RECORDED','EXCEPTION')),
 issues text[] NOT NULL, received_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id,mailbox_id) REFERENCES gmail_mailboxes(company_id,id),
 UNIQUE(company_id,sha256), CHECK(sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX incoming_documents_company_time ON incoming_documents(company_id,recorded_at DESC);
CREATE INDEX incoming_vendor_reference ON incoming_documents(company_id,(regexp_replace(upper(fields->>'vendor'),'[^A-Z0-9]','','g')),(regexp_replace(upper(fields->>'reference'),'[^A-Z0-9]','','g')));
CREATE TABLE gmail_document_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, company_id text NOT NULL REFERENCES workspaces(id),
 actor text NOT NULL, action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE document_company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_company_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY own_document_membership ON document_company_memberships
 USING(user_id=nullif(current_setting('paycore.user_id',true),''));
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['gmail_mailboxes','gmail_oauth_states','gmail_processed_messages','incoming_documents','gmail_document_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tbl);
 EXECUTE format('CREATE POLICY company_scope ON %I USING(company_id=nullif(current_setting(''paycore.workspace_id'',true),'''')) WITH CHECK(company_id=nullif(current_setting(''paycore.workspace_id'',true),''''))',tbl);
 END LOOP;
END $$;
-- Internal scheduler metadata only; never exposed by a browser endpoint. It contains no tokens or email contents.
-- Runtime role needs SELECT/INSERT/UPDATE/DELETE here; private tables always use company-scoped transactions.
CREATE FUNCTION prevent_gmail_event_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Document events are append-only'; END $$;
CREATE TRIGGER immutable_gmail_events BEFORE UPDATE OR DELETE ON gmail_document_events FOR EACH ROW EXECUTE FUNCTION prevent_gmail_event_change();
CREATE TRIGGER no_gmail_event_truncate BEFORE TRUNCATE ON gmail_document_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_gmail_event_change();
REVOKE ALL ON document_company_memberships,gmail_mailboxes,gmail_sync_jobs,gmail_oauth_states,gmail_processed_messages,incoming_documents,gmail_document_events FROM PUBLIC;
COMMIT;
