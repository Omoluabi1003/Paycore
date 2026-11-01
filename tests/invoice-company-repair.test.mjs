import test from 'node:test';import assert from 'node:assert/strict';
import {emptyStatementHeader} from '../lib/statement-header.ts';
import {invoiceLetterhead,importCompanySettings,companySetupIssues} from '../lib/company-settings.ts';
import {syncDraftCompanySettings,repairInvoiceCompanyDetails} from '../lib/invoice-company-repair.ts';
import {invoicePaperworkIssues} from '../lib/invoice-readiness.ts';
import {emptyInvoiceBook,saveInvoiceDraft,issueInvoice,calculateInvoice,validateInvoiceBook,invoiceBalance} from '../lib/invoices.ts';
import {invoicePdf,invoiceBatchPdf} from '../lib/invoice-pdf.ts';
import {invoiceEmail} from '../lib/invoice-paperwork.ts';
const at='2026-11-01T12:00:00Z',later='2026-11-01T12:01:00Z',actor='Synthetic Specialist';
const header=()=>({...emptyStatementHeader(),legalName:'Synthetic Registered Carrier LLC',address:'100 Example Street',cityStateZip:'Test, ZZ 00000',email:'carrier@example.test',phone:'555-0100',factoringName:'Synthetic Factor LLC',factoringAddress:'500 Example Way',factoringContact:'Synthetic factoring team',factoringEmail:'factor@example.test'});
const draft=()=>({id:'synthetic-invoice',companyId:'synthetic-company',number:'SYN-INV-1',issuer:'Old profile spelling',issuerAddress:'',customer:'Synthetic Customer',customerEmail:'customer@example.test',billingAddress:'200 Example Avenue',issuedOn:'2026-11-01',dueOn:'2026-11-15',currency:'USD',lines:[{id:'synthetic-load',loadReference:'SYN-LOAD',description:'Synthetic freight',pickupName:'Synthetic Pickup',pickupAddress:'300 Example Road',deliveryName:'Synthetic Delivery',deliveryAddress:'400 Example Road',quantityMillis:1000,unitPriceCents:140000}],discountCents:0,taxBasisPoints:0,notes:'',status:'DRAFT',payments:[],audit:[]});
function saved(){const raw=draft();return saveInvoiceDraft(emptyInvoiceBook(raw.companyId),raw,actor,at);}
function legacy(){const raw=draft();return validateInvoiceBook({version:1,companyId:raw.companyId,invoices:[{...raw,status:'ISSUED',totals:calculateInvoice(raw),payments:[{id:'receipt-1',date:'2026-11-01',reference:'SYN-RECEIPT',amountCents:75000,note:'Synthetic receipt'}],audit:[{actor,at,action:'Legacy invoice finalized'}]}]},raw.companyId);}
test('incomplete freight invoices cannot be finalized, downloaded or prepared for outgoing email',()=>{
 const book=saved(),invoice=book.invoices[0];assert.equal(invoicePaperworkIssues(invoice).length,3);assert.throws(()=>issueInvoice(book,invoice.id,actor,later),/Complete company setup/);
 const old=legacy().invoices[0];assert.throws(()=>invoicePdf(old,'2026-11-01'),/Complete company setup/);assert.throws(()=>invoiceBatchPdf([old],'2026-11-01'),/Complete company setup/);assert.equal(invoiceEmail(old,'factor@example.test'),null);
 assert.match(new TextDecoder().decode(invoicePdf(old,'2026-11-01',{historical:true})),/HISTORICAL COPY/);
});
test('saving complete company settings updates existing drafts without changing customer, route or prices',()=>{
 const book=saved(),before=JSON.stringify(book),next=syncDraftCompanySettings(book,'Profile alias',header(),actor,later),invoice=next.invoices[0];
 assert.equal(invoice.issuer,'Synthetic Registered Carrier LLC');assert.ok(invoice.issuerAddress.includes('100 Example Street'));assert.equal(invoice.factoringAddress,'500 Example Way');assert.deepEqual(invoicePaperworkIssues(invoice),[]);
 assert.equal(invoice.status,'DRAFT');assert.equal(invoice.customer,book.invoices[0].customer);assert.deepEqual(invoice.lines,book.invoices[0].lines);assert.equal(JSON.stringify(book),before);
 assert.equal(syncDraftCompanySettings(next,'Profile alias',header(),actor,later),next);assert.equal(issueInvoice(next,invoice.id,actor,later).invoices[0].totals.totalCents,140000);
});
test('one-click repair preserves legacy invoice identity, total, receipts and previous blank version',()=>{
 const book=legacy(),original=book.invoices[0],before=JSON.stringify(book),repaired=repairInvoiceCompanyDetails(book,original.id,'Profile alias',header(),actor,later),invoice=repaired.invoices[0];
 assert.equal(invoice.id,original.id);assert.equal(invoice.number,original.number);assert.deepEqual(invoice.totals,original.totals);assert.deepEqual(invoice.payments,original.payments);assert.equal(invoiceBalance(invoice).balanceCents,65000);assert.equal(invoice.revisions.length,1);assert.equal(invoice.revisions[0].snapshot.issuerAddress,'');assert.equal(invoice.revisions[0].snapshot.factoringName,undefined);assert.equal(JSON.stringify(book),before);
 const pdf=new TextDecoder().decode(invoicePdf(invoice,'2026-11-01'));assert.ok(pdf.includes('Synthetic Registered Carrier LLC'));assert.ok(pdf.includes('500 Example Way'));assert.ok(pdf.includes('factor@example.test'));assert.equal(repairInvoiceCompanyDetails(repaired,invoice.id,'Profile alias',header(),actor,later),repaired);
});
test('incomplete settings never overwrite records or silently repair issued invoices',()=>{
 const book=legacy(),before=JSON.stringify(book);assert.throws(()=>repairInvoiceCompanyDetails(book,book.invoices[0].id,'Profile alias',emptyStatementHeader(),actor,later),/Complete company setup/);assert.equal(JSON.stringify(book),before);
 const complete=header();assert.deepEqual(companySetupIssues(complete),[]);assert.ok(companySetupIssues({...complete,factoringEmail:''}).includes('authorized factoring invoice email'));
 assert.equal(syncDraftCompanySettings(book,'Profile alias',complete,actor,later),book);
});
test('private settings import validates its contents and binds no company or profile identifiers',()=>{
 const value=JSON.stringify({version:1,header:header()}),parsed=importCompanySettings(value);assert.equal(invoiceLetterhead('Profile alias',parsed).issuer,'Synthetic Registered Carrier LLC');assert.deepEqual(companySetupIssues(parsed),[]);
 for(const raw of ['{',JSON.stringify({version:2,header:header()}),JSON.stringify({version:1,scope:'other',header:header()}),JSON.stringify({version:1,header:{...header(),factoringEmail:'invalid'}}),'x'.repeat(120001)])assert.throws(()=>importCompanySettings(raw));
});
