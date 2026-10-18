import {z} from "zod";
const id=z.string().trim().min(1).max(128);
const text=z.string().trim().max(240);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,"Enter a valid date.");
const cents=z.number().int().safe().nonnegative();
const lineSchema=z.object({id,loadReference:text.optional(),pickupName:text.optional(),pickupAddress:text.optional(),deliveryName:text.optional(),deliveryAddress:text.optional(),description:text.min(1),quantityMillis:z.number().int().safe().positive(),unitPriceCents:cents});
const totalsSchema=z.object({subtotalCents:cents,discountCents:cents,taxCents:cents,totalCents:cents});
const reversalSchema=z.object({id,paymentId:id,at:z.string().datetime(),actor:id,reason:text.min(1)});
const invoiceSchema=z.object({id,companyId:id,number:id,issuer:text.min(1),issuerAddress:text,customer:text.min(1),customerEmail:z.union([z.literal(""),z.string().trim().email().max(120)]),billingAddress:text,customerPhone:text.optional(),customerFax:text.optional(),issuedOn:date,dueOn:date,currency:z.literal("USD"),lines:z.array(lineSchema).min(1).max(100),discountCents:cents,taxBasisPoints:z.number().int().min(0).max(10000),additionalCostsCents:cents.optional(),additionalCostsDescription:text.optional(),paymentInstructions:z.string().trim().max(600).optional(),billingContact:text.optional(),factoringName:text.optional(),factoringAddress:z.string().trim().max(600).optional(),factoringContact:text.optional(),notes:z.string().trim().max(1000),status:z.enum(["DRAFT","ISSUED","VOID"]),paymentReversals:z.array(reversalSchema).max(200).default([]),totals:totalsSchema.optional(),payments:z.array(z.object({id,date,reference:id,amountCents:cents.positive(),note:text})).max(200),audit:z.array(z.object({at:z.string().datetime(),actor:id,action:id,reason:text.optional()})).max(600)});
export type Invoice=z.infer<typeof invoiceSchema>;
export type InvoiceLine=z.infer<typeof lineSchema>;
export type InvoiceBook={version:1;companyId:string;invoices:Invoice[]};
function freeze<T>(value:T):T{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const checked=(value:bigint)=>{if(value<BigInt(0)||value>BigInt(Number.MAX_SAFE_INTEGER))throw Error("Amount exceeds the supported range.");return Number(value);};
const round=(numerator:bigint,denominator:bigint)=>checked((numerator+denominator/BigInt(2))/denominator);
export function parseInvoiceAmount(value:string,places=2){if(!new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(value))throw Error(`Enter a nonnegative number with up to ${places} decimal places.`);const [whole,fraction=""]=value.split(".");return checked(BigInt(whole)*BigInt(10)**BigInt(places)+BigInt(fraction.padEnd(places,"0")));}
export const decimalAmount=(value:number,places=2)=>{const scale=BigInt(10)**BigInt(places),n=BigInt(value);return `${n/scale}.${String(n%scale).padStart(places,"0")}`;};
export const invoiceMoney=(value:number)=>{const n=BigInt(value);return `$${(n/BigInt(100)).toLocaleString("en-US")}.${String(n%BigInt(100)).padStart(2,"0")}`;};
export function lineAmount(line:InvoiceLine){lineSchema.parse(line);return round(BigInt(line.quantityMillis)*BigInt(line.unitPriceCents),BigInt(1000));}
export function calculateInvoice(invoice:Pick<Invoice,"lines"|"discountCents"|"taxBasisPoints"|"additionalCostsCents"|"additionalCostsDescription">){
 z.object({lines:z.array(lineSchema).min(1).max(100),discountCents:cents,taxBasisPoints:z.number().int().min(0).max(10000),additionalCostsCents:cents.optional(),additionalCostsDescription:text.optional()}).parse(invoice);
 if((invoice.additionalCostsCents??0)>0&&!invoice.additionalCostsDescription?.trim())throw Error("Describe the additional costs before saving.");
 const subtotalCents=checked(invoice.lines.reduce((sum,line)=>sum+BigInt(lineAmount(line)),BigInt(0)));
 if(invoice.discountCents>subtotalCents)throw Error("Discount cannot exceed the subtotal.");
 const taxable=BigInt(subtotalCents-invoice.discountCents),taxCents=round(taxable*BigInt(invoice.taxBasisPoints),BigInt(10000));
 return {subtotalCents,discountCents:invoice.discountCents,taxCents,totalCents:checked(taxable+BigInt(taxCents)+BigInt(invoice.additionalCostsCents??0))};
}
const key=(value:string)=>value.trim().toUpperCase().replace(/\s+/g,"");
export function invoiceBalance(invoice:Invoice){const total=invoice.totals??calculateInvoice(invoice),paid=checked(invoice.payments.filter(payment=>!invoice.paymentReversals?.some(reversal=>reversal.paymentId===payment.id)).reduce((sum,payment)=>sum+BigInt(payment.amountCents),BigInt(0)));if(paid>total.totalCents)throw Error("Recorded payments exceed the invoice total.");return {paidCents:paid,balanceCents:total.totalCents-paid,total};}
export function invoiceStatus(invoice:Invoice,today:string){date.parse(today);if(invoice.status!=="ISSUED")return invoice.status==="VOID"?"Void":"Draft";const balance=invoiceBalance(invoice);if(balance.balanceCents===0)return "Paid";if(invoice.dueOn<today)return "Overdue";return balance.paidCents>0?"Partially paid":"Unpaid";}
export function emptyInvoiceBook(companyId:string):InvoiceBook{return {version:1,companyId:id.parse(companyId),invoices:[]};}
export function validateInvoiceBook(raw:unknown,companyId:string):InvoiceBook{
 const book=z.object({version:z.literal(1),companyId:id,invoices:z.array(invoiceSchema).max(250)}).parse(raw);
 if(book.companyId!==companyId)throw Error("These invoices belong to another company.");
 const ids=new Set<string>(),numbers=new Set<string>();
 for(const invoice of book.invoices){if(invoice.companyId!==companyId||ids.has(invoice.id)||numbers.has(key(invoice.number)))throw Error("Invoice identity is duplicated or belongs to another company.");ids.add(invoice.id);numbers.add(key(invoice.number));
  if(invoice.dueOn<invoice.issuedOn)throw Error("Due date cannot precede the invoice date.");if(new Set(invoice.lines.map(line=>line.id)).size!==invoice.lines.length)throw Error("Line items are duplicated.");
  const calculated=calculateInvoice(invoice);if(invoice.status!=="DRAFT"&&(!invoice.totals||Object.keys(calculated).some(field=>calculated[field as keyof typeof calculated]!==invoice.totals![field as keyof typeof calculated])))throw Error("The finalized invoice totals do not match its lines.");
  if(invoice.status==="DRAFT"&&(invoice.payments.length||invoice.paymentReversals.length)||invoice.status==="VOID"&&invoiceBalance(invoice).paidCents>0)throw Error("Payments require an issued invoice.");
  const paymentIds=new Set<string>(),references=new Set<string>();for(const payment of invoice.payments){if(paymentIds.has(payment.id)||(!invoice.paymentReversals.some(reversal=>reversal.paymentId===payment.id)&&references.has(key(payment.reference)))||payment.date<invoice.issuedOn)throw Error("A payment is duplicated or has an invalid date.");paymentIds.add(payment.id);if(!invoice.paymentReversals.some(reversal=>reversal.paymentId===payment.id))references.add(key(payment.reference));}
  const reversed=new Set<string>(),reversalIds=new Set<string>();for(const reversal of invoice.paymentReversals){if(!paymentIds.has(reversal.paymentId)||reversed.has(reversal.paymentId)||reversalIds.has(reversal.id)||reversal.at.slice(0,10)<invoice.payments.find(payment=>payment.id===reversal.paymentId)!.date)throw Error("Payment reversal evidence is invalid or duplicated.");reversed.add(reversal.paymentId);reversalIds.add(reversal.id);}
  for(let i=1;i<invoice.audit.length;i++)if(Date.parse(invoice.audit[i].at)<Date.parse(invoice.audit[i-1].at))throw Error("Invoice activity time cannot precede the previous event.");
  invoiceBalance(invoice);
 }return freeze(book);
}
const command=(actor:string,at:string)=>{id.parse(actor);z.string().datetime().parse(at);return {actor,at};};
function replace(book:InvoiceBook,invoice:Invoice){const next={...book,invoices:book.invoices.some(item=>item.id===invoice.id)?book.invoices.map(item=>item.id===invoice.id?invoice:item):[invoice,...book.invoices]};return validateInvoiceBook(next,book.companyId);}
/** Company-local display sequence. Saved drafts and void records retain their numbers. */
export function nextInvoiceNumber(book:InvoiceBook,createdOn:string):string{
 validateInvoiceBook(book,book.companyId);date.parse(createdOn);let highest=BigInt(0);
 for(const invoice of book.invoices){const match=/^INV-\d{4}-(\d+)$/.exec(key(invoice.number));if(match){const sequence=BigInt(match[1]);if(sequence>highest)highest=sequence;}}
 const next=checked(highest+BigInt(1));return `INV-${createdOn.slice(0,4)}-${String(next).padStart(6,"0")}`;
}
/** Allocate against the latest saved book, not a stale editor preview. UUID remains the join key. */
export function saveAutomaticInvoiceDraft(book:InvoiceBook,raw:Invoice,actor:string,at:string){
 command(actor,at);const existing=book.invoices.find(invoice=>invoice.id===raw.id);
 return saveInvoiceDraft(book,{...raw,number:existing?.number??nextInvoiceNumber(book,at.slice(0,10))},actor,at);
}
export function saveInvoiceDraft(book:InvoiceBook,raw:Invoice,actor:string,at:string){validateInvoiceBook(book,book.companyId);const invoice=invoiceSchema.parse(raw),existing=book.invoices.find(item=>item.id===invoice.id);if(existing&&existing.status!=="DRAFT")throw Error("Finalized invoices cannot be edited. Void an unpaid invoice and create a replacement.");if(existing&&invoice.number!==existing.number)throw Error("An invoice number cannot be changed.");if(invoice.status!=="DRAFT"||invoice.payments.length||invoice.paymentReversals.length||invoice.companyId!==book.companyId)throw Error("Save a draft in this company.");return replace(book,{...invoice,totals:undefined,audit:[...(existing?.audit??[]),{...command(actor,at),action:"Draft saved"}]});}
export function issueInvoice(book:InvoiceBook,id:string,actor:string,at:string){validateInvoiceBook(book,book.companyId);const invoice=book.invoices.find(item=>item.id===id);if(!invoice)throw Error("Save the draft first.");if(invoice.status==="ISSUED")return book;if(invoice.status!=="DRAFT")throw Error("A void invoice cannot be issued.");const totals=calculateInvoice(invoice);if(totals.totalCents===0)throw Error("An issued invoice must have a positive total.");return replace(book,{...invoice,status:"ISSUED",totals,audit:[...invoice.audit,{...command(actor,at),action:"Invoice finalized; figures frozen"}]});}
export function recordInvoicePayment(book:InvoiceBook,id:string,payment:Invoice["payments"][number],actor:string,at:string){validateInvoiceBook(book,book.companyId);const invoice=book.invoices.find(item=>item.id===id);if(!invoice||invoice.status!=="ISSUED")throw Error("Only issued invoices accept payment records.");const existing=invoice.payments.find(item=>item.id===payment.id);if(existing){if((["id","date","reference","amountCents","note"] as const).every(key=>existing[key]===payment[key]))return book;throw Error("This payment identifier was already used.");}const event=command(actor,at);if(payment.date>event.at.slice(0,10))throw Error("Do not record a future payment as received.");return replace(book,{...invoice,payments:[...invoice.payments,payment],audit:[...invoice.audit,{...event,action:"Payment recorded manually",reason:payment.reference}]});}
export function voidInvoice(book:InvoiceBook,id:string,reason:string,actor:string,at:string){validateInvoiceBook(book,book.companyId);const invoice=book.invoices.find(item=>item.id===id);if(!invoice)throw Error("Invoice not found.");if(!reason.trim())throw Error("Enter a reason for voiding this invoice.");if(invoiceBalance(invoice).paidCents>0)throw Error("An invoice with active payment records cannot be voided here.");if(invoice.status==="VOID")return book;return replace(book,{...invoice,status:"VOID",totals:calculateInvoice(invoice),audit:[...invoice.audit,{...command(actor,at),action:"Invoice voided",reason:text.min(1).parse(reason)}]});}
export const invoiceStorageKey=(scope:string)=>`paycore-demo-invoices-v1:${encodeURIComponent(scope)}`;
export function decodeInvoiceBook(value:string,scope:string,companyId:string){if(value.length>3_000_000)throw Error("Saved invoices exceed the demo limit.");const raw=JSON.parse(value);if(raw.scope!==scope)throw Error("These invoices belong to another display profile.");return validateInvoiceBook(raw.book,companyId);}
export function encodeInvoiceBook(book:InvoiceBook,scope:string){const value=JSON.stringify({scope,book:validateInvoiceBook(book,book.companyId)});if(value.length>3_000_000)throw Error("Invoice storage exceeds the demo limit.");return value;}

export function reverseInvoicePayment(book:InvoiceBook,invoiceId:string,paymentId:string,reason:string,actor:string,at:string){
 validateInvoiceBook(book,book.companyId);const invoice=book.invoices.find(item=>item.id===invoiceId);if(!invoice||invoice.status!=="ISSUED")throw Error("Only issued invoice receipts can be reversed.");
 if(!invoice.payments.some(payment=>payment.id===paymentId))throw Error("Payment record not found.");text.min(1).parse(reason);
 const previous=invoice.paymentReversals.find(reversal=>reversal.paymentId===paymentId);if(previous){if(previous.reason===reason.trim())return book;throw Error("This payment record was already reversed.");}
 const event=command(actor,at);return replace(book,{...invoice,paymentReversals:[...invoice.paymentReversals,{id:paymentId,paymentId,reason:reason.trim(),...event}],audit:[...invoice.audit,{...event,action:"Payment record reversed; no funds moved",reason:reason.trim()}]});
}
