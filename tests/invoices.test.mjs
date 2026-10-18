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
test('reference invoice adds described costs after tax and preserves payment instructions at issue',()=>{
 const input={...draft(),additionalCostsCents:2500,additionalCostsDescription:'Synthetic handling charge',paymentInstructions:'Pay the authorized example payee.',billingContact:'Billing desk: billing@example.test'};
 const result=calculateInvoice(input);assert.equal(result.taxCents,950);assert.equal(result.totalCents,22450);
 assert.throws(()=>calculateInvoice({...input,additionalCostsDescription:''}),/Describe/);
 assert.throws(()=>calculateInvoice({...input,additionalCostsCents:-1}));
 assert.throws(()=>calculateInvoice({...input,additionalCostsCents:Number.MAX_SAFE_INTEGER}),/range/);
 const book=issueInvoice(saveInvoiceDraft(emptyInvoiceBook('company-1'),input,actor,at),input.id,actor,at);
 const invoice=book.invoices[0];assert.equal(invoice.totals.totalCents,22450);assert.equal(invoice.paymentInstructions,input.paymentInstructions);assert.ok(Object.isFrozen(invoice));
 const pdf=new TextDecoder().decode(invoicePdf(invoice,'2026-10-18'));assert.match(pdf,/PAYMENT INSTRUCTIONS/);assert.match(pdf,/Synthetic handling charge/);assert.match(pdf,/billing@example.test/);assert.match(pdf,/224.50/);
 const restored=decodeInvoiceBook(encodeInvoiceBook(book,'profile'),'profile','company-1');assert.equal(restored.invoices[0].additionalCostsCents,2500);
 assert.throws(()=>validateInvoiceBook({...book,invoices:[{...invoice,additionalCostsCents:2600}]},'company-1'),/totals/);
});

test('automatic invoice numbers allocate on first save, retain UUID and remain fixed across edits, voids and years',async()=>{
 const {nextInvoiceNumber,saveAutomaticInvoiceDraft}=await import('../lib/invoices.ts');let book=emptyInvoiceBook('company-1');const raw={...draft(),id:'11111111-1111-4111-8111-111111111111',number:''};
 const before=JSON.stringify(book);assert.equal(nextInvoiceNumber(book,'2026-10-18'),'INV-2026-000001');assert.equal(JSON.stringify(book),before); // Viewing/cancelling a proposed draft consumes nothing.
 assert.throws(()=>saveAutomaticInvoiceDraft(book,{...raw,customer:""},actor,at));assert.equal(nextInvoiceNumber(book,"2026-10-18"),"INV-2026-000001");
 book=saveAutomaticInvoiceDraft(book,raw,actor,at);book=saveAutomaticInvoiceDraft(book,raw,actor,at);assert.equal(book.invoices.length,1);assert.equal(book.invoices[0].number,'INV-2026-000001');assert.equal(book.invoices[0].id,raw.id);const first=book.invoices[0];
 book=saveAutomaticInvoiceDraft(book,{...first,notes:'Updated synthetic note',issuedOn:'2026-11-01',dueOn:'2026-11-10'},actor,at);assert.equal(book.invoices[0].number,first.number);assert.equal(nextInvoiceNumber(book,'2026-10-18'),'INV-2026-000002');
 assert.equal(saveAutomaticInvoiceDraft(book,{...book.invoices[0],number:'CHANGED'},actor,at).invoices[0].number,first.number);assert.throws(()=>saveInvoiceDraft(book,{...book.invoices[0],number:'CHANGED'},actor,at),/cannot be changed/);
 book=issueInvoice(book,raw.id,actor,at);book=voidInvoice(book,raw.id,'Synthetic cancellation',actor,at);book=saveAutomaticInvoiceDraft(book,{...raw,id:'22222222-2222-4222-8222-222222222222',number:first.number},actor,at);assert.equal(book.invoices[0].number,'INV-2026-000002');
 const restored=decodeInvoiceBook(encodeInvoiceBook(book,'scope'),'scope','company-1');assert.equal(nextInvoiceNumber(restored,'2027-01-01'),'INV-2027-000003');assert.equal(nextInvoiceNumber(emptyInvoiceBook('company-2'),'2026-10-18'),'INV-2026-000001');
});
test('automatic numbering preserves legacy identities, normalizes reserved references and blocks unsafe sequence ranges',async()=>{
 const {nextInvoiceNumber,saveAutomaticInvoiceDraft}=await import('../lib/invoices.ts');const legacy=saved();const updated=saveAutomaticInvoiceDraft(legacy,{...legacy.invoices[0],notes:'Legacy retained'},actor,at);assert.equal(updated.invoices[0].number,'SYN-INV-001');assert.equal(updated.invoices[0].id,'invoice-1');
 const reserved=saveInvoiceDraft(legacy,{...draft(),id:'reserved',number:' inv-2025-000009 '},actor,at);assert.equal(nextInvoiceNumber(reserved,'2026-10-18'),'INV-2026-000010');assert.throws(()=>nextInvoiceNumber(reserved,'2026-02-30'));
 const overflow=saveInvoiceDraft(emptyInvoiceBook('company-1'),{...draft(),number:'INV-2026-9007199254740991'},actor,at);assert.throws(()=>nextInvoiceNumber(overflow,'2026-10-18'),/range/);
});

test('optional freight facts survive save, restoration and finalization without changing charges',()=>{
 const raw=draft();raw.customerPhone='555-0100';raw.customerFax='555-0101';
 Object.assign(raw.lines[0],{loadReference:'SYN-LOAD-42',pickupName:'Synthetic Origin',pickupAddress:'101 Example Road',deliveryName:'Synthetic Destination',deliveryAddress:'202 Example Avenue'});
 const before=calculateInvoice(draft());const book=saveInvoiceDraft(emptyInvoiceBook(raw.companyId),raw,actor,at);
 const restored=decodeInvoiceBook(encodeInvoiceBook(book,'freight-test'),'freight-test',raw.companyId);
 const final=issueInvoice(restored,raw.id,actor,at).invoices[0];
 assert.deepEqual(final.totals,before);assert.equal(final.customerPhone,raw.customerPhone);assert.equal(final.customerFax,raw.customerFax);
 for(const key of ['loadReference','pickupName','pickupAddress','deliveryName','deliveryAddress'])assert.equal(final.lines[0][key],raw.lines[0][key]);
 assert.ok(Object.isFrozen(final.lines[0]));
 const pdf=new TextDecoder().decode(invoicePdf(final,'2026-10-18'));
 for(const value of ['SYN-LOAD-42','Synthetic Origin','101 Example Road','Synthetic Destination','202 Example Avenue','555-0100'])assert.ok(pdf.includes(value),value);
 assert.throws(()=>saveInvoiceDraft(restored,{...raw,lines:[{...raw.lines[0],pickupAddress:'x'.repeat(241)}]},actor,at));
});

test('factoring template positions broker and remittance columns and omits the internal due date',()=>{
 const raw=draft();Object.assign(raw,{factoringName:'Synthetic Factor LLC',factoringAddress:'Dept 5\n300 Example Avenue\nExample City, ZZ 00000',factoringContact:'factor@example.test',billingContact:'billing@example.test',paymentInstructions:'Reference the invoice number.',notes:'Retain company instructions.'});
 Object.assign(raw.lines[0],{loadReference:'SYN-ROUTE-9',pickupName:'Synthetic Origin',pickupAddress:'101 Example Road',deliveryName:'Synthetic Destination',deliveryAddress:'202 Example Avenue'});
 const book=saveInvoiceDraft(emptyInvoiceBook(raw.companyId),raw,actor,at),restored=decodeInvoiceBook(encodeInvoiceBook(book,'factoring'),'factoring',raw.companyId),invoice=issueInvoice(restored,raw.id,actor,at).invoices[0];
 assert.equal(invoice.dueOn,raw.dueOn);assert.equal(invoice.factoringAddress,raw.factoringAddress);assert.ok(Object.isFrozen(invoice));assert.deepEqual(calculateInvoice(invoice),calculateInvoice(draft()));
 const pdf=new TextDecoder().decode(invoicePdf(invoice,'2026-10-18'));
 for(const text of ['INVOICE # : SYN-INV-001','Date: 2026-10-01','BILL TO:','FOR:','Synthetic Factor LLC','300 Example Avenue','factor@example.test','Reference the invoice number.','Retain company instructions.','TOTAL COST'])assert.ok(pdf.includes(text),text);
 assert.ok(!pdf.includes('Due date'));assert.ok(!pdf.includes(raw.dueOn));assert.match(pdf,/BT \/F2 9 Tf 350 [\d.]+ Td \(Synthetic Factor LLC\)/);
 const position=text=>Number(pdf.match(new RegExp('BT /F[12] [\\d.]+ Tf 30 ([\\d.]+) Td \\('+text))[1]);
 assert.ok(position('INVOICE #')>position('Date:'));assert.ok(position('Date:')>position('BILL TO:'));
 assert.throws(()=>saveInvoiceDraft(book,{...raw,factoringAddress:'x'.repeat(601)},actor,at));
});

test('long factoring invoices paginate every load, preserve the amount and keep text inside the page',()=>{
 const raw=draft();raw.lines=Array.from({length:20},(_,index)=>({...raw.lines[0],id:`load-${index}`,loadReference:`SYN-LONG-${index}`,pickupAddress:'Synthetic pickup address '.repeat(9),deliveryAddress:'Synthetic delivery address '.repeat(9).slice(0,240)}));
 raw.factoringName='Synthetic Factor';raw.factoringAddress='Synthetic remittance address '.repeat(20);
 const invoice=issueInvoice(saveInvoiceDraft(emptyInvoiceBook(raw.companyId),raw,actor,at),raw.id,actor,at).invoices[0];
 const bytes=invoicePdf(invoice,'2026-10-18'),pdf=new TextDecoder().decode(bytes);
 assert.ok(Number(pdf.match(/\/Count (\d+)/)[1])>1);
 for(let i=0;i<20;i++)assert.ok(pdf.includes(`For the Load #: SYN-LONG-${i}`));
 assert.ok(pdf.includes(invoiceMoney(calculateInvoice(invoice).totalCents)));
 for(const match of pdf.matchAll(/BT \/F[12] [\d.]+ Tf [\d.]+ ([\d.-]+) Td/g))assert.ok(Number(match[1])>=22&&Number(match[1])<=760,`Unsafe text height ${match[1]}`);
 assert.deepEqual(invoicePdf(invoice,'2026-10-18'),bytes);
});
