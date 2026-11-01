import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyInvoiceBook,saveInvoiceDraft,issueInvoice,reviseInvoice,invoiceBalance,recordInvoicePayment,voidInvoice,validateInvoiceBook,decodeInvoiceBook,encodeInvoiceBook} from '../lib/invoices.ts';
import {invoiceEmail} from '../lib/invoice-paperwork.ts';
import {invoicePdf} from '../lib/invoice-pdf.ts';
const actor='Synthetic Specialist',at='2026-11-01T12:00:00Z',later='2026-11-01T12:01:00Z';
function issued(){const draft={id:'synthetic-invoice',companyId:'synthetic-company',number:'SYN-INV-1',issuer:'Synthetic Carrier',issuerAddress:'100 Example Street',factoringName:'Synthetic Factor',factoringAddress:'500 Example Way',customer:'Synthetic Customer',customerEmail:'customer@example.test',billingAddress:'200 Example Avenue',issuedOn:'2026-11-01',dueOn:'2026-11-15',currency:'USD',lines:[{id:'synthetic-load',loadReference:'SYN-LOAD',description:'Synthetic freight',pickupName:'Synthetic Pickup',pickupAddress:'300 Example Road',deliveryName:'Synthetic Delivery',deliveryAddress:'400 Example Road',quantityMillis:1000,unitPriceCents:140000}],discountCents:0,taxBasisPoints:0,notes:'',status:'DRAFT',payments:[],audit:[]};return issueInvoice(saveInvoiceDraft(emptyInvoiceBook(draft.companyId),draft,actor,at),draft.id,actor,at);}
const edit=(invoice,amount)=>({...invoice,lines:invoice.lines.map(line=>({...line,unitPriceCents:amount}))});
test('correcting a finalized invoice preserves its prior snapshot, number and original input',()=>{
 const book=issued(),original=book.invoices[0],before=JSON.stringify(book),pdf=invoicePdf(original,'2026-11-01');
 const next=reviseInvoice(book,{...edit(original,150000),lines:edit(original,150000).lines.map(line=>({...line,deliveryAddress:'401 Corrected Example Road'}))},'Corrected source price and destination',actor,later),invoice=next.invoices[0];
 assert.equal(invoice.status,'ISSUED');assert.equal(invoice.number,original.number);assert.equal(invoice.id,original.id);assert.equal(invoiceBalance(invoice).total.totalCents,150000);
 assert.deepEqual(invoice.revisions[0].snapshot,original);assert.equal(invoice.revisions[0].reason,'Corrected source price and destination');assert.equal(invoice.revisions[0].actor,actor);assert.equal(invoice.revisions[0].at,later);assert.ok(Object.isFrozen(invoice.revisions[0].snapshot));
 const email=decodeURIComponent(invoiceEmail(invoice,'factor@example.test'));assert.match(email,/Corrected invoice SYN-INV-1 \(revision 1\)/);assert.match(email,/replaces the earlier version/);assert.ok(!email.includes('customer@example.test'));
 assert.equal(JSON.stringify(book),before);assert.deepEqual(invoicePdf(invoice.revisions[0].snapshot,'2026-11-01'),pdf);assert.doesNotMatch(new TextDecoder().decode(invoicePdf(invoice,'2026-11-01')),/Earlier versions retained in invoice history/);
});
test('successive corrections retain independent prior versions across storage round trips',()=>{
 let book=issued();book=reviseInvoice(book,edit(book.invoices[0],150000),'First source correction',actor,later);book=reviseInvoice(book,edit(book.invoices[0],160000),'Second source correction',actor,'2026-11-01T12:02:00Z');
 const restored=decodeInvoiceBook(encodeInvoiceBook(book,'Synthetic profile'),'Synthetic profile',book.companyId),invoice=restored.invoices[0];
 assert.deepEqual(invoice.revisions.map(record=>record.version),[1,2]);assert.deepEqual(invoice.revisions.map(record=>record.snapshot.totals.totalCents),[140000,150000]);assert.equal(invoice.totals.totalCents,160000);assert.equal(invoice.revisions[1].snapshot.revisions,undefined);
});
test('corrections preserve payment evidence and cannot reduce the total below received funds',()=>{
 let book=issued();book=recordInvoicePayment(book,book.invoices[0].id,{id:'receipt-1',date:'2026-11-01',reference:'SYN-RECEIPT',amountCents:100000,note:'Synthetic receipt'},actor,later);
 const original=book.invoices[0],before=JSON.stringify(book),when='2026-11-01T12:02:00Z';
 assert.throws(()=>reviseInvoice(book,edit(original,90000),'Lower amount',actor,when),/exceed/);
 const corrected=reviseInvoice(book,{...edit(original,150000),payments:[],paymentReversals:[]},'Corrected agreed total',actor,when).invoices[0];
 assert.deepEqual(corrected.payments,original.payments);assert.deepEqual(corrected.paymentReversals,original.paymentReversals);assert.equal(invoiceBalance(corrected).balanceCents,50000);assert.equal(JSON.stringify(book),before);
});
test('corrections require a reason, current source version and unchanged company/number',()=>{
 const book=issued(),invoice=book.invoices[0];assert.throws(()=>reviseInvoice(book,invoice,' ',actor,later));assert.throws(()=>reviseInvoice(book,{...invoice,number:'OTHER'},'Reason',actor,later),/identity/);assert.throws(()=>reviseInvoice(book,{...invoice,companyId:'other'},'Reason',actor,later),/identity/);
 const changed=reviseInvoice(book,edit(invoice,150000),'First correction',actor,later);assert.throws(()=>reviseInvoice(changed,edit(invoice,160000),'Stale edit',actor,'2026-11-01T12:02:00Z'),/changed after/);
 const cancelled=voidInvoice(book,invoice.id,'No longer needed',actor,later);assert.throws(()=>reviseInvoice(cancelled,cancelled.invoices[0],'Reason',actor,'2026-11-01T12:02:00Z'),/finalized/);
 assert.throws(()=>reviseInvoice(book,edit(invoice,0),'Zero',actor,later),/positive/);assert.throws(()=>reviseInvoice(book,invoice,'Out of order',actor,'2026-11-01T11:00:00Z'),/time/);
});
test('revision history rejects mismatched identities and corrupted financial snapshots',()=>{
 const book=issued(),corrected=reviseInvoice(book,edit(book.invoices[0],150000),'Source correction',actor,later);
 const wrongCompany=structuredClone(corrected);wrongCompany.invoices[0].revisions[0].snapshot.companyId='other';assert.throws(()=>validateInvoiceBook(wrongCompany,book.companyId),/history/);
 const badTotals=structuredClone(corrected);badTotals.invoices[0].revisions[0].snapshot.totals.totalCents++;assert.throws(()=>validateInvoiceBook(badTotals,book.companyId),/totals/);
});
