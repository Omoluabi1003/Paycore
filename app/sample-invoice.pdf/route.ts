import {invoicePdf} from '../../lib/invoice-pdf';
import {emptyInvoiceBook,issueInvoice,saveInvoiceDraft} from '../../lib/invoices';
// Public fictional fixture only. No request or company data enters this document.
export function GET(){
 const at='2026-11-03T12:00:00Z',actor='Sample Reviewer';
 const draft={id:'sample-invoice',companyId:'sample-company',number:'SAMPLE-100',issuer:'Sample Vendor LLC',issuerAddress:'100 Example Road\nTest City, ZZ 00000',customer:'Sample Customer',customerEmail:'customer@example.test',billingAddress:'200 Example Road',issuedOn:'2026-11-03',dueOn:'2026-11-17',currency:'USD' as const,lines:[{id:'sample-service',description:'Fictional business service',quantityMillis:1000,unitPriceCents:10000}],discountCents:0,taxBasisPoints:0,notes:'SAMPLE DOCUMENT - fictional information only.',status:'DRAFT' as const,payments:[],paymentReversals:[],audit:[]};
 const book=issueInvoice(saveInvoiceDraft(emptyInvoiceBook(draft.companyId),draft,actor,at),draft.id,actor,at);
 return new Response(Buffer.from(invoicePdf(book.invoices[0],'2026-11-03')),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="PayCore-sample-invoice.pdf"','Cache-Control':'public, max-age=3600'}});
}
