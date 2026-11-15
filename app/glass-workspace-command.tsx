"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import "./glass-workspace-command.css";

/** Offers only existing PayCore workflows when the regular desktop workspace sidebar is absent. */
const destinations = ["Payroll", "Invoices", "Reports"] as const;
export default function GlassWorkspaceCommand(){
  const [open, setOpen] = useState(false);
  useEffect(()=>{
    if(!open) return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[open]);
  const go=(name:string)=>{
    const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>(".setup-module-nav button,.sidebar .nav-item"));
    const target=buttons.find(button=>button.textContent?.trim().toLowerCase()===(name==="Payroll"?"run payroll":name.toLowerCase()))
      ??buttons.find(button=>button.textContent?.trim().toLowerCase()===name.toLowerCase());
    if(target){target.click();setOpen(false);}
  };
  return <div className="pc-workspace-command">
    <button type="button" className="pc-workspace-command-trigger" aria-expanded={open} aria-controls="pc-workspace-command-panel" onClick={()=>setOpen(value=>!value)}>
      <span className="pc-workspace-command-glyph" aria-hidden="true">✦</span><span>Workspace</span><span aria-hidden="true">{open?"×":"☰"}</span>
    </button>
    {open&&<><button className="pc-workspace-command-scrim" type="button" aria-label="Dismiss workspace menu" onClick={()=>setOpen(false)} tabIndex={-1}/>
      <nav id="pc-workspace-command-panel" className="pc-workspace-command-panel" aria-label="PayCore workspace navigation">
        <div className="pc-workspace-command-heading"><strong>PAYCORE</strong><small>YOUR WORKSPACE</small></div>
        {destinations.map(name=><button type="button" key={name} onClick={()=>go(name)}>{name}<span aria-hidden="true">↗</span></button>)}
        <Link href="/scan" onClick={()=>setOpen(false)}>Scan documents<span aria-hidden="true">↗</span></Link>
        <p>Operational clarity, without unnecessary complexity.</p>
      </nav>
    </>}
  </div>;
}
