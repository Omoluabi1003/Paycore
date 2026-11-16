"use client";
import { useEffect, useRef, useState } from "react";
import { BrandLogo, BrandMark } from "./brand";
import { suggestDisplayName } from "../lib/preview-profile";
import "./animated-access.css";

type EntryProps = {
  email: string; displayName: string; companyName: string;
  nameEdited: boolean;
  onEmail: (value: string) => void;
  onName: (value: string) => void;
  onCompany: (value: string) => void;
  onNameEdited: () => void;
  onOpen: () => void;
  onReturn?: () => void;
};
type Mode = "workspace" | "discover";

/** UI-only entry experience. This is NOT an Auth0 login or identity verification. */
export default function AnimatedAccess({
  email, displayName, companyName, nameEdited,
  onEmail, onName, onCompany, onNameEdited, onOpen, onReturn
}: EntryProps) {
  const [mode,setMode] = useState<Mode>("workspace");
  const [transitioning,setTransitioning] = useState(false);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const discoverHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!transitioning) return;
    const target = mode === "workspace" ? formHeading : discoverHeading;
    const id = window.setTimeout(() => { target.current?.focus({preventScroll:true});setTransitioning(false); }, 560);
    return () => window.clearTimeout(id);
  },[mode,transitioning]);
  const switchMode = (next:Mode) => {
    if(next===mode)return;
    setTransitioning(true);
    setMode(next);
  };
  const updateEmail = (value:string) => {
    onEmail(value);
    if (!nameEdited) onName(suggestDisplayName(value));
  };
  return <main className="pc-auth-stage">
    <div className="pc-auth-backdrop-orb pc-auth-orb-one" aria-hidden="true" />
    <div className="pc-auth-backdrop-orb pc-auth-orb-two" aria-hidden="true" />
    <header className="pc-auth-top"><BrandLogo/>{onReturn ? <button type="button" className="pc-auth-return" onClick={onReturn}>Return to workspace ↗</button> : <span>CONTRACTOR SETTLEMENTS &amp; PAYROLL</span>}</header>
    <section className="pc-auth-shell" data-mode={mode} aria-label="PayCore local workspace entry">
      <div className="pc-auth-content pc-auth-form-side" inert={mode!=="workspace"}>
        <div className="pc-auth-form-wrap">
          <p className="pc-auth-eyebrow">LOCAL WORKSPACE</p>
          <h1 ref={formHeading} tabIndex={-1}>Open your workspace.</h1>
          <p className="pc-auth-muted">Begin with a profile stored in this browser. No password required.</p>
          <form className="pc-auth-form" onSubmit={event=>{event.preventDefault();onOpen()}} aria-label="Open local PayCore workspace">
            <label htmlFor="pc-auth-email">Email address</label>
            <input id="pc-auth-email" type="email" autoComplete="email" inputMode="email" maxLength={254} placeholder="you@company.com" required value={email} onChange={event=>updateEmail(event.target.value)}/>
            <label htmlFor="pc-auth-name">Your name</label>
            <input id="pc-auth-name" type="text" autoComplete="name" maxLength={120} placeholder="Full name" required value={displayName} onChange={event=>{onNameEdited();onName(event.target.value)}}/>
            <label htmlFor="pc-auth-company">Company <span>(optional)</span></label>
            <input id="pc-auth-company" type="text" autoComplete="organization" maxLength={120} placeholder="Company or organization" value={companyName} onChange={event=>onCompany(event.target.value)}/>
            <button type="submit" className="pc-auth-primary">Open local workspace <span aria-hidden="true">↗</span></button>
          </form>
          <p className="pc-auth-disclosure">Local preview only. Your details are stored on this device; this does not verify identity or create a secure account.</p>
        </div>
      </div>
      <div className="pc-auth-content pc-auth-discover-side" inert={mode!=="discover"}>
        <div className="pc-auth-discover-wrap">
          <p className="pc-auth-eyebrow">ONE CONNECTED WORKSPACE</p>
          <h2 ref={discoverHeading} tabIndex={-1}>Clarity at every payday.</h2>
          <p>Bring contractors, work records, settlement calculations and statements into a more intuitive workflow.</p>
          <div className="pc-auth-feature"><span>01</span><div><strong>Prepare</strong><small>Capture the period and people involved</small></div></div>
          <div className="pc-auth-feature"><span>02</span><div><strong>Review</strong><small>Understand every adjustment and deduction</small></div></div>
          <div className="pc-auth-feature"><span>03</span><div><strong>Document</strong><small>Keep records ready for your next step</small></div></div>
          <button type="button" className="pc-auth-discover-action" onClick={()=>switchMode("workspace")}>Open a local workspace <span aria-hidden="true">↗</span></button>
        </div>
      </div>
      <div className="pc-auth-slider" aria-label="PayCore introduction">
        <div className="pc-auth-slider-inner">
          <BrandMark/>
          <p className="pc-auth-slider-kicker">PAYCORE EXPERIENCE</p>
          <h2>{mode==="workspace"?"A simpler way to manage payday.":"Your workspace starts here."}</h2>
          <p>{mode==="workspace"?"Experience the flow before connecting a secure account.":"Create a local profile to explore the operational workspace today."}</p>
          <button type="button" onClick={()=>switchMode(mode==="workspace"?"discover":"workspace")} aria-label={mode==="workspace"?"Explore PayCore capabilities":"Return to local workspace form"}>
            {mode==="workspace"?"Explore PayCore":"Open workspace"}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
        <span className="pc-auth-slider-lines" aria-hidden="true"/>
      </div>
    </section>
    <footer className="pc-auth-bottom"><span>LOCAL PREVIEW · AUTHENTICATION NOT CONNECTED</span><span>Developed by <strong>ETL GIS Consulting LLC</strong></span></footer>
  </main>;
}
