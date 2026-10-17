import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayCore | Payroll Operations",
  description: "Safety-first contractor settlement and payroll operations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}