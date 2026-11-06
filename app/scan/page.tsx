import Link from "next/link";
import { BrandLogo } from "../brand";
import MailboxWorkspace from "../mailbox-workspace";
export default function ScanPage() {
  return (
    <main id="scan-main-content" tabIndex={-1} className="document-page">
      <header className="document-heading">
        <Link href="/" aria-label="PayCore home">
          <BrandLogo />
        </Link>
        <nav>
          <Link href="/scan/inbox">Inbox</Link> ·{" "}
          <Link href="/scan/activity">Activity Register</Link>
        </nav>
      </header>
      <h1>Your inbox. Organized automatically.</h1>
      <p>
        Connect your business mailbox once. PayCore finds invoices and receipts,
        extracts billing details, and records them without manual uploads or
        routine approval.
      </p>
      <MailboxWorkspace />
      <footer className="document-footer">
        Developed by <strong>ETL GIS Consulting LLC</strong>
      </footer>
    </main>
  );
}
