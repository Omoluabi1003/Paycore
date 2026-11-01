import {z} from "zod";
import {invoiceBalance,invoiceMoney,parseInvoiceAmount} from "./invoices.ts";
import type {Invoice,InvoiceLine} from "./invoices.ts";
export function freightLine(line:Pick<InvoiceLine,"pickupName"|"pickupAddress"|"deliveryName"|"deliveryAddress">){return Boolean(line.pickupName||line.pickupAddress||line.deliveryName||line.deliveryAddress);}
export function remittanceInstruction(invoice:Pick<Invoice,"factoringName"|"paymentInstructions">){
 const entered=invoice.paymentInstructions?.trim()??"";
 if(!invoice.factoringName?.trim())return entered;
 const canonical=`Make all checks payable to ${invoice.factoringName.trim()}.`;
 const normalize=(value:string)=>value.toUpperCase().replace(/\b(LLC|INC|LTD|CORPORATION|CORP|COMPANY)\b/g,"").replace(/[^A-Z0-9]/g,"");
 const payee=normalize(invoice.factoringName);
 const unique=entered.split(/\r?\n/).filter(line=>{
  const name=line.replace(/^\s*make\s+(?:all\s+)?checks?\s+payable\s+to\s+/i,"");
  return !(/^\s*make\s+(?:all\s+)?checks?\s+payable\s+to\s+/i.test(line)&&normalize(name)===payee);
 });
 return [canonical,...unique.filter(line=>line.trim())].join("\n");
}
export function factoringRecipient(value?:string){const parsed=z.string().trim().email().max(120).safeParse(value);return parsed.success?parsed.data:null;}
export function invoiceEmail(invoice:Invoice,recipient?:string){const address=factoringRecipient(recipient);if(!address)return null;const balance=invoiceBalance(invoice);return `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent(`Invoice ${invoice.number.replace(/[\r\n]/g," ")}`)}&body=${encodeURIComponent(`Hello ${invoice.factoringName||"Factoring team"},\n\nPlease find invoice ${invoice.number} for ${invoice.customer}. Agreed total: ${invoiceMoney(balance.total.totalCents)}. Outstanding balance: ${invoiceMoney(balance.balanceCents)}.\n\nAttach the downloaded invoice PDF before sending.\n\n${invoice.issuer}`)}`;}

export function agreedFreightLine(entry:{id:string;loadReference?:string;pickupName?:string;pickupAddress?:string;deliveryName?:string;deliveryAddress?:string;price:string}):InvoiceLine{
 for(const key of ['loadReference','pickupName','pickupAddress','deliveryName','deliveryAddress'] as const){if(!entry[key]?.trim())throw Error('Enter the load number, pickup company/address and delivery company/address.');}
 return {id:entry.id,loadReference:entry.loadReference!.trim(),pickupName:entry.pickupName!.trim(),pickupAddress:entry.pickupAddress!.trim(),deliveryName:entry.deliveryName!.trim(),deliveryAddress:entry.deliveryAddress!.trim(),description:`Load ${entry.loadReference!.trim()}`,quantityMillis:1000,unitPriceCents:parseInvoiceAmount(entry.price)};
}
