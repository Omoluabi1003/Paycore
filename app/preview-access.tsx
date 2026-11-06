"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "./brand";
import Workspace from "./workspace";
import SharePayCore from "./share-paycore";
import MobileCommandDrawer from "./mobile-command-drawer";
import UiIcon from "./ui-icon";
import { suggestDisplayName } from "../lib/preview-profile";
const SESSION_KEY = "paycore.workspace.session.v1";
type WorkspaceSession = { email: string; displayName: string; companyName: string };
function readSession(): WorkspaceSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as Partial<WorkspaceSession>;
    if (typeof profile.email !== "string" || !profile.email || typeof profile.displayName !== "string" || !profile.displayName) return null;
    return { email: profile.email, displayName: profile.displayName, companyName: typeof profile.companyName === "string" ? profile.companyName : "" };
  } catch { return null; }
}
export default function PreviewAccess() {
  const [signedIn, setSignedIn] = useState(false), [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState(""), [displayName, setDisplayName] = useState(""), [companyName, setCompanyName] = useState("");
  const [nameEdited, setNameEdited] = useState(false), [editingProfile, setEditingProfile] = useState(false), [hasInteracted, setHasInteracted] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const [profileDraft, setProfileDraft] = useState({ displayName: "", companyName: "" });
  const [profileError, setProfileError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null), profileHeading = useRef<HTMLHeadingElement>(null), profileButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const saved = readSession();
    if (saved) { setEmail(saved.email); setDisplayName(saved.displayName); setCompanyName(saved.companyName); setSignedIn(true); }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hasInteracted && !signedIn) heading.current?.focus(); }, [signedIn, hasInteracted]);
  useEffect(() => { if (editingProfile) profileHeading.current?.focus(); }, [editingProfile]);
  useEffect(() => {
    if (!hydrated || !signedIn) return;
    try { window.localStorage.setItem(SESSION_KEY, JSON.stringify({ email, displayName, companyName })); }
    catch { setStorageNotice("This browser cannot save your profile. It will reset when you leave this page."); }
  }, [hydrated, signedIn, email, displayName, companyName]);
  function editProfile() {
    setProfileDraft({ displayName, companyName }); setProfileError(""); setEditingProfile(true);
  }
  function closeProfile() {
    setEditingProfile(false);
    requestAnimationFrame(() => { const desktop = profileButton.current; if (desktop?.offsetParent) desktop.focus(); else document.querySelector<HTMLButtonElement>(".mobile-menu-trigger")?.focus(); });
  }
  function changePreview(next: boolean) {
    setHasInteracted(true); setSignedIn(next); setStorageNotice("");
    try {
      if (next) window.localStorage.setItem(SESSION_KEY, JSON.stringify({ email, displayName, companyName }));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch {
      setStorageNotice(next ? "This browser cannot save your profile. It will reset when you leave this page." : "The saved profile could not be cleared. Clear site data before leaving a shared device.");
    }
    if (!next) { setEmail(""); setDisplayName(""); setCompanyName(""); setNameEdited(false); setEditingProfile(false); }
  }
  if (signedIn) return <div className="preview-workspace">
    <header className="preview-header">
      <Link href="/" aria-label="PayCore home"><BrandLogo /></Link>
      <div className="preview-account">
        <div className="profile-identity"><span className="profile-avatar" aria-hidden="true">{(displayName.trim() || "W").slice(0, 1).toUpperCase()}</span><span><strong>{displayName.trim() || "Workspace profile"}</strong><small>{companyName.trim() || "On this device"}</small></span></div>
        <button ref={profileButton} type="button" aria-expanded={editingProfile} aria-controls="preview-profile" onClick={() => editingProfile ? closeProfile() : editProfile()}>Edit profile</button>
        <button type="button" onClick={() => changePreview(false)}>Close workspace</button>
      </div>
      <MobileCommandDrawer displayName={displayName.trim() || "Workspace profile"} companyName={companyName.trim()} onEditProfile={editProfile} onSignOut={() => changePreview(false)} />
    </header>
    {editingProfile && <form id="preview-profile" className="preview-profile-editor" aria-labelledby="profile-edit-title" onSubmit={event => {
      event.preventDefault();
      if (!profileDraft.displayName.trim()) { setProfileError("Enter a name for this workspace profile."); requestAnimationFrame(() => document.getElementById("edit-display-name")?.focus()); return; }
      setDisplayName(profileDraft.displayName); setCompanyName(profileDraft.companyName); closeProfile();
    }}><div><p className="eyebrow">ON THIS DEVICE</p><h2 id="profile-edit-title" ref={profileHeading} tabIndex={-1}>Your workspace profile</h2><p>A different name or company opens a separate local workspace.</p></div>
      <label htmlFor="edit-display-name">Your name</label><input id="edit-display-name" required value={profileDraft.displayName} maxLength={120} aria-invalid={Boolean(profileError)} aria-describedby={profileError ? "profile-edit-error" : undefined} onChange={event => { setProfileDraft({ ...profileDraft, displayName: event.target.value }); setProfileError(""); }} />
      <label htmlFor="edit-company-name">Company name (optional)</label><input id="edit-company-name" value={profileDraft.companyName} maxLength={120} onChange={event => setProfileDraft({ ...profileDraft, companyName: event.target.value })} />
      {profileError && <p id="profile-edit-error" role="alert">{profileError}</p>}
      <div className="profile-edit-actions"><button type="button" onClick={closeProfile}>Cancel</button><button type="submit">Done</button></div>
    </form>}
    <div className="preview-notice"><UiIcon name="document" size={16} /><span>Local workspace <span aria-hidden="true">·</span> Records stay on this device.</span><Link href="/scan">Secure mailbox access <UiIcon name="arrow" size={15} /></Link></div>
    {storageNotice && <p className="profile-storage-notice" role="status">{storageNotice}</p>}
    <Workspace key={JSON.stringify([displayName.trim(), companyName.trim()])} displayName={displayName.trim() || "Workspace user"} companyName={companyName.trim()} />
    <div className="workspace-share"><SharePayCore /></div>
  </div>;
  return <main className="access-page" aria-busy={!hydrated}>
    <section className="access-story" aria-label="About PayCore">
      <BrandLogo />
      <div className="access-story-copy"><p className="access-eyebrow">LESS PAPERWORK. MORE CLARITY.</p><h1>Your business.<br />In good order.</h1><p>Keep your people, invoices and pay periods moving together.</p></div>
      <ul className="access-capabilities"><li><UiIcon name="grid" /><span><strong>Contractor settlements</strong><small>From agreed pay to a clear breakdown.</small></span></li><li><UiIcon name="document" /><span><strong>Customer invoices</strong><small>Prepare, review and track what’s due.</small></span></li><li><UiIcon name="mail" /><span><strong>Business paperwork</strong><small>A dedicated place for invoices and receipts.</small></span></li></ul>
      <p className="access-attribution">Developed by <strong>ETL GIS Consulting LLC</strong></p>
    </section>
    <section className="access-panel" aria-label="Open PayCore">
      <div className="access-card"><span className="access-profile-tag"><span aria-hidden="true" />YOUR WORKSPACE</span><h2 ref={heading} tabIndex={-1}>{hydrated ? "Open your workspace." : "Opening your workspace."}</h2><p>Choose a profile to continue on this device.</p>
        {hydrated && <form className="preview-signin" onSubmit={event => { event.preventDefault(); changePreview(true); }}>
          <label htmlFor="preview-account">Email address</label><input id="preview-account" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={event => { setEmail(event.target.value); if (!nameEdited) setDisplayName(suggestDisplayName(event.target.value)); }} required maxLength={254} />
          <label htmlFor="preview-name">Your name</label><input id="preview-name" autoComplete="name" value={displayName} onChange={event => { setNameEdited(true); setDisplayName(event.target.value); }} required maxLength={120} />
          <label htmlFor="preview-company">Company name <span>(optional)</span></label><input id="preview-company" autoComplete="organization" value={companyName} onChange={event => setCompanyName(event.target.value)} maxLength={120} />
          <button type="submit">Open workspace <UiIcon name="arrow" size={19} /></button>
        </form>}
        <p className="access-note">This local profile does not verify your identity. Secure mailbox access uses a separate sign-in.</p>
        {storageNotice && <p className="profile-storage-notice" role="status">{storageNotice}</p>}
        <div className="access-mailbox-link"><span className="access-mailbox-icon"><UiIcon name="mail" /></span><div><strong>Working with email documents?</strong><Link href="/scan">Open mailbox connection <UiIcon name="arrow" size={15} /></Link></div></div>
      </div><p className="access-mobile-credit">Developed by <strong>ETL GIS Consulting LLC</strong></p>
    </section>
  </main>;
}
