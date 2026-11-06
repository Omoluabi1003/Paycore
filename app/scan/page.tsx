import DocumentShell from "../document-shell";
import MailboxWorkspace from "../mailbox-workspace";
export default function ScanPage() {
  return <DocumentShell current="connection" title="Your inbox. Organized automatically." description="Connect your business mailbox once. Keep invoices, receipts and billing details together in PayCore."><MailboxWorkspace /></DocumentShell>;
}
