"use client";
import { useState } from "react";
import { BrandLogo } from "./brand";
import "./glass-experience-rail.css";

/** Visible, truthful product preview for the signed-out entry experience. No fake navigation or fabricated data. */
export default function GlassExperienceRail(){
 const [expanded,setExpanded]=useState(true);
 return <aside className="pc-glass-feature" aria-label="PayCore product overview">
 <div className="pc-glass-feature-head"><div className="pc-glass-feature-brand"><BrandLogo /><span>WORKSPACE EXPERIENCE</span></div><button type="button" aria-expanded={expanded} aria-controls="pc-glass-feature-body" onClick={()=>setExpanded(v=>!v)}>{expanded?"−":"+"}<span className="sr-only">{expanded?"Collapse":"Expand"} workspace preview</span></button></div>
 {expanded&&<div id="pc-glass-feature-body"><div className="pc-glass-feature-profile"><span className="pc-glass-feature-orb" aria-hidden="true">✦</span><div><strong>Clarity in every settlement.</strong><small>One connected operational workspace</small></div></div>
 <p className="pc-glass-feature-label">YOUR WORKFLOW</p>
 <ol className="pc-glass-feature-items"><li><span className="pc-glass-feature-num">01</span><div><strong>Prepare</strong><small>Set your payroll schedule</small></div></li><li><span className="pc-glass-feature-num">02</span><div><strong>Review</strong><small>See every deduction and statement</small></div></li><li><span className="pc-glass-feature-num">03</span><div><strong>Settle</strong><small>Export clear, auditable records</small></div></li></ol>
 <div className="pc-glass-feature-foot"><span className="pc-glass-feature-pulse"/> PREVIEW MODE <span>NO LIVE PAYMENTS</span></div></div>}
 </aside>
}
