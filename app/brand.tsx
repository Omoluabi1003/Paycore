import Image, { getImageProps } from "next/image";
import mobileSplash from "../public/brand/paycore-splash-mobile.png";
import desktopSplash from "../public/brand/paycore-splash-desktop.png";
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
  const { props: mobile } = getImageProps({ src: mobileSplash, alt: "", fill: true, sizes: "(max-aspect-ratio: 1/2) 50vh, 100vw" });
  return <section className={`brand-splash sculptural-splash ${preview ? "brand-splash-preview" : "brand-splash-onload"}`}
    aria-label={preview ? "Welcome to PayCore" : undefined} aria-hidden={preview ? undefined : true}>
    <picture className="sculptural-splash-picture">
      <source media="(orientation: portrait)" srcSet={mobile.srcSet} sizes={mobile.sizes} />
      <Image src={desktopSplash} alt={preview ? "PayCore — dimensional studio artwork. Developed by ETL GIS Consulting LLC." : ""} fill sizes="(max-aspect-ratio: 4/3) 134vh, 100vw" priority={!preview} className="sculptural-splash-art" />
    </picture>
    {preview ? <a className="splash-enter" href="/">Enter workspace <span aria-hidden="true">↗</span></a> : null}
    <div className="sculptural-splash-content">
      <p className="sculptural-eyebrow">CONTRACTOR SETTLEMENTS &amp; PAYROLL</p>
    </div>
  </section>;
}
