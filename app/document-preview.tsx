"use client";
import {useId,useRef} from "react";
import type {ReactNode} from "react";
/** Read-only native dialog: focus trap, Escape and return-to-trigger provided by the browser. */
export default function DocumentPreview({title,children,label="Preview"}:{title:string;children:ReactNode;label?:string}){
 const dialog=useRef<HTMLDialogElement>(null),id=useId();
 return <><button type="button" className="button button-secondary preview-trigger" aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>{label}</button><dialog ref={dialog} className="document-preview" aria-labelledby={id}><header className="document-preview-toolbar"><h2 id={id}>{title}</h2><button type="button" className="button button-secondary" autoFocus onClick={()=>dialog.current?.close()}>Back to editing</button></header><div className="document-preview-body">{children}</div></dialog></>;
}
