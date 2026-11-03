import {z} from 'zod';
const short=z.string().trim().max(240);
export const DocumentFieldsSchema=z.object({kind:z.enum(['INVOICE','RECEIPT']),vendor:short,reference:short,date:z.string().max(10),amount:z.string().max(30),currency:z.enum(['USD']),address:z.string().trim().max(1000),phone:short,category:z.enum(['BUSINESS_EXPENSE','FUEL','LOAD_DOCUMENT']),loadReference:short,assignment:short});
export type DocumentFields=z.infer<typeof DocumentFieldsSchema>;
const SourceSchema=z.object({name:z.string().min(1).max(180),sha256:z.string().regex(/^[a-f0-9]{64}$/),type:z.enum(['PDF','TEXT','CSV','IMAGE']),size:z.number().int().positive().max(25*1024*1024),text:z.string().max(100000),notice:z.string().max(1000)});
export const ImportedDocumentSchema=z.object({id:z.string().min(1).max(100),source:SourceSchema,fields:DocumentFieldsSchema,status:z.enum(['REVIEW','RECORDED','DISMISSED']),createdAt:z.iso.datetime(),reviewedAt:z.iso.datetime().optional(),reviewedBy:short.optional(),duplicateReason:short.optional()});
export type ImportedDocument=z.infer<typeof ImportedDocumentSchema>;
const BookSchema=z.object({version:z.literal(1),mode:z.literal('SAMPLE'),scope:z.string().max(1000),documents:z.array(ImportedDocumentSchema).max(300)});
export type DocumentBook=z.infer<typeof BookSchema>;
export const emptyDocumentFields=():DocumentFields=>({kind:'INVOICE',vendor:'',reference:'',date:'',amount:'',currency:'USD',address:'',phone:'',category:'BUSINESS_EXPENSE',loadReference:'',assignment:''});
export function documentAmountCents(value:string){if(!/^\d{1,13}(?:\.\d{1,2})?$/.test(value))throw Error('Enter a positive USD amount with up to two decimal places.');const [whole,fraction='']=value.split('.');const cents=BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,'0'));if(cents<=BigInt(0)||cents>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Check the document amount.');return Number(cents);}
export function documentIssues(fields:DocumentFields){const issues:string[]=[];if(!fields.vendor.trim())issues.push('Vendor is required.');if(!fields.reference.trim())issues.push('Invoice or receipt number is required.');if(!/^\d{4}-\d{2}-\d{2}$/.test(fields.date)||Number.isNaN(Date.parse(fields.date+'T00:00:00Z'))||new Date(fields.date+'T00:00:00Z').toISOString().slice(0,10)!==fields.date)issues.push('A valid document date is required.');try{documentAmountCents(fields.amount);}catch(e){issues.push((e as Error).message);}return issues;}
const normalize=(v:string)=>v.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
export function documentDuplicates(book:DocumentBook,candidate:ImportedDocument){return book.documents.filter(item=>item.id!==candidate.id&&item.status!=='DISMISSED'&&(item.source.sha256===candidate.source.sha256||(normalize(candidate.fields.vendor)&&normalize(candidate.fields.reference)&&normalize(item.fields.vendor)===normalize(candidate.fields.vendor)&&normalize(item.fields.reference)===normalize(candidate.fields.reference))));}
export function emptyDocumentBook(scope:string):DocumentBook{return {version:1,mode:'SAMPLE',scope,documents:[]};}
export function decodeDocumentBook(raw:string,scope:string):DocumentBook{if(raw.length>8000000)throw Error('Saved document records are too large.');const book=BookSchema.parse(JSON.parse(raw));if(book.scope!==scope)throw Error('These records belong to another workspace.');if(new Set(book.documents.map(item=>item.id)).size!==book.documents.length)throw Error('Duplicate document identity.');for(const item of book.documents)if(item.status==='RECORDED'&&(!item.reviewedAt||!item.reviewedBy?.trim()||documentIssues(item.fields).length))throw Error('Invalid reviewed document.');return book;}
export function saveDocumentReview(book:DocumentBook,candidate:ImportedDocument){const parsed=ImportedDocumentSchema.parse(candidate);const previous=book.documents.find(item=>item.id===parsed.id);if(previous?.status==='RECORDED')throw Error('A recorded document cannot be overwritten.');if(parsed.status!=='REVIEW')throw Error('Save as a review first.');if(book.documents.some(item=>item.id!==parsed.id&&item.status!=='DISMISSED'&&item.source.sha256===parsed.source.sha256))throw Error('This file is already in your document inbox. Open the existing record.');if(!previous&&book.documents.length>=300)throw Error('The local document inbox is full. Export your records before adding more.');return {...book,documents:previous?book.documents.map(item=>item.id===parsed.id?parsed:item):[...book.documents,parsed]};}
export function recordDocument(book:DocumentBook,id:string,fields:DocumentFields,actor:string,at:string,acknowledged:boolean,duplicateReason=''){const previous=book.documents.find(item=>item.id===id);if(!previous||previous.status!=='REVIEW')throw Error('Open a pending document review.');const checked=DocumentFieldsSchema.parse(fields);const issues=documentIssues(checked);if(issues.length)throw Error(issues.join(' '));if(!acknowledged||!actor.trim())throw Error('Check the source and confirm your review.');z.iso.datetime().parse(at);const candidate={...previous,fields:checked};const duplicates=documentDuplicates(book,candidate);if(duplicates.some(item=>item.source.sha256===candidate.source.sha256))throw Error('The same source file has already been imported.');if(duplicates.length&&duplicateReason.trim().length<10)throw Error('Explain why this is a separate document despite the matching vendor and reference.');const result=ImportedDocumentSchema.parse({...candidate,status:'RECORDED',reviewedAt:at,reviewedBy:actor,duplicateReason:duplicates.length?duplicateReason.trim():undefined});return {...book,documents:book.documents.map(item=>item.id===id?result:item)};}
export function dismissDocument(book:DocumentBook,id:string){const item=book.documents.find(item=>item.id===id);if(!item||item.status!=='REVIEW')throw Error('Only a pending review can be dismissed.');return {...book,documents:book.documents.map(item=>item.id===id?{...item,status:'DISMISSED' as const}:item)};}
export function extractDocumentFields(text:string):{fields:DocumentFields;warnings:string[]}{
 const fields=emptyDocumentFields(),warnings:string[]=[];const lines=text.replace(/\r/g,'').split('\n').map(line=>line.trim()).filter(Boolean);
 const capture=(pattern:RegExp)=>lines.map(line=>pattern.exec(line)?.[1]?.trim()).find(Boolean)??'';
 fields.kind=/\breceipt\b/i.test(text)&&!/\binvoice\b/i.test(text)?'RECEIPT':'INVOICE';
 fields.vendor=capture(/^(?:vendor|supplier|sold by|merchant)\s*:\s*(.+)$/i);
 if(!fields.vendor){const first=lines[0]??'';if(first.length<=160&&!/invoice|receipt|date|total|bill to|^(?:vendor|supplier|merchant|address|phone|currency)\s*:/i.test(first))fields.vendor=first;}
 fields.reference=capture(/^(?:invoice|receipt)(?:\s*(?:number|no\.?|#))?\s*[:#-]\s*([A-Z0-9][A-Z0-9_./-]*)\s*$/i);
 const rawDate=capture(/^(?:(?:invoice|receipt)\s+)?date\s*:\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/i);
 if(rawDate){const us=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(rawDate);fields.date=us?`${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`:rawDate;}
 const totals=lines.flatMap(line=>{const match=/^(?:grand total|invoice total|total amount|total cost|total)\s*:?\s*(?:USD\s*)?\$?\s*([\d,]+\.\d{2})(?:\s*USD)?$/i.exec(line);return match?[match[1].replaceAll(',','')]:[];});
 if(new Set(totals).size===1)fields.amount=totals[0];else if(totals.length)warnings.push('Multiple totals found. Check the source total.');
 if(/(?:\bEUR\b|\bGBP\b|\bCAD\b|\bAUD\b|\bJPY\b|€|£)/.test(text)||lines.some(line=>/^currency\s*:/i.test(line)&&!/^currency\s*:\s*USD$/i.test(line))){fields.amount='';warnings.push('Possible non-USD currency. Only USD records are supported.');}
 fields.address=capture(/^(?:vendor address|supplier address|merchant address|address)\s*:\s*(.+)$/i);fields.phone=capture(/^(?:vendor phone|phone|telephone|tel)\s*:\s*(.+)$/i);fields.loadReference=capture(/^(?:load|load number|load #|load reference)\s*:\s*(.+)$/i);
 if(/\bfuel\b|\bdiesel\b/i.test(text))fields.category='FUEL';
 if(!text.trim())warnings.push('No readable text found. Enter the fields while checking the original document.');
 return {fields:DocumentFieldsSchema.parse(fields),warnings};
}

// One billing document per CSV. Quoted commas/newlines remain part of a field.
export function extractDocumentCsv(text:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(char===','||char==='\n')){row.push(cell.trim());cell='';if(char==='\n'){if(row.some(Boolean))rows.push(row);row=[];}}else if(char!=='\r')cell+=char;}
 if(quoted)throw Error('The CSV contains an unfinished quoted field.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 if(rows.length!==2)throw Error('Import a CSV with one header row and one invoice or receipt row. Split multiple documents into separate files.');
 const headers=rows[0].map(value=>value.replace(/^\uFEFF/,'').toLowerCase().replace(/[ _-]+/g,''));if(new Set(headers).size!==headers.length)throw Error('CSV column names must be unique.');if(rows[0].length!==rows[1].length)throw Error('CSV headers and values must have the same number of columns.');
 const get=(...names:string[])=>{const index=headers.findIndex(value=>names.includes(value));return index<0?'':rows[1][index];};
 const fields=emptyDocumentFields();
 fields.vendor=get('vendor','supplier','merchant');fields.reference=get('reference','invoicenumber','receiptnumber');
 fields.date=get('date','invoicedate','receiptdate');const us=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(fields.date);if(us)fields.date=`${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
 fields.amount=get('total','amount').replace(/^[\s$]+/,'').replaceAll(',','');fields.address=get('address','vendoraddress');fields.phone=get('phone','vendorphone');fields.loadReference=get('loadreference');if(get('kind','type').toUpperCase()==='RECEIPT')fields.kind='RECEIPT';
 const warnings:string[]=[];const currency=get('currency')||'USD';if(currency.toUpperCase()!=='USD'){fields.amount='';warnings.push('Possible non-USD currency. Only USD records are supported.');}
 return {fields:DocumentFieldsSchema.parse(fields),warnings};
}
