"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "./brand";
import Workspace from "./workspace";
import { suggestDisplayName } from "../lib/preview-profile";

// Presentation state only. Never use this value to authorize an API or data read.
// Supabase sessions and server-side membership checks will replace this preview.
export default function PreviewAccess() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (hasInteracted) heading.current?.focus();
  }, [signedIn, hasInteracted]);

  function changePreview(next: boolean) {
    setHasInteracted(true);
    setSignedIn(next);
    if (!next) { setEmail(""); setDisplayName(""); setCompanyName(""); setNameEdited(false); setEditingProfile(false); }
  }

  if (signedIn) return <div className="preview-workspace">
    <header className="preview-header">
      <BrandLogo />
      <div className="preview-account"><span>{displayName.trim() || "Preview account"}</span><button type="button" onClick={() => setEditingProfile(value => !value)} aria-expanded={editingProfile} aria-controls="preview-profile">Edit profile</button><button type="button" onClick={() => changePreview(false)}>Sign out</button></div>
    </header>
    {editingProfile && <section id="preview-profile" className="preview-profile-editor" aria-labelledby="profile-heading"><h2 id="profile-heading">Your demo profile</h2><label htmlFor="edit-display-name">Your name</label><input id="edit-display-name" value={displayName} maxLength={120} autoComplete="name" onChange={event => setDisplayName(event.target.value)} /><label htmlFor="edit-company-name">Company name (optional)</label><input id="edit-company-name" value={companyName} maxLength={120} autoComplete="organization" onChange={event => setCompanyName(event.target.value)} /><button type="button" onClick={() => setEditingProfile(false)}>Done</button><p>Display details only. Changes stay in this tab and reset on refresh.</p></section>}
    <div className="preview-notice" role="status">Sample workspace · No live payroll or payments · Changes reset on refresh.</div>
    <div className="walkthrough-toolbar"><span>Client walkthrough · Fictional records only</span><div><a href="/sample-payroll.pdf">Download PDF statements</a><a href="/sample-payroll.csv">Download CSV</a><a href="mailto:?subject=PayCore%20sample%20payroll%20statements&body=Please%20find%20the%20PayCore%20sample%20payroll%20statements.%20These%20are%20fictional%20records%20for%20presentation%20only.%0A%0AAttach%20the%20downloaded%20PDF%20before%20sending.">Prepare email</a></div><small>Email opens your mail app. Attach the downloaded PDF before sending.</small></div>
    <Workspace displayName={displayName.trim() || "Preview user"} companyName={companyName.trim()} />
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
          <input id="preview-account" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => { setEmail(event.target.value); if (!nameEdited) setDisplayName(suggestDisplayName(event.target.value)); }} required maxLength={254} aria-describedby="preview-description" />
          <label htmlFor="preview-name">Your name</label>
          <input id="preview-name" autoComplete="name" value={displayName} onChange={event => { setNameEdited(true); setDisplayName(event.target.value); }} required pattern={".*\\S.*"} maxLength={120} placeholder="Enter your name" aria-describedby="preview-name-help" />
          <small id="preview-name-help">Suggested from your email when possible. Please check or edit it.</small>
          <label htmlFor="preview-company">Company name (optional)</label>
          <input id="preview-company" autoComplete="organization" value={companyName} onChange={event => setCompanyName(event.target.value)} maxLength={120} placeholder="Your company" />
          <button type="submit">Open workspace <span aria-hidden="true">↗</span></button>
        </form>
        <p className="access-note" id="preview-description">Preview access only. Your email and display details stay in this tab and are cleared when you sign out or refresh. No password needed.</p>
      </div>
    </section>
  </main>;
}


