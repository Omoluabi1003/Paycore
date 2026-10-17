-- Apply with a migration identity, never with the application runtime identity.
-- No production migration has been performed. PostgreSQL 15+.
BEGIN;
CREATE TABLE workspaces (
  id text PRIMARY KEY CHECK (char_length(id) BETWEEN 1 AND 256),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  reference text NOT NULL CHECK (reference ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  created_by text NOT NULL CHECK (char_length(btrim(created_by)) BETWEEN 1 AND 256),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, reference),
  UNIQUE (workspace_id, id)
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspaces(id),
  contractor_id uuid NOT NULL,
  actor_id text NOT NULL CHECK (char_length(btrim(actor_id)) BETWEEN 1 AND 256),
  action text NOT NULL CHECK (action = 'contractor.created'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, contractor_id) REFERENCES contractors(workspace_id, id)
);
CREATE INDEX audit_events_workspace_time ON audit_events(workspace_id, occurred_at DESC);
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON workspaces
  USING (id = nullif(current_setting('paycore.workspace_id', true), ''))
  WITH CHECK (id = nullif(current_setting('paycore.workspace_id', true), ''));
CREATE POLICY contractor_scope ON contractors
  USING (workspace_id = nullif(current_setting('paycore.workspace_id', true), ''))
  WITH CHECK (workspace_id = nullif(current_setting('paycore.workspace_id', true), ''));
CREATE POLICY audit_scope ON audit_events
  USING (workspace_id = nullif(current_setting('paycore.workspace_id', true), ''))
  WITH CHECK (workspace_id = nullif(current_setting('paycore.workspace_id', true), ''));
-- Defense in depth, including accidental use of an overprivileged connection.
CREATE FUNCTION reject_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit events cannot be changed or removed';
END;
$$;
CREATE TRIGGER audit_no_update_delete BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_change();
REVOKE ALL ON workspaces, contractors, audit_events FROM PUBLIC;
COMMIT;
