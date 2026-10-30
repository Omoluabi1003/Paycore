import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SharePayCore from "../share-paycore";
import { BrandLogo } from "../brand";
import desktopSplash from "../../public/brand/paycore-splash-desktop.png";
import mobileSplash from "../../public/brand/paycore-splash-mobile.png";
import hero from "../../public/brand/paycore-hero-3d.png";
import logo from "../../public/brand/paycore-logo-3d.png";
import symbol from "../../public/brand/paycore-symbol-3d.png";
import "./brand-library.css";

export const metadata: Metadata = {
  title: "PayCore | Brand & Sharing",
  description: "PayCore’s sculptural identity: precise engineering, transparent settlements and the individual at the core. Developed by ETL GIS Consulting LLC.",
  alternates: { canonical: "/brand" },
};
export default function BrandLibrary() {
  return <main className="brand-library"><header><Link href="/" aria-label="PayCore home"><BrandLogo /></Link><Link href="/welcome">View splash screen</Link></header>
    <section className="brand-library-hero"><p className="brand-library-eyebrow">THE PAYCORE IDENTITY</p><h1>People at the core.<br />Precision in every layer.</h1><Image src={hero} alt="PayCore’s sculptural teal and titanium emblem, luminous core and pearl wordmark" priority sizes="(max-width: 800px) 100vw, 1200px" /><p>Contractor-specific pay. Explainable deductions. Deliberate human review.</p></section>
    <section className="brand-library-meaning"><h2>A collaborator for the specialist.</h2><p>The luminous core represents the person whose work is being settled. The connected metal forms reflect the developer’s responsibility for precise calculations, traceable rules and reliable software. The dimensional wordmark expresses the clarity and confidence the payroll specialist should experience.</p></section>
    <section className="brand-library-assets" aria-label="Brand downloads">
      <article><h2>Primary logo</h2><div className="brand-library-preview"><Image src={logo} alt="PayCore dimensional logo" sizes="600px" /></div><a href="/brand/paycore-logo-3d.png" download="paycore-logo-3d.png">Download transparent logo</a></article>
      <article><h2>Compact emblem</h2><div className="brand-library-preview brand-library-symbol"><Image src={symbol} alt="PayCore sculptural P and luminous core" sizes="300px" /></div><a href="/brand/paycore-symbol-3d.png" download="paycore-symbol-3d.png">Download transparent emblem</a></article>
      <article><h2>Desktop splash</h2><div className="brand-library-preview"><Image src={desktopSplash} alt="PayCore desktop studio splash" sizes="600px" /></div><a href="/brand/paycore-splash-desktop.png" download="paycore-splash-desktop.png">Download desktop splash</a><a href="/opengraph-image" download="paycore-sharing-card.png">Download sharing card</a></article>
      <article><h2>Mobile splash</h2><div className="brand-library-preview"><Image src={mobileSplash} alt="PayCore portrait splash with a full-height studio scene and complete crest and name" sizes="(max-width: 800px) 100vw, 600px" /></div><a href="/brand/paycore-splash-mobile.png" download="paycore-splash-mobile.png">Download mobile splash</a></article>
      <article><h2>Device icons</h2><div className="brand-library-device-icons"><img src="/icon" width="64" height="64" alt="PayCore browser icon" /><img src="/apple-icon" width="100" height="100" alt="PayCore Apple touch icon" /></div><a href="/icon" download="paycore-icon-64.png">Download browser icon</a><a href="/apple-icon" download="paycore-apple-icon-180.png">Download touch icon</a></article>
    </section>
    <section className="brand-library-sharing"><h2>Share PayCore</h2><SharePayCore /></section>
    <footer>Developed by <strong>ETL GIS Consulting LLC</strong></footer>
  </main>;
}
