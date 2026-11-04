import Link from "next/link";
import { BrandLogo } from "../../brand";
import MailboxWorkspace from "../../mailbox-workspace";
export default function ScanInboxPage() {
  return (
    <main className="document-page">
      <header className="document-heading">
        <Link href="/" aria-label="PayCore home">
          <BrandLogo />
        </Link>
        <nav>
          <Link href="/scan">Mailbox connection</Link> ·{" "}
          <Link href="/scan/activity">Activity Register</Link>
        </nav>
      </header>
      <h1>Your billing inbox.</h1>
      <p>
        Recorded invoices and receipts flow into PayCore automatically. Only
        extraction issues appear below.
      </p>
      <MailboxWorkspace view="exceptions" />
      <footer className="document-footer">
        Developed by ETL GIS Consulting LLC
      </footer>
    </main>
  );
}
