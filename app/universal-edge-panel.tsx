"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "./universal-edge-panel.css";

const sections = [["Home","Home"],["Run payroll","Run payroll"],["Contractors","Contractors"],["Activity","Activity register"],["Statements","Statements"],["Invoices","Invoices"],["Reports","Reports"],["Exceptions","Exceptions"]] as const;
const setup = [["Payroll","Payroll"],["Invoices","Invoices"],["Reports","Reports"]] as const;
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function playWhoosh(opening: boolean) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const AudioContextCtor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
  if (!AudioContextCtor) return;
  let ctx: AudioContext | undefined;
  try {
    ctx = new AudioContextCtor();
    const length = Math.floor(ctx.sampleRate * 0.27);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    // Shaped white noise creates a quick soft air sweep without external audio assets.
    for (let i=0;i<length;i++) {
      const t = i/length;
      const envelope = Math.pow(Math.sin(Math.PI*t), 1.4);
      samples[i] = (Math.random()*2-1)*envelope;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(opening?370:850,ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(opening?1250:310,ctx.currentTime+0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.075,ctx.currentTime+0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.27);
    source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
    source.start();source.stop(ctx.currentTime+0.27);
    source.onended = () => { void ctx?.close().catch(()=>{}); };
  } catch { void ctx?.close().catch(()=>{}); }
}

/** Samsung Edge-style access to real PayCore actions across signed-in workspace states. */
export default function UniversalEdgePanel({companyName,displayName,onEditProfile,onSignOut}:{companyName:string;displayName:string;onEditProfile:()=>void;onSignOut:()=>void}){
  const [open,setOpen]=useState(false);
  const [muted,setMuted]=useState(false);
  const [full,setFull]=useState(false);
  const panel=useRef<HTMLElement>(null);
  const handle=useRef<HTMLButtonElement>(null);
  const touch=useRef<number|null>(null);
  useEffect(()=>{
    const inspect=()=>setFull(Boolean(document.querySelector(".paycore-edge-shell .sidebar")));
    inspect();
    const observer=new MutationObserver(inspect);
    observer.observe(document.body,{childList:true,subtree:true});
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!open)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")change(false)};
    window.addEventListener("keydown",escape);
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return ()=>{window.removeEventListener("keydown",escape);handle.current?.focus({preventScroll:true});};
  },[open]);
  const change=(next:boolean)=>{
    setOpen(next);
    if(!muted)playWhoosh(next);
  };
  const go=(label:string)=>{
    const scope=full?".paycore-edge-shell .sidebar .nav-item":".setup-module-nav button";
    const target=Array.from(document.querySelectorAll<HTMLButtonElement>(scope)).find(item=>item.textContent?.trim().toLowerCase()===label.toLowerCase());
    if(target){target.click();change(false);}
  };
  const begin=(event:React.TouchEvent)=>{touch.current=event.touches[0]?.clientX??null};
  const end=(event:React.TouchEvent)=>{
    if(touch.current===null)return;
    const diff=(event.changedTouches[0]?.clientX??touch.current)-touch.current;
    touch.current=null;
    if(diff>60&&!open)change(true);
    if(diff< -60&&open)change(false);
  };
  return <div className="pc-unfurl-root" data-open={open} onTouchStart={begin} onTouchEnd={end}>
    <button ref={handle} type="button" className="pc-unfurl-handle" aria-expanded={open} aria-controls="pc-unfurl-panel" aria-label={open?"Close PayCore edge panel":"Unfurl PayCore edge panel"} onClick={()=>change(!open)}>
      <span className="pc-unfurl-diamond" aria-hidden="true">✧</span><span className="pc-unfurl-handle-text">PAYCORE</span><span aria-hidden="true">{open?"‹":"›"}</span>
    </button>
    <div className="pc-unfurl-mask" data-visible={open} aria-hidden="true" onClick={()=>change(false)}/>
    <nav ref={panel} id="pc-unfurl-panel" className="pc-unfurl-panel" aria-label="PayCore edge navigation" aria-hidden={!open} inert={!open}>
      <div className="pc-unfurl-head"><span className="pc-unfurl-crest" aria-hidden="true">✧</span><div><strong>PAYCORE</strong><small>YOUR INTELLIGENT WORKSPACE</small></div><button type="button" onClick={()=>change(false)} aria-label="Close navigation">×</button></div>
      <div className="pc-unfurl-profile"><span className="pc-unfurl-avatar">{displayName.slice(0,1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{companyName||"Local workspace"}</small></div><span className="pc-unfurl-status" aria-hidden="true"/></div>
      <p className="pc-unfurl-label">WORKSPACE</p>
      <div className="pc-unfurl-links">
        {(full?sections:setup).map(([title,label])=><button type="button" key={title} onClick={()=>go(label)}><span aria-hidden="true" className="pc-unfurl-nav-icon">◇</span><span>{title}</span><span className="pc-unfurl-arrow" aria-hidden="true">›</span></button>)}
        <Link href="/scan" onClick={()=>change(false)}><span aria-hidden="true" className="pc-unfurl-nav-icon">▣</span><span>Scan documents</span><span className="pc-unfurl-arrow" aria-hidden="true">›</span></Link>
        <button type="button" onClick={()=>{change(false);onEditProfile()}}><span aria-hidden="true" className="pc-unfurl-nav-icon">◉</span><span>Profile</span><span className="pc-unfurl-arrow" aria-hidden="true">›</span></button>
        <button type="button" onClick={()=>{change(false);onSignOut()}}><span aria-hidden="true" className="pc-unfurl-nav-icon">↪</span><span>Close workspace</span><span className="pc-unfurl-arrow" aria-hidden="true">›</span></button>
      </div>
      <div className="pc-unfurl-footer"><button type="button" aria-pressed={muted} onClick={()=>setMuted(v=>!v)}>{muted?"Sound off · Enable whoosh":"Whoosh on · Mute sound"}</button><small>ETL GIS Consulting LLC</small></div>
    </nav>
  </div>;
}
