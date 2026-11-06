import DocumentShell from "../../document-shell";
import MailboxWorkspace from "../../mailbox-workspace";
export default function ScanInboxPage() {
  return <DocumentShell current="exceptions" title="Give the exceptions a closer look." description="Find the documents that could not be recorded reliably, with a link back to the original email."><MailboxWorkspace view="exceptions" /></DocumentShell>;
}
