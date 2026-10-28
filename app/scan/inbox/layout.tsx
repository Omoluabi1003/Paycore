import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan Inbox | PayCore",
  description: "Review payroll document scans, reconciliation status and items that need specialist attention.",
};

export default function ScanInboxLayout({children}:{children:React.ReactNode}) {
  return children;
}
