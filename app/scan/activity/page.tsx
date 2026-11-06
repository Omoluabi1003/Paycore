import DocumentShell from "../../document-shell";
import DocumentRegister from "../../document-register";
export default function DocumentActivityPage() {
  return <DocumentShell current="activity" title="Your paperwork, in one place." description="See the invoices and receipts recorded from your connected mailbox. Open any source email for the full context."><DocumentRegister /></DocumentShell>;
}
