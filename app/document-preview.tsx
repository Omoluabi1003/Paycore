"use client";
import {useId,useRef,useState} from "react";
import type {ReactNode} from "react";

/** Native dialog keeps focus, Escape, and return-to-trigger behavior. No approval or payment is performed here. */
export default function DocumentPreview({title,children,label="Preview"}:{title:string;children:ReactNode;label?:string}){
 const dialog=useRef<HTMLDialogElement>(null),id=useId();
 const [zoom,setZoom]=useState(100);
 const [paper,setPaper]=useState<"white"|"warm">("warm");
 function open(){setZoom(100);dialog.current?.showModal();}
 return <>
  <button type="button" className="button button-secondary preview-trigger" aria-haspopup="dialog" onClick={open}>{label}</button>
  <dialog ref={dialog} className="document-preview craft-document-preview" aria-labelledby={id}>
   <header className="document-preview-toolbar craft-preview-toolbar">
    <div className="craft-preview-heading"><span className="craft-preview-kicker">DOCUMENT WORKBENCH · READ ONLY</span><h2 id={id}>{title}</h2></div>
    <button type="button" className="button button-secondary" onClick={()=>dialog.current?.close()}>Close <span aria-hidden="true">×</span></button>
   </header>
   <div className="craft-preview-instruments" aria-label="Document viewing controls">
    <div className="craft-preview-zoom" role="group" aria-label="Document zoom">
     <button type="button" aria-label="Zoom out" disabled={zoom<=75} onClick={()=>setZoom(z=>Math.max(75,z-25))}>−</button>
     <output aria-live="polite" aria-label="Zoom level">{zoom}%</output>
     <button type="button" aria-label="Zoom in" disabled={zoom>=125} onClick={()=>setZoom(z=>Math.min(125,z+25))}>+</button>
    </div>
    <div className="craft-paper-select" role="group" aria-label="Page appearance">
     <button type="button" aria-pressed={paper==="warm"} onClick={()=>setPaper("warm")}>Warm paper</button>
     <button type="button" aria-pressed={paper==="white"} onClick={()=>setPaper("white")}>White</button>
    </div>
    <button type="button" className="craft-print-button" onClick={()=>window.print()}>Print preview ↗</button>
   </div>
   <div className="document-preview-body craft-preview-stage" data-paper={paper}>
    <div className="craft-preview-sheet" style={{zoom:zoom/100}}>{children}</div>
   </div>
   <footer className="craft-preview-disclosure">Preview only. Printing does not approve payroll, issue a payment, or change any records.</footer>
  </dialog>
 </>;
}
