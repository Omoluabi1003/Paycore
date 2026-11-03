"use client";
import {useEffect,useState} from 'react';
import {decodeDocumentBook,emptyDocumentBook} from '../lib/document-import';
import type {DocumentBook} from '../lib/document-import';
export function useDocumentBook(){
 const [scope,setScope]=useState(''),[actor,setActor]=useState(''),[book,setBook]=useState<DocumentBook>(emptyDocumentBook('')),[ready,setReady]=useState(false),[error,setError]=useState('');
 const key=(value:string)=>`paycore-document-import-sample-v1:${encodeURIComponent(value)}`;
 useEffect(()=>{try{const profile=JSON.parse(localStorage.getItem('paycore.workspace.session.v1')??'null');if(!profile?.displayName||!profile?.email){setReady(true);return;}const nextScope=JSON.stringify([profile.displayName.trim(),(profile.companyName??'').trim()]);setScope(nextScope);setActor(profile.displayName);const raw=localStorage.getItem(key(nextScope));setBook(raw?decodeDocumentBook(raw,nextScope):emptyDocumentBook(nextScope));}catch{setError('Saved document records could not be read. They have been kept; do not overwrite them.');}setReady(true);},[]);
 function update(change:(current:DocumentBook)=>DocumentBook){if(!scope||!ready||error)throw Error('Open your workspace profile before saving documents.');const profile=JSON.parse(localStorage.getItem('paycore.workspace.session.v1')??'null');if(!profile||JSON.stringify([profile.displayName.trim(),(profile.companyName??'').trim()])!==scope)throw Error('Your workspace changed. Reload before continuing.');const raw=localStorage.getItem(key(scope));const current=raw?decodeDocumentBook(raw,scope):emptyDocumentBook(scope);const next=change(current);decodeDocumentBook(JSON.stringify(next),scope);try{localStorage.setItem(key(scope),JSON.stringify(next));}catch{throw Error('The browser could not save these records. Free storage space or export existing documents.');}setBook(next);return next;}
 useEffect(()=>{if(!scope)return;const refresh=(event:StorageEvent)=>{if(event.key===key(scope)){try{setBook(event.newValue?decodeDocumentBook(event.newValue,scope):emptyDocumentBook(scope));}catch{setError('Document records changed and could not be read. Reload to review.');}}};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[scope]);
 return {book,scope,actor,ready,error,update};
}
