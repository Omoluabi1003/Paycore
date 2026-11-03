-- Apply after 002 with the migration/admin identity, before deploying Microsoft support.
BEGIN;
ALTER TABLE gmail_mailboxes ADD COLUMN provider text NOT NULL DEFAULT 'GMAIL' CHECK(provider IN ('GMAIL','MICROSOFT'));
ALTER TABLE incoming_documents ADD COLUMN source_provider text NOT NULL DEFAULT 'GMAIL' CHECK(source_provider IN ('GMAIL','MICROSOFT'));
ALTER TABLE incoming_documents ADD COLUMN source_url text;
ALTER TABLE gmail_processed_messages ADD COLUMN provider text NOT NULL DEFAULT 'GMAIL' CHECK(provider IN ('GMAIL','MICROSOFT'));
ALTER TABLE gmail_processed_messages DROP CONSTRAINT gmail_processed_messages_pkey;
ALTER TABLE gmail_processed_messages ADD PRIMARY KEY(mailbox_id,provider,message_id);
COMMIT;
