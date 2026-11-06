import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "./brand";
import UiIcon from "./ui-icon";
export type DocumentSection = "connection" | "exceptions" | "activity";
const pages = [
  { key: "connection", href: "/scan", label: "Connection" },
  { key: "activity", href: "/scan/activity", label: "Activity Register" },
  { key: "exceptions", href: "/scan/inbox", label: "Exceptions" },
] as const;
export default function DocumentShell({ current, title, description, children }: { current: DocumentSection; title: string; description: string; children: ReactNode }) {
  return <main id="scan-main-content" tabIndex={-1} className="document-page">
    <header className="document-heading"><Link href="/" aria-label="PayCore home"><BrandLogo /></Link><Link className="document-workspace-link" href="/"><UiIcon name="grid" size={17} /> Workspace <UiIcon name="arrow" size={16} /></Link></header>
    <div className="document-hero"><span className="document-hero-icon"><UiIcon name="mail" size={25} /></span><div><p className="eyebrow">BUSINESS PAPERWORK</p><h1>{title}</h1><p>{description}</p></div></div>
    <nav className="document-tabs" aria-label="Email documents">{pages.map(page => <Link href={page.href} key={page.key} aria-current={current === page.key ? "page" : undefined}>{page.label}</Link>)}</nav>
    {children}
    <footer className="document-footer"><span>Developed by <strong>ETL GIS Consulting LLC</strong></span><Link href="/">Back to workspace <UiIcon name="arrow" size={14} /></Link></footer>
  </main>;
}
