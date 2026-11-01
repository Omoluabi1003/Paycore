import type {Invoice} from "./invoices.ts";
export const isFreightInvoice=(invoice:Pick<Invoice,'lines'>)=>invoice.lines.some(line=>Boolean(line.loadReference||line.pickupName||line.pickupAddress||line.deliveryName||line.deliveryAddress));
export function invoicePaperworkIssues(invoice:Pick<Invoice,'lines'|'issuerAddress'|'factoringName'|'factoringAddress'>){
 if(!isFreightInvoice(invoice))return [];
 const missing:string[]=[];
 if(!invoice.issuerAddress.trim())missing.push('company letterhead address');
 if(!invoice.factoringName?.trim())missing.push('factoring company name');
 if(!invoice.factoringAddress?.trim())missing.push('factoring company address');
 return missing;
}
export function assertInvoicePaperworkReady(invoice:Parameters<typeof invoicePaperworkIssues>[0]){const missing=invoicePaperworkIssues(invoice);if(missing.length)throw Error(`Complete company setup before finalizing or downloading: ${missing.join(', ')}.`);}
