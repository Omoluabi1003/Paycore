"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "./brand";
import Workspace from "./workspace";

// Presentation state only. Never use this value to authorize an API or data read.
// Supabase sessions and server-side membership checks will replace this preview.
export default function PreviewAccess() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (hasInteracted) heading.current?.focus();
  }, [signedIn, hasInteracted]);

  function changePreview(next: boolean) {
    setHasInteracted(true);
    setSignedIn(next);
    if (!next) setEmail("");
  }

  if (signedIn) return <div className="preview-workspace">
    <header className="preview-header">
      <BrandLogo />
      <div className="preview-account"><span>Preview account</span><button type="button" onClick={() => changePreview(false)}>Sign out</button></div>
    </header>
    <div className="preview-notice" role="status">Sample workspace · No live payroll or payments · Changes reset on refresh.</div>
    <div className="walkthrough-toolbar"><span>Client walkthrough · Fictional records only</span><div><a href="/sample-payroll.pdf">Download example PDF</a><a href="/sample-payroll.csv">Download example CSV</a><a href="mailto:?subject=PayCore%20sample%20payroll%20statements&body=Please%20find%20the%20PayCore%20sample%20payroll%20statements.%20These%20are%20fictional%20records%20for%20presentation%20only.%0A%0AAttach%20the%20downloaded%20PDF%20before%20sending.">Prepare email</a></div><small>Example downloads use fixed fictional records, separate from your entries. Email opens your mail app. Attach the example PDF before sending.</small></div>
    <Workspace />
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
        <p>Enter your email to open the preview workspace.</p>
        <form className="preview-signin" onSubmit={(event) => { event.preventDefault(); changePreview(true); }}>
          <label htmlFor="preview-account">Email address</label>
          <input id="preview-account" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} aria-describedby="preview-description" />
          <button type="submit">Open workspace <span aria-hidden="true">↗</span></button>
        </form>
        <p className="access-note" id="preview-description">Preview access only. Your email stays in this tab and is cleared when you sign out or refresh. No password needed.</p>
      </div>
    </section>
  </main>;
}


