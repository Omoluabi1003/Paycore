import test from 'node:test';import assert from 'node:assert/strict';
import {calculateInvoice,decodeInvoiceBook,emptyInvoiceBook,encodeInvoiceBook,invoiceBalance,invoiceMoney,invoiceStatus,issueInvoice,lineAmount,parseInvoiceAmount,recordInvoicePayment,reverseInvoicePayment,saveInvoiceDraft,validateInvoiceBook,voidInvoice} from '../lib/invoices.ts';
import {invoicePdf} from '../lib/invoice-pdf.ts';
const at='2026-10-18T12:00:00Z',actor='Synthetic Specialist';
const draft=()=>({id:'invoice-1',companyId:'company-1',number:'SYN-INV-001',issuer:'Synthetic Company',issuerAddress:'101 Example Way',customer:'Synthetic Customer',customerEmail:'customer@example.test',billingAddress:'202 Example Lane',issuedOn:'2026-10-01',dueOn:'2026-10-10',currency:'USD',lines:[{id:'line-1',description:'Synthetic service',quantityMillis:2000,unitPriceCents:10000}],discountCents:1000,taxBasisPoints:500,notes:'Fictional example only',status:'DRAFT',payments:[],audit:[]});
const saved=()=>saveInvoiceDraft(emptyInvoiceBook('company-1'),draft(),actor,at);
const issued=()=>issueInvoice(saved(),'invoice-1',actor,at);
const payment=(overrides={})=>({id:'payment-1',date:'2026-10-18',reference:'SYN-RECEIPT-1',amountCents:5000,note:'Synthetic receipt',...overrides});
test('integer invoice arithmetic calculates lines, discount and configured tax without floats',()=>{
 assert.deepEqual(calculateInvoice(draft()),{subtotalCents:20000,discountCents:1000,taxCents:950,totalCents:19950});
 assert.equal(lineAmount({id:'half',description:'Half unit',quantityMillis:500,unitPriceCents:1}),1);
 assert.equal(lineAmount({id:'fractional',description:'Fractional unit',quantityMillis:1333,unitPriceCents:5}),7);
 assert.equal(parseInvoiceAmount('1.333',3),1333);assert.equal(parseInvoiceAmount('8.25'),825);
 assert.equal(invoiceMoney(Number.MAX_SAFE_INTEGER),'$90,071,992,547,409.91');
 for(const invalid of ['-1','1.001','1e3','NaN','Infinity','9007199254740999'])assert.throws(()=>parseInvoiceAmount(invalid));
 assert.throws(()=>calculateInvoice({...draft(),discountCents:20001}),/Discount/);assert.throws(()=>calculateInvoice({...draft(),taxBasisPoints:10001}));assert.throws(()=>lineAmount({...draft().lines[0],quantityMillis:0}));
});
test('drafts require valid identity, dates and unique company-scoped invoice numbers',()=>{
 const book=saved();assert.throws(()=>saveInvoiceDraft(book,{...draft(),id:'invoice-2',number:'syn- inv-001'},actor,at),/duplicated/);
 assert.throws(()=>saveInvoiceDraft(book,{...draft(),companyId:'other'},actor,at),/company/);
 assert.throws(()=>saveInvoiceDraft(book,{...draft(),dueOn:'2026-09-30'},actor,at),/Due date/);
 assert.throws(()=>saveInvoiceDraft(book,{...draft(),customerEmail:'invalid'},actor,at));
 assert.throws(()=>saveInvoiceDraft(book,{...draft(),lines:[draft().lines[0],draft().lines[0]]},actor,at),/duplicated/);
});
test('finalization is explicit, immutable and retry-safe; later draft edits cannot change the issued snapshot',()=>{
 const raw=draft(),book=saveInvoiceDraft(emptyInvoiceBook('company-1'),raw,actor,at),before=JSON.stringify(book),final=issueInvoice(book,raw.id,actor,at);
 assert.equal(book.invoices[0].status,'DRAFT');assert.equal(JSON.stringify(book),before);assert.ok(Object.isFrozen(final.invoices[0].lines[0]));assert.equal(final.invoices[0].totals.totalCents,19950);
 raw.lines[0].unitPriceCents=1;assert.equal(final.invoices[0].lines[0].unitPriceCents,10000);assert.equal(issueInvoice(final,raw.id,actor,at),final);
 assert.throws(()=>saveInvoiceDraft(final,draft(),actor,at),/cannot be edited/);
 assert.throws(()=>issueInvoice(saveInvoiceDraft(emptyInvoiceBook('company-1'),{...draft(),discountCents:20000},actor,at),raw.id,actor,at),/positive/);
});
test('manual partial payments reconcile balance and become paid exactly at zero',()=>{
 const final=issued(),part=recordInvoicePayment(final,'invoice-1',payment(),actor,at);
 assert.equal(invoiceBalance(part.invoices[0]).balanceCents,14950);assert.equal(invoiceStatus(part.invoices[0],'2026-10-10'),'Partially paid');assert.equal(invoiceStatus(part.invoices[0],'2026-10-18'),'Overdue');
 const full=recordInvoicePayment(part,'invoice-1',payment({id:'payment-2',reference:'SYN-RECEIPT-2',amountCents:14950}),actor,at);
 assert.equal(invoiceBalance(full.invoices[0]).balanceCents,0);assert.equal(invoiceStatus(full.invoices[0],'2026-10-18'),'Paid');assert.equal(final.invoices[0].payments.length,0);assert.deepEqual(full.invoices[0].lines,final.invoices[0].lines);
});
test('payment retries cannot double-post; duplicates, future receipts and overpayments are blocked',()=>{
 const part=recordInvoicePayment(issued(),'invoice-1',payment(),actor,at);
 assert.equal(recordInvoicePayment(part,'invoice-1',{note:'Synthetic receipt',amountCents:5000,reference:'SYN-RECEIPT-1',date:'2026-10-18',id:'payment-1'},actor,at),part);
 assert.throws(()=>recordInvoicePayment(part,'invoice-1',payment({amountCents:4999}),actor,at),/identifier/);
 assert.throws(()=>recordInvoicePayment(part,'invoice-1',payment({id:'payment-2',reference:'syn- receipt-1'}),actor,at),/duplicated/);
 assert.throws(()=>recordInvoicePayment(part,'invoice-1',payment({id:'payment-2',reference:'new',amountCents:14951}),actor,at),/exceed/);
 assert.throws(()=>recordInvoicePayment(issued(),'invoice-1',payment({date:'2026-10-19'}),actor,at),/future/);
 assert.throws(()=>recordInvoicePayment(saved(),'invoice-1',payment(),actor,at),/issued/);
 assert.throws(()=>recordInvoicePayment(issued(),'invoice-1',payment({date:'2026-09-30'}),actor,at),/invalid date/);
});
test('void preserves unpaid history, requires a reason and cannot hide received payments',()=>{
 const final=issued();assert.throws(()=>voidInvoice(final,'invoice-1',' ',actor,at),/reason/);
 const removed=voidInvoice(final,'invoice-1','Synthetic duplicate replaced',actor,at);assert.equal(invoiceStatus(removed.invoices[0],'2026-10-18'),'Void');assert.equal(removed.invoices.length,1);assert.equal(removed.invoices[0].audit.at(-1).reason,'Synthetic duplicate replaced');
 assert.throws(()=>recordInvoicePayment(removed,'invoice-1',payment(),actor,at),/issued/);
 assert.throws(()=>voidInvoice(recordInvoicePayment(final,'invoice-1',payment(),actor,at),'invoice-1','Incorrect invoice',actor,at),/payment records/);
});
test('saved invoices are profile/company scoped and reject altered totals or reordered history',()=>{
 const final=issued(),encoded=encodeInvoiceBook(final,'profile-company-1');assert.deepEqual(decodeInvoiceBook(encoded,'profile-company-1','company-1'),final);
 assert.throws(()=>decodeInvoiceBook(encoded,'profile-company-2','company-1'),/profile/);assert.throws(()=>decodeInvoiceBook(encoded,'profile-company-1','company-2'),/company/);
 const bad=structuredClone(final);bad.invoices[0].totals.totalCents++;assert.throws(()=>validateInvoiceBook(bad,'company-1'),/totals/);
 assert.throws(()=>recordInvoicePayment(final,'invoice-1',payment({date:'2026-10-17'}),actor,'2026-10-17T12:00:00Z'),/time/);
});
test('invoice PDF is deterministic, branded and derives every amount from stored facts',()=>{
 const invoice=recordInvoicePayment(issued(),'invoice-1',payment(),actor,at).invoices[0],before=JSON.stringify(invoice),bytes=invoicePdf(invoice,'2026-10-18'),pdf=new TextDecoder().decode(bytes);
 for(const text of ['PayCore','INVOICE - DEMO','Synthetic Customer','$199.50','$149.50','SYN-RECEIPT-1','Developed by ETL GIS Consulting LLC','TRCenturyGothicItalic','CenturyGothic-BoldItalic'])assert.ok(pdf.includes(text),text);
 assert.equal(JSON.stringify(invoice),before);assert.deepEqual(invoicePdf(invoice,'2026-10-18'),bytes);const xref=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(xref,xref+4),'xref');
 const long={...draft(),notes:'W'.repeat(1000),lines:Array.from({length:100},(_,i)=>({id:'line-'+i,description:`Synthetic invoice line ${i} `+'W'.repeat(180),quantityMillis:1000,unitPriceCents:1000}))};const longInvoice=issueInvoice(saveInvoiceDraft(emptyInvoiceBook('company-1'),long,actor,at),'invoice-1',actor,at).invoices[0],longPdf=new TextDecoder().decode(invoicePdf(longInvoice,'2026-10-18'));
 assert.ok(Number(longPdf.match(/\/Count (\d+)/)[1])>1);assert.ok(longPdf.includes('Synthetic invoice line 99'));assert.equal([...longPdf.matchAll(/Developed by ETL GIS Consulting LLC/g)].length,Number(longPdf.match(/\/Count (\d+)/)[1]));
});

test('payment record corrections preserve original receipts and post one compensating reversal',()=>{
 const original=recordInvoicePayment(issued(),'invoice-1',payment(),actor,at),before=JSON.stringify(original);
 assert.throws(()=>reverseInvoicePayment(original,'invoice-1','payment-1',' ',actor,at));
 const corrected=reverseInvoicePayment(original,'invoice-1','payment-1','Synthetic amount entered in error',actor,at);
 assert.equal(JSON.stringify(original),before);assert.equal(corrected.invoices[0].payments.length,1);assert.equal(corrected.invoices[0].payments[0].amountCents,5000);assert.equal(corrected.invoices[0].paymentReversals.length,1);assert.equal(invoiceBalance(corrected.invoices[0]).paidCents,0);assert.equal(invoiceBalance(corrected.invoices[0]).balanceCents,19950);
 assert.equal(reverseInvoicePayment(corrected,'invoice-1','payment-1','Synthetic amount entered in error',actor,at),corrected);
 assert.throws(()=>reverseInvoicePayment(corrected,'invoice-1','payment-1','Changed reason',actor,at),/already reversed/);
 assert.throws(()=>reverseInvoicePayment(corrected,'invoice-1','missing','Synthetic correction',actor,at),/not found/);
 const replacement=recordInvoicePayment(corrected,'invoice-1',payment({id:'payment-2',amountCents:19950}),actor,at);assert.equal(invoiceStatus(replacement.invoices[0],'2026-10-18'),'Paid');assert.equal(replacement.invoices[0].payments.length,2);
 const pdf=new TextDecoder().decode(invoicePdf(replacement.invoices[0],'2026-10-18'));assert.ok(pdf.includes('REVERSED - not counted'));assert.ok(pdf.includes('Synthetic amount entered in error'));
 const voided=voidInvoice(corrected,'invoice-1','Synthetic replacement invoice needed',actor,at);assert.equal(voided.invoices[0].status,'VOID');assert.equal(voided.invoices[0].payments.length,1);
});
