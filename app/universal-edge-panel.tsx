"use client";
import Link from "next/link";
import AnimatedNavIndicator from "./animated-nav-indicator";
import { useEffect, useRef, useState } from "react";
import "./universal-edge-panel.css";

const sections = [["Home","Home"],["Run payroll","Run payroll"],["Contractors","Contractors"],["Activity","Activity register"],["Statements","Statements"],["Invoices","Invoices"],["Reports","Reports"],["Exceptions","Exceptions"]] as const;
const setup = [["Payroll","Payroll"],["Invoices","Invoices"],["Reports","Reports"]] as const;
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

// AudioContext.resume is requested synchronously from the click/touch gesture,
// including on iOS Safari. Never play sound automatically on mount.
function playWhoosh(opening: boolean): void {
  if (typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
  if (!AudioContextCtor) return;
  let context: AudioContext;
  try { context = new AudioContextCtor(); } catch { return; }
  const start = () => {
    try {
      const duration = opening ? 0.42 : 0.30;
      const count = Math.floor(context.sampleRate * duration);
      const buffer = context.createBuffer(1,count,context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i=0;i<count;i++) {
        const t=i/count;
        const attack=Math.min(1,t/0.13);
        const decay=Math.pow(1-t,1.15);
        samples[i]=(Math.random()*2-1)*attack*decay;
      }
      const source=context.createBufferSource();
      source.buffer=buffer;
      const lowpass=context.createBiquadFilter();
      lowpass.type="lowpass";
      lowpass.frequency.setValueAtTime(opening?380:1500,context.currentTime);
      lowpass.frequency.exponentialRampToValueAtTime(opening?2100:350,context.currentTime+duration);
      const highpass=context.createBiquadFilter();
      highpass.type="highpass";
      highpass.frequency.value=150;
      const gain=context.createGain();
      const t=context.currentTime;
      gain.gain.setValueAtTime(0.0001,t);
      gain.gain.linearRampToValueAtTime(0.19,t+0.075);
      gain.gain.exponentialRampToValueAtTime(0.0001,t+duration);
      source.connect(lowpass);lowpass.connect(highpass);highpass.connect(gain);gain.connect(context.destination);
      source.start(t);source.stop(t+duration);
      source.onended=()=>{void context.close().catch(()=>{});};
    } catch {void context.close().catch(()=>{});}
  };
  if(context.state==="suspended") {
    // resume() must be requested inside the user interaction.
    void context.resume().then(start).catch(()=>{void context.close().catch(()=>{});});
  } else start();
}

/** Samsung Edge-style access to real PayCore actions across signed-in workspace states. */
export default function UniversalEdgePanel({companyName,displayName,onEditProfile,onSignOut}:{companyName:string;displayName:string;onEditProfile:()=>void;onSignOut:()=>void}){
  const [open,setOpen]=useState(false);
  const [muted,setMuted]=useState(false);
  const [full,setFull]=useState(false);
  const [activeLabel,setActiveLabel]=useState("");
  const closeTimer=useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current)},[]);
  const panel=useRef<HTMLElement>(null);
  const handle=useRef<HTMLButtonElement>(null);
  const touch=useRef<number|null>(null);
  useEffect(()=>{
    const inspect=()=>{
      const sidebar=document.querySelector(".paycore-edge-shell .sidebar");
      setFull(Boolean(sidebar));
      const selected=sidebar?.querySelector(".nav-item[aria-current='page']") ?? document.querySelector(".setup-module-nav [aria-current='page']");
      setActiveLabel(selected?.textContent?.trim()??"");
    };
    inspect();
    const observer=new MutationObserver(inspect);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["aria-current"]});
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!open)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")change(false)};
    window.addEventListener("keydown",escape);
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return ()=>{window.removeEventListener("keydown",escape);handle.current?.focus({preventScroll:true});};
  },[open]);
  const change=(next:boolean,withSound=true)=>{
    const pendingClose=closeTimer.current!==null;
    if(closeTimer.current){clearTimeout(closeTimer.current);closeTimer.current=null;}
    if(!muted&&withSound&&(next||!pendingClose))playWhoosh(next);
    setOpen(next);
  };
  const go=(label:string,keyboard=false)=>{
    const scope=full?".paycore-edge-shell .sidebar .nav-item":".setup-module-nav button";
    const target=Array.from(document.querySelectorAll<HTMLButtonElement>(scope)).find(item=>item.textContent?.trim().toLowerCase()===label.toLowerCase());
    if(target){
      target.click();
      if(closeTimer.current)clearTimeout(closeTimer.current);
      if(keyboard||window.matchMedia("(prefers-reduced-motion: reduce)").matches) change(false);
      else {
        // Keep audio activation inside the original gesture, including on iOS.
        if(!muted&&closeTimer.current===null)playWhoosh(false);
        closeTimer.current=setTimeout(()=>change(false,false),380);
      }
    }
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
      <div className="pc-folio-folds" aria-hidden="true"><span className="pc-folio-fold pc-folio-fold-one"/><span className="pc-folio-fold pc-folio-fold-two"/><span className="pc-folio-fold pc-folio-fold-three"/></div>
      <div className="pc-unfurl-head"><span className="pc-unfurl-crest" aria-hidden="true">✧</span><div><strong>PAYCORE</strong><small>YOUR INTELLIGENT WORKSPACE</small></div><button type="button" onClick={()=>change(false)} aria-label="Close navigation">×</button></div>
      <div className="pc-unfurl-profile"><span className="pc-unfurl-avatar">{displayName.slice(0,1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{companyName||"Local workspace"}</small></div><span className="pc-unfurl-status" aria-hidden="true"/></div>
      <p className="pc-unfurl-label">WORKSPACE</p>
      <div className="pc-unfurl-links pc-selection-track"><AnimatedNavIndicator />
        {(full?sections:setup).map(([title,label])=><button type="button" key={title} aria-current={activeLabel===label?"page":undefined} onClick={event=>go(label,event.detail===0)}><span aria-hidden="true" className="pc-unfurl-nav-icon">◇</span><span>{title}</span><span className="pc-unfurl-arrow" aria-hidden="true">›</span></button>)}
        <Link href="/scan" onClick={()=>change(false)}><span aria-hidden="true" className="pc-unfurl-nav-icon">▣</span><span>Scan documents</span><span className="pc-unfurl-arrow" aria-hidden="true">›</span></Link>
        <button type="button" onClick={()=>{change(false);onEditProfile()}}><span aria-hidden="true" className="pc-unfurl-nav-icon">◉</span><span>Profile</span><span className="pc-unfurl-arrow" aria-hidden="true">›</span></button>
        <button type="button" onClick={()=>{change(false);onSignOut()}}><span aria-hidden="true" className="pc-unfurl-nav-icon">↪</span><span>Close workspace</span><span className="pc-unfurl-arrow" aria-hidden="true">›</span></button>
      </div>
      <div className="pc-unfurl-footer"><button type="button" aria-pressed={muted} onClick={()=>setMuted(v=>!v)}>{muted?"Sound off · Enable whoosh":"Whoosh on · Mute sound"}</button><small>ETL GIS Consulting LLC</small></div>
    </nav>
  </div>;
}
