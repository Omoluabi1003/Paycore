import type { Metadata } from "next";
import { PAYCORE_PUBLIC_URL } from "../lib/brand-identity";
import { BrandSplash } from "./brand";
import BrandIntro from "./brand-intro";
import ScanNavigationBridge from "./scan-navigation-bridge";
import "./globals.css";
import "./page-story-backgrounds.css";

export const metadata: Metadata = {
  metadataBase: new URL(PAYCORE_PUBLIC_URL),
  alternates: { canonical: "/" },
  title: "PayCore | Contractor Settlements & Payroll",
  description: "Contractor settlements and payroll operations. Enter the facts, understand every deduction. Developed by ETL GIS Consulting LLC.",
  openGraph: {
    type: "website",
    siteName: "PayCore",
    url: "/",
    title: "PayCore | Contractor Settlements & Payroll",
    description: "Enter the facts. Understand every deduction. Developed by ETL GIS Consulting LLC.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PayCore | Contractor Settlements & Payroll",
    description: "Enter the facts. Understand every deduction. Developed by ETL GIS Consulting LLC.",
    images: [{ url: "/opengraph-image", alt: "PayCore — Contractor settlements and payroll operations. Developed by ETL GIS Consulting LLC." }],
  },
  authors: [{ name: "ETL GIS Consulting LLC" }],
  creator: "ETL GIS Consulting LLC",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><BrandIntro splash={<BrandSplash />}><ScanNavigationBridge />{children}</BrandIntro></body>
    </html>
  );
}
