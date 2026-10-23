"use client";

import { useEffect, useRef, useState } from "react";
import "./mobile-command-drawer.css";

const workspaceItems = [
  ["Home", "Home"], ["Payroll", "Run payroll"], ["Contractors", "Contractors"],
  ["Activity", "Activity register"], ["Statements", "Statements"], ["Invoices", "Invoices"],
  ["Reports", "Reports"], ["Exceptions", "Exceptions"],
] as const;

export default function MobileCommandDrawer({displayName,companyName,onEditProfile,onSignOut}:{displayName:string;companyName:string;onEditProfile:()=>void;onSignOut:()=>void}) {
  const [open,setOpen]=useState(false); const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!open)return;const old=document.body.style.overflow;document.body.style.overflow="hidden";const key=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};document.addEventListener("keydown",key);requestAnimationFrame(()=>closeRef.current?.focus());return()=>{document.body.style.overflow=old;document.removeEventListener("keydown",key)}},[open]);
  function openWorkspace(label:string){const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>(".sidebar .nav-item"));const target=buttons.find(button=>button.textContent?.trim()===label);if(target){target.click();setOpen(false);requestAnimationFrame(()=>document.getElementById("main-content")?.scrollIntoView({block:"start"}))}}
  return <><button className="mobile-menu-trigger" type="button" aria-label="Open PayCore menu" aria-expanded={open} aria-controls="paycore-mobile-drawer" onClick={()=>setOpen(true)}><span/><span/><span/></button>{open&&<div className="mobile-drawer-layer"><button className="mobile-drawer-backdrop" aria-label="Close menu" onClick={()=>setOpen(false)}/><aside id="paycore-mobile-drawer" className="mobile-command-drawer" aria-label="PayCore mobile navigation"><div className="mobile-drawer-head"><div><strong>PayCore</strong><small>{companyName||"Your workspace"}</small></div><button ref={closeRef} type="button" className="mobile-drawer-close" aria-label="Close menu" onClick={()=>setOpen(false)}>×</button></div><div className="mobile-drawer-profile"><span>{displayName.slice(0,1).toUpperCase()}</span><div><strong>{displayName}</strong><small>Signed in</small></div></div><nav className="mobile-drawer-nav" aria-label="Workspace sections"><p>WORKSPACE</p>{workspaceItems.map(([name,label])=><button key={name} type="button" onClick={()=>openWorkspace(label)}><span>{name}</span><b>›</b></button>)}<p>PAYCORE SCAN</p><a href="/scan"><span>New Scan</span><b>›</b></a><a href="/scan/inbox"><span>Scan Inbox</span><b>›</b></a><p>ACCOUNT</p><button type="button" onClick={()=>{setOpen(false);onEditProfile()}}><span>Profile</span><b>›</b></button><button type="button" className="mobile-signout" onClick={onSignOut}><span>Sign Out</span><b>›</b></button></nav><footer>Developed by <strong>ETL GIS Consulting LLC</strong></footer></aside></div>}</>;
}
