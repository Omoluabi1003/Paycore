"use client";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import "./mobile-command-drawer.css";
import { BrandLogo } from "./brand";
import UiIcon from "./ui-icon";
const items = [["Home", "Home"], ["Payroll", "Run payroll"], ["Contractors", "Contractors"], ["Activity", "Activity register"], ["Statements", "Statements"], ["Invoices", "Invoices"], ["Reports", "Reports"], ["Exceptions", "Exceptions"]] as const;
function destination(label: string) {
  const main = Array.from(document.querySelectorAll<HTMLButtonElement>(".sidebar button.nav-item")).find(button => button.textContent?.trim() === label);
  if (main) return main;
  const fallback = label === "Run payroll" || label === "Home" ? "Payroll" : label;
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".setup-module-nav button")).find(button => button.textContent?.trim() === fallback);
}
export default function MobileCommandDrawer({ displayName, companyName, onEditProfile, onSignOut }: { displayName: string; companyName: string; onEditProfile: () => void; onSignOut: () => void }) {
  const [open, setOpen] = useState(false), [available, setAvailable] = useState<string[]>([]), [current, setCurrent] = useState("");
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = oldOverflow; trigger.current?.focus(); };
  }, [open]);
  function go(label: string) {
    const button = destination(label);
    if (!button) return;
    button.click(); setOpen(false);
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>("#main-content,.invoice-only-shell h1,.period-setup h1");
      if (target) { target.tabIndex = -1; target.focus(); }
    });
  }
  function show() {
    setAvailable(items.filter(([, label]) => destination(label)).map(([, label]) => label));
    const active = document.querySelector(".sidebar button[aria-current='page'],.setup-module-nav button[aria-current='page']")?.textContent?.trim() ?? "";
    setCurrent(active === "Payroll" ? "Run payroll" : active);
    setOpen(true);
  }
  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]"))
      .filter(element => element.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <>
    <button ref={trigger} className="mobile-menu-trigger" type="button" aria-label="Open PayCore menu" aria-expanded={open} aria-controls="paycore-mobile-drawer" onClick={show}><UiIcon name="menu" size={24} /></button>
    {open && <dialog ref={dialog} id="paycore-mobile-drawer" className="mobile-menu-dialog" aria-label="PayCore navigation" onKeyDown={containFocus} onCancel={event => { event.preventDefault(); setOpen(false); }} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) setOpen(false); }}>
      <div className="mobile-command-drawer">
        <div className="mobile-drawer-head"><div><BrandLogo /><small>{companyName || "Your workspace"}</small></div><button type="button" className="mobile-drawer-close" aria-label="Close menu" onClick={() => setOpen(false)}><UiIcon name="close" size={23} /></button></div>
        <div className="mobile-drawer-profile"><span aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>Profile on this device</small></div></div>
        <nav className="mobile-drawer-nav" aria-label="Workspace sections"><p>WORKSPACE</p>{items.map(([name, label]) => <button key={name} type="button" disabled={!available.includes(label)} aria-current={current === label ? "page" : undefined} onClick={() => go(label)}><span>{name}</span><UiIcon name="arrow" size={17} /></button>)}
          {available.length < items.length && <small className="mobile-nav-hint">Set up a pay period to open the payroll sections.</small>}
          <p>EMAIL DOCUMENTS</p><Link href="/scan" onClick={() => setOpen(false)}><span>Mailbox connection</span><UiIcon name="arrow" size={17} /></Link><Link href="/scan/inbox" onClick={() => setOpen(false)}><span>Inbox exceptions</span><UiIcon name="arrow" size={17} /></Link><Link href="/scan/activity" onClick={() => setOpen(false)}><span>Activity Register</span><UiIcon name="arrow" size={17} /></Link>
          <p>PROFILE</p><button type="button" onClick={() => { setOpen(false); onEditProfile(); }}><span>Edit profile</span><UiIcon name="arrow" size={17} /></button><button type="button" className="mobile-signout" onClick={() => { setOpen(false); onSignOut(); }}><span>Close workspace</span><UiIcon name="close" size={17} /></button>
        </nav><footer>Developed by <strong>ETL GIS Consulting LLC</strong></footer>
      </div>
    </dialog>}
  </>;
}
