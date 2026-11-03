import {extractDocumentFields,extractDocumentCsv} from './document-import';
import type {ImportedDocument} from './document-import';
export const DOCUMENT_ACCEPT='.pdf,.txt,.csv,.png,.jpg,.jpeg,.webp';
export async function readBillingDocument(file:File):Promise<ImportedDocument>{
 if(file.size<=0||file.size>25*1024*1024)throw Error('Choose a document between 1 byte and 25 MB.');
 const ext=file.name.split('.').pop()?.toLowerCase()??'';
 if(!['pdf','txt','csv','png','jpg','jpeg','webp'].includes(ext))throw Error('Choose a PDF, text, CSV or image file.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
 let text='',notice='',type:ImportedDocument['source']['type']='TEXT';
 if(ext==='pdf'){
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('The file is not a valid PDF.');
  type='PDF';const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
  const task=pdfjs.getDocument({data:bytes,useSystemFonts:true});
  try{const doc=await task.promise;if(doc.numPages>30)throw Error('Choose a PDF with 30 pages or fewer.');for(let number=1;number<=doc.numPages;number++){const page=await doc.getPage(number),content=await page.getTextContent();let lastY:number|undefined;for(const item of content.items){if(!('str' in item))continue;const y=item.transform[5];if(lastY!==undefined&&Math.abs(y-lastY)>3)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');lastY=y;}text+='\n';if(text.length>100000)throw Error('This document contains too much text. Split it into smaller documents.');}if(!text.trim())notice='This PDF needs OCR. Enter the details manually from the original for now.';}finally{await task.destroy();}
 }else if(['png','jpg','jpeg','webp'].includes(ext)){const signature=Array.from(bytes.slice(0,12));const valid=ext==='png'?signature.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':ext==='webp'?new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP':signature[0]===255&&signature[1]===216&&signature[2]===255;if(!valid)throw Error('The image does not match its file extension.');type='IMAGE';notice='Photo extraction is not connected yet. Check the original and enter the details below.';}
 else {text=await file.text();if(text.length>100000)throw Error('Choose a document containing no more than 100,000 characters.');if(ext==='csv'){type='CSV';notice='One billing document extracted from CSV. Verify its fields before recording.';}}
 const extracted=type==='CSV'?extractDocumentCsv(text):extractDocumentFields(text);
 return {id:crypto.randomUUID(),source:{name:file.name.replace(/[\\/]/g,'_').slice(0,180),sha256,type,size:file.size,text,notice:[notice,...extracted.warnings].filter(Boolean).join(' ')},fields:extracted.fields,status:'REVIEW',createdAt:new Date().toISOString()};
}
