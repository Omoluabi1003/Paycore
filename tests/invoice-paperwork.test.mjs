import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStatementHeader} from '../lib/statement-header.ts';
import {companySettingsKey,encodeCompanySettings,decodeCompanySettings,invoiceLetterhead,applyInvoiceCompanyDefaults} from '../lib/company-settings.ts';
import {invoiceEmail,factoringRecipient,remittanceInstruction} from '../lib/invoice-paperwork.ts';
import {emptyInvoiceBook,saveInvoiceDraft,issueInvoice} from '../lib/invoices.ts';
import {invoicePdf} from '../lib/invoice-pdf.ts';
const at='2026-11-01T12:00:00Z';
const draft=()=>({id:'synthetic-invoice',companyId:'synthetic-company',number:'SYN-100',issuer:'Synthetic Carrier',issuerAddress:'100 Example Street',customer:'Synthetic Customer',customerEmail:'customer@example.test',billingAddress:'200 Example Avenue',issuedOn:'2026-11-01',dueOn:'2026-11-15',currency:'USD',lines:[{id:'synthetic-load',loadReference:'SYN-LOAD-1',description:'Redundant freight description',pickupName:'Synthetic Pickup',pickupAddress:'300 Example Road',deliveryName:'Synthetic Delivery',deliveryAddress:'400 Example Road',quantityMillis:1000,unitPriceCents:140000}],discountCents:0,taxBasisPoints:0,notes:'Internal customer contact note',billingContact:'private-customer@example.test',paymentInstructions:'Make all checks payable to Synthetic Factor',factoringName:'Synthetic Factor LLC',factoringAddress:'500 Example Way',factoringContact:'factor@example.test',status:'DRAFT',payments:[],audit:[]});
function finalized(){const raw=draft();return issueInvoice(saveInvoiceDraft(emptyInvoiceBook(raw.companyId),raw,'Synthetic Specialist',at),raw.id,'Synthetic Specialist',at).invoices[0];}
test('freight paperwork prints route and agreed charge without extra description, unit rows, zero charges or duplicate remittance',()=>{
 const invoice=finalized(),before=JSON.stringify(invoice),pdf=new TextDecoder().decode(invoicePdf(invoice,'2026-11-01'));
 for(const value of ['Synthetic Customer','SYN-LOAD-1','Synthetic Pickup','Synthetic Delivery','300 Example Road','400 Example Road','1,400.00','TOTAL COST'])assert.ok(pdf.includes(value),value);
 for(const value of ['Redundant freight description','per unit','Internal customer contact note','private-customer@example.test','Make all checks payable to Synthetic Factor) Tj','Subtotal','Discount','Tax rate','Additional costs'])assert.ok(!pdf.includes(value),value);
 assert.equal(pdf.match(/Make all checks payable to Synthetic Factor LLC\./g)?.length,1);
 assert.equal(JSON.stringify(invoice),before);
});
test('real nonzero tax, discount and additional costs remain explained in freight paperwork',()=>{
 const invoice=draft();Object.assign(invoice,{discountCents:1000,taxBasisPoints:500,additionalCostsCents:2500,additionalCostsDescription:'Synthetic accessorial'});
 const pdf=new TextDecoder().decode(invoicePdf(invoice,'2026-11-01'));
 for(const value of ['Subtotal','Discount','Tax rate','Synthetic accessorial','1,484.50'])assert.ok(pdf.includes(value),value);
});
test('email drafts use the authorized factoring recipient and never fall back to the customer',()=>{
 const invoice=finalized();assert.equal(invoiceEmail(invoice),null);assert.equal(invoiceEmail(invoice,''),null);assert.equal(invoiceEmail(invoice,'invalid'),null);
 const mail=decodeURIComponent(invoiceEmail(invoice,'factor@example.test'));
 assert.ok(mail.startsWith('mailto:factor@example.test?'));assert.ok(!mail.includes('customer@example.test'));assert.ok(!mail.includes('private-customer@example.test'));
 assert.equal(factoringRecipient('factor@example.test\r\nBcc: other@example.test'),null);
 assert.equal(remittanceInstruction(invoice),'Make all checks payable to Synthetic Factor LLC.');
});
test('company settings reuse the letterhead and factoring details without carrying payroll-specific numbers or dates',()=>{
 const scope='Synthetic company profile',header={...emptyStatementHeader(),address:'100 Example Street',cityStateZip:'Example City, ZZ 00000',email:'carrier@example.test',phone:'555-0100',mcNumber:'SYN-MC',usdotNumber:'SYN-DOT',payrollNumber:'OLD-1',invoicePayDate:'2026-11-01',factoringName:'Synthetic Factor',factoringAddress:'500 Example Way',factoringEmail:'factor@example.test'};
 const encoded=encodeCompanySettings(scope,header),restored=decodeCompanySettings(encoded,scope);
 assert.equal(restored.payrollNumber,'');assert.equal(restored.invoicePayDate,'');assert.equal(restored.address,header.address);assert.equal(restored.factoringEmail,header.factoringEmail);
 const letterhead=invoiceLetterhead('Synthetic Carrier',restored);assert.ok(letterhead.issuerAddress.includes('MC SYN-MC'));assert.ok(letterhead.issuerAddress.includes('USDOT SYN-DOT'));assert.equal(letterhead.factoringEmail,'factor@example.test');
 assert.notEqual(companySettingsKey(scope),companySettingsKey(scope+' other'));assert.throws(()=>decodeCompanySettings(encoded,'Other profile'));assert.throws(()=>decodeCompanySettings('{',scope));
 assert.equal(header.payrollNumber,'OLD-1');
 const invoice=finalized(),before=JSON.stringify(invoice);invoiceLetterhead('Changed Company',{...restored,address:'Changed address'});assert.equal(JSON.stringify(invoice),before);
});

test('opening a legacy draft without configured defaults retains its entered company and factoring details',()=>{
 const raw=draft(),before=JSON.stringify(raw),result=applyInvoiceCompanyDefaults(raw,raw.issuer,emptyStatementHeader());
 assert.equal(result.issuerAddress,raw.issuerAddress);assert.equal(result.factoringAddress,raw.factoringAddress);assert.equal(result.factoringName,raw.factoringName);assert.equal(JSON.stringify(raw),before);
 const updated=applyInvoiceCompanyDefaults(raw,raw.issuer,{...emptyStatementHeader(),address:'101 Updated Example Street',factoringName:'New Synthetic Factor',factoringEmail:'new-factor@example.test'});
 assert.equal(updated.issuerAddress,'101 Updated Example Street');assert.equal(updated.factoringName,'New Synthetic Factor');assert.equal(updated.factoringEmail,'new-factor@example.test');assert.equal(JSON.stringify(raw),before);
});

test('duplicate payee text is removed while distinct authorized payment terms remain',()=>{
 const result=remittanceInstruction({factoringName:'Synthetic Factor LLC',paymentInstructions:'Make all checks payable to Synthetic Factor\nReference the invoice number.'});
 assert.equal(result,'Make all checks payable to Synthetic Factor LLC.\nReference the invoice number.');
 assert.equal(remittanceInstruction({paymentInstructions:'Use the agreed reference.'}),'Use the agreed reference.');
});
