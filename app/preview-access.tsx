"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "./brand";

// Presentation state only. Never use this value to authorize an API or data read.
// Supabase sessions and server-side membership checks will replace this preview.
export default function PreviewAccess() {
  const [signedIn, setSignedIn] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (hasInteracted) heading.current?.focus();
  }, [signedIn, hasInteracted]);

  function changePreview(next: boolean) {
    setHasInteracted(true);
    setSignedIn(next);
  }

  if (signedIn) return <div className="preview-workspace">
    <header className="preview-header">
      <BrandLogo />
      <div className="preview-account"><span>Preview account</span><button type="button" onClick={() => changePreview(false)}>Sign out</button></div>
    </header>
    <div className="preview-notice" role="status">Preview only · Supabase is not connected. No records are saved.</div>
    <main className="preview-main">
      <p className="access-eyebrow">YOUR WORKSPACE</p>
      <h1 ref={heading} tabIndex={-1}>Welcome to PayCore.</h1>
      <p className="preview-intro">A clear place to manage your people and payroll.</p>
      <div className="preview-modules">
        <section className="preview-module"><span className="preview-module-symbol" aria-hidden="true">01</span><h2>Contractors</h2><p>Your contractor records will appear here once secure storage is connected.</p><span className="preview-module-status">Not connected</span></section>
        <section className="preview-module"><span className="preview-module-symbol" aria-hidden="true">02</span><h2>Payroll</h2><p>Prepare and review payroll after your organization and contractor records are ready.</p><span className="preview-module-status">Not connected</span></section>
      </div>
      <section className="preview-next"><div><p className="access-eyebrow">WHAT COMES NEXT</p><h2>Your organization, securely connected.</h2><p>This account preview lets you try signing in and out. Real account access and saved records will follow.</p></div><span className="preview-connection">Supabase connection pending</span></section>
    </main>
    <footer className="preview-footer">Developed by <strong>ETL GIS Consulting LLC</strong></footer>
  </div>;

  return <main className="access-page">
    <div className="access-story">
      <BrandLogo />
      <div className="access-story-copy"><p className="access-eyebrow">YOUR PAYROLL, WITH CLARITY</p><h1>A calmer way<br />to manage payday.</h1><p>People, records, and approvals.<br />Together in one workspace.</p></div>
      <p className="access-attribution">Developed by <strong>ETL GIS Consulting LLC</strong></p>
    </div>
    <section className="access-panel" aria-labelledby="access-heading">
      <div className="access-card">
        <span className="access-emblem" aria-hidden="true">P</span>
        <p className="access-eyebrow">WELCOME TO PAYCORE</p>
        <h2 id="access-heading" ref={heading} tabIndex={-1}>Sign in to your workspace.</h2>
        <p>Try the account experience with a preview account.</p>
        <form className="preview-signin" onSubmit={(event) => { event.preventDefault(); changePreview(true); }}>
          <label htmlFor="preview-account">Preview account</label>
          <input id="preview-account" type="text" value="preview@paycore.example" readOnly aria-describedby="preview-description" />
          <button type="submit">Sign in to preview <span aria-hidden="true">↗</span></button>
        </form>
        <p className="access-note" id="preview-description">Preview only. Supabase is not connected. No password is needed, and nothing is saved.</p>
      </div>
    </section>
  </main>;
}
