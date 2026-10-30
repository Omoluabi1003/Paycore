import Image from "next/image";
import hero from "../public/brand/paycore-hero-3d.png";
import symbol from "../public/brand/paycore-symbol-3d.png";
import logo from "../public/brand/paycore-logo-3d.png";

export function BrandMark({ className = "" }: { className?: string }) {
  return <Image src={symbol} className={`brand-symbol ${className}`} width={48} height={48} sizes="48px" alt="" />;
}

export function BrandLogo({ className = "" }: { className?: string }) {
  return <span className={`paycore-logo ${className}`}>
    <Image src={logo} className="paycore-logo-art" width={160} height={53} sizes="(max-width: 720px) 140px, 160px" alt="PayCore" />
  </span>;
}

export function BrandSplash({ preview = false }: { preview?: boolean }) {
  return <section className={`brand-splash sculptural-splash ${preview ? "brand-splash-preview" : "brand-splash-onload"}`}
    aria-label={preview ? "Welcome to PayCore" : undefined} aria-hidden={preview ? undefined : true}>
    <Image src={hero} alt={preview ? "PayCore — the approved dimensional studio artwork" : ""} fill sizes="(max-aspect-ratio: 2/1) 200vh, 100vw" priority={!preview} className="sculptural-splash-art" />
    {preview ? <a className="splash-enter" href="/">Enter workspace <span aria-hidden="true">↗</span></a> : null}
    <div className="sculptural-splash-content">
      <p className="sculptural-eyebrow">CONTRACTOR SETTLEMENTS &amp; PAYROLL</p>
      <p className="sculptural-tagline">Clarity at the core of every payday.</p>
      <p className="sculptural-credit">Developed by <strong>ETL GIS Consulting LLC</strong></p>
    </div>
  </section>;
}
