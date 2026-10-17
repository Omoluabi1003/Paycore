export function BrandLogo({ className = "" }: { className?: string }) {
  return <span className={`paycore-logo ${className}`}>
    {/* A local SVG keeps the wordmark sharp without a remote font or image service. */}
    <img src="/paycore-mark.svg" width="40" height="40" alt="" />
    <span>PayCore</span>
  </span>;
}

export function BrandSplash({ preview = false }: { preview?: boolean }) {
  return <section className={`brand-splash ${preview ? "brand-splash-preview" : "brand-splash-intro"}`}
    aria-label={preview ? "Welcome to PayCore" : undefined} aria-hidden={preview ? undefined : true}>
    <div className="splash-orbit splash-orbit-outer" />
    <div className="splash-orbit splash-orbit-inner" />
    {preview ? <a className="splash-enter" href="/">Enter workspace <span aria-hidden="true">↗</span></a> : null}
    <div className="splash-center">
      <span className="splash-eyebrow">PAYROLL OPERATIONS</span>
      <BrandLogo className="splash-logo" />
      <p>Clarity at the core of every payday.</p>
      <span className="splash-rule" />
    </div>
    <div className="splash-attribution"><span>Developed by</span><strong>ETL GIS Consulting LLC</strong></div>
  </section>;
}
