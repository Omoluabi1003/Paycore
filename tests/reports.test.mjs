import test from 'node:test';import assert from 'node:assert/strict';
import {invoiceReportRows,invoiceReportTotals,payrollReportRows,filterPayrollReport,payrollReportTotals,reportMoney,reportCsv,selectedInvoiceDocuments,selectedPayrollDocuments} from '../lib/reports.ts';
import {emptyInvoiceBook,saveInvoiceDraft,issueInvoice,recordInvoicePayment,voidInvoice} from '../lib/invoices.ts';
import {invoiceBatchPdf} from '../lib/invoice-pdf.ts';
import {reportPdf} from '../lib/report-pdf.ts';
import {calculateGridRow,emptyGridRow} from '../lib/payroll-grid.ts';
import {simulateApproval,transitionDemo} from '../lib/demo-payroll.ts';
import {demoPdf} from '../lib/demo-exports.ts';
const at='2026-10-18T12:00:00Z',actor='Synthetic Specialist',filter={year:'All',from:'',to:'',status:'Finalized',search:''};
const draft=(id='one')=>({id,companyId:'company-1',number:`SYN-${id}`,issuer:'Synthetic Company',issuerAddress:'',customer:'Synthetic Customer',customerEmail:'',billingAddress:'',issuedOn:'2026-10-01',dueOn:'2026-10-10',currency:'USD',lines:[{id:`line-${id}`,description:'Synthetic service',quantityMillis:1000,unitPriceCents:10000}],discountCents:0,taxBasisPoints:0,notes:'',status:'DRAFT',payments:[],audit:[]});
function invoices(){let book=saveInvoiceDraft(emptyInvoiceBook('company-1'),draft(),actor,at);book=issueInvoice(book,'one',actor,at);book=recordInvoicePayment(book,'one',{id:'receipt',date:'2026-10-18',reference:'SYN-RECEIPT',amountCents:2500,note:''},actor,at);book=saveInvoiceDraft(book,draft('draft'),actor,at);book=saveInvoiceDraft(book,draft('void'),actor,at);return voidInvoice(book,'void','Synthetic cancellation',actor,at);}
function payroll(){return ['one','two'].map((id,i)=>calculateGridRow({...emptyGridRow(id),name:`Synthetic ${id}`,reference:`SYN-${id}`,rate:String(50+i*10),revenue:'1000'},[],at));}
const options={companyName:'Synthetic Company',actor,at,reviewed:true,reviewReasons:{}};
test('invoice report filters finalized records and keeps drafts and voids out of receivables',()=>{
 const book=invoices(),before=structuredClone(book),rows=invoiceReportRows(book,'company-1',filter,'2026-10-18');assert.equal(rows.length,1);assert.deepEqual(invoiceReportTotals(rows),{invoiced:10000n,received:2500n,outstanding:7500n,drafts:0n});
 const all=invoiceReportRows(book,'company-1',{...filter,status:'All'},'2026-10-18');assert.equal(all.length,3);assert.equal(invoiceReportTotals(all).drafts,10000n);assert.equal(invoiceReportTotals(all).outstanding,7500n);
 for(const change of [{year:'2025'},{from:'2026-10-02'},{to:'2026-09-30'},{search:'absent'},{status:'Paid'}])assert.equal(invoiceReportRows(book,'company-1',{...filter,...change},'2026-10-18').length,0);
 assert.equal(invoiceReportRows(book,'company-1',{...filter,status:'Overdue',search:'synthetic'},'2026-10-18').length,1);assert.throws(()=>invoiceReportRows(book,'other',filter,'2026-10-18'),/company/);assert.deepEqual(book,before);
 assert.equal(reportMoney(-1n),'-$0.01');assert.equal(reportMoney(900719925474099100n),'$9,007,199,254,740,991.00');
});
test('payroll reports deduplicate approved history, exclude cross-company records and suppress invalid drafts',()=>{
 const inputs=payroll(),approval=simulateApproval(inputs,options),before=structuredClone(approval),companyId=approval.companyId;
 const withHistory=inputs.map(input=>({...input,history:[...approval.snapshots,...approval.snapshots,{...approval.snapshots[0],companyId:'other'}]}));
 const rows=payrollReportRows(companyId,withHistory,approval,true);assert.equal(rows.length,2);assert.equal(filterPayrollReport(rows,filter).length,2);assert.equal(payrollReportTotals(rows).net,110000n);assert.ok(rows.every(row=>row.status==='Approved'));
 assert.equal(payrollReportRows(companyId,inputs,null,false).length,0);const drafts=payrollReportRows(companyId,inputs,null,true);assert.equal(filterPayrollReport(drafts,filter).length,0);assert.equal(filterPayrollReport(drafts,{...filter,status:'Draft'}).length,2);
 assert.equal(payrollReportRows('other',inputs,approval,true).length,0);assert.equal(payrollReportRows(companyId,inputs,transitionDemo(approval,'MARK_PAID',actor,at),true)[0].status,'Paid');assert.deepEqual(approval,before);
});
test('selected statement downloads retain original identifiers, immutable snapshot and YTD context',()=>{
 const inputs=payroll(),approval=simulateApproval(inputs,options),rows=payrollReportRows(approval.companyId,inputs,approval,true),second=rows.find(row=>row.snapshot.contractorId==='two');const result=selectedPayrollDocuments(rows,[second.key],approval);assert.equal(result.approval,approval);assert.deepEqual(result.contractorIds,['two']);const pdf=new TextDecoder().decode(demoPdf(result.approval,result.contractorIds));assert.ok(pdf.includes(`Statement DEMO-${approval.payrollRunId}-2`));assert.ok(!pdf.includes(`Statement DEMO-${approval.payrollRunId}-1`));assert.ok(pdf.includes('Synthetic two'));assert.ok(!pdf.includes('Synthetic one'));
 assert.throws(()=>selectedPayrollDocuments(rows.map(row=>({...row,current:false})),[second.key],approval),/Historical/);assert.throws(()=>selectedPayrollDocuments(rows,[second.key],null),/Select/);assert.throws(()=>demoPdf(approval,['unknown']),/Select/);
});
test('invoice bundle preserves individual invoice pages and rejects draft, void or mixed-company selection',()=>{
 const book=invoices(),rows=invoiceReportRows(book,'company-1',filter,'2026-10-18');assert.equal(selectedInvoiceDocuments(rows,['one'])[0].number,'SYN-one');assert.throws(()=>selectedInvoiceDocuments(book.invoices,['draft']),/finalized/);assert.throws(()=>invoiceBatchPdf([book.invoices.find(row=>row.id==='draft')],'2026-10-18'),/finalized/);
 let second=issueInvoice(saveInvoiceDraft(emptyInvoiceBook('company-1'),draft('two'),actor,at),'two',actor,at).invoices[0];const pdf=new TextDecoder().decode(invoiceBatchPdf([rows[0],second],'2026-10-18'));assert.match(pdf,/\/Count 2/);assert.match(pdf,/Invoice SYN-one/);assert.match(pdf,/Invoice SYN-two/);assert.throws(()=>invoiceBatchPdf([rows[0],{...second,companyId:'other'}],'2026-10-18'),/company/);
});
test('summary PDFs paginate with repeated identity and fonts; CSV escapes formula input',()=>{
 const doc={companyName:'Synthetic Company',title:'Invoice summary',filterLabel:'2026 | Finalized',columns:['Invoice','Total'],rows:Array.from({length:80},(_,i)=>[`SYN-${i}`,'-$1.00']),totals:[['Net','-$80.00']]};const bytes=reportPdf(doc),pdf=new TextDecoder().decode(bytes);assert.ok(Number(pdf.match(/\/Count (\d+)/)[1])>1);assert.match(pdf,/ETL GIS Consulting LLC/);assert.match(pdf,/FontFile2/);assert.match(pdf,/-\$80.00/);assert.ok(pdf.includes(`startxref\n${pdf.indexOf('xref\n')}`));assert.deepEqual(bytes,reportPdf(doc));assert.throws(()=>reportPdf({...doc,rows:[]}),/valid/);assert.match(reportCsv([['=SUM(A1)',' +cmd','normal, "quoted"']]),/"'=SUM\(A1\)"/);assert.match(reportCsv([['a"b']]),/"a""b"/);
});

test('invoice CSV exposes stable join keys, separate invoice numbers and exact cents without mixed summary rows',async()=>{
 const {invoiceReportCsv}=await import('../lib/reports.ts');const book=invoices(),rows=invoiceReportRows(book,'company-1',filter,'2026-10-18'),before=JSON.stringify(book),csv=invoiceReportCsv('company-1','Synthetic Company',rows,'2026-10-18');
 assert.ok(csv.startsWith('"Company ID","Invoice ID","Invoice number"'));assert.equal(csv.trim().split('\r\n').length,2);assert.match(csv,/"company-1","one","SYN-one"/);assert.match(csv,/"10000","2500","7500"/);assert.equal(JSON.stringify(book),before);
 assert.throws(()=>invoiceReportCsv('foreign','Synthetic Company',rows,'2026-10-18'),/company/);assert.throws(()=>invoiceReportCsv('company-1','Synthetic Company',book.invoices,'2026-10-18'),/finalized/);
});
