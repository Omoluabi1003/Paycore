import type { Metadata } from "next";
import { BrandSplash } from "./brand";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayCore | Payroll Operations",
  description: "Safety-first contractor settlement and payroll operations.",
  authors: [{ name: "ETL GIS Consulting LLC" }],
  creator: "ETL GIS Consulting LLC",
  icons: { icon: "/paycore-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><BrandSplash />{children}</body>
    </html>
  );
}
