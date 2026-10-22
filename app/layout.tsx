import type { Metadata } from "next";
import { BrandSplash } from "./brand";
import ScanNavigationBridge from "./scan-navigation-bridge";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || "paycore-gamma.vercel.app"}`),
  title: "PayCore | Contractor Settlements & Payroll",
  description: "Contractor settlements and payroll operations. Enter the facts, understand every deduction. Developed by ETL GIS Consulting LLC.",
  openGraph: {
    type: "website",
    siteName: "PayCore",
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
  icons: { icon: "/paycore-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><BrandSplash /><ScanNavigationBridge />{children}</body>
    </html>
  );
}
