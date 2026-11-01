import {applyInvoiceCompanyDefaults,companySetupIssues} from "./company-settings.ts";
import type {StatementHeader} from "./statement-header.ts";
import {saveInvoiceDraft,reviseInvoice,validateInvoiceBook} from "./invoices.ts";
import type {InvoiceBook} from "./invoices.ts";
import {invoicePaperworkIssues} from "./invoice-readiness.ts";
const fields=['issuer','issuerAddress','factoringName','factoringAddress','factoringContact','factoringEmail','paymentInstructions','standardFooter'] as const;
export function syncDraftCompanySettings(book:InvoiceBook,companyName:string,header:StatementHeader,actor:string,at:string){
 validateInvoiceBook(book,book.companyId);if(companySetupIssues(header).length)return book;
 let next=book;
 for(const draft of book.invoices.filter(item=>item.status==='DRAFT')){
  const updated=applyInvoiceCompanyDefaults(draft,companyName,header);
  if(fields.some(field=>updated[field]!==draft[field]))next=saveInvoiceDraft(next,updated,actor,at);
 }
 return next;
}
export function repairInvoiceCompanyDetails(book:InvoiceBook,id:string,companyName:string,header:StatementHeader,actor:string,at:string){
 validateInvoiceBook(book,book.companyId);const invoice=book.invoices.find(item=>item.id===id);if(!invoice)throw Error('Invoice not found.');
 const missing=companySetupIssues(header);if(missing.length)throw Error(`Complete company setup first: ${missing.join(', ')}.`);
 if(invoice.status==='VOID')throw Error('A void invoice cannot be repaired.');
 if(!invoicePaperworkIssues(invoice).length)return book;
 const updated=applyInvoiceCompanyDefaults(invoice,companyName,header);
 return invoice.status==='DRAFT'?saveInvoiceDraft(book,updated,actor,at):reviseInvoice(book,updated,'Completed company letterhead and remittance details from saved settings',actor,at);
}
