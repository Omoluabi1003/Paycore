import { brandPdfImageObject, brandPdfMaskObject, drawBrandMark } from "./brand-pdf-image.ts";
import {statementFont,statementFontBase64} from "./pdf-fonts/tr-century-gothic-italic.ts";
import {statementBoldFont,statementBoldFontBase64} from "./pdf-fonts/century-gothic-bold-italic.ts";
import {invoiceBalance,invoiceMoney,invoiceStatus,lineAmount,decimalAmount,validateInvoiceBook} from "./invoices.ts";
import type {Invoice} from "./invoices.ts";
const ascii=(value:string)=>value.replace(/[\r\n\t]/g," ").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7e]/g,"?");
const escape=(value:string)=>ascii(value).replace(/[\\()]/g,"\\$&");
const width=(value:string,size:number,bold=false)=>[...ascii(value)].reduce((n,c)=>n+(bold?statementBoldFont:statementFont).widths[c as keyof typeof statementFont.widths]*size/1000,0);
const wrap=(value:string,limit:number,size:number,bold=false)=>{const lines:string[]=[];let line="";for(const word of ascii(value).split(/\s+/)){if(line&&width(line+" "+word,size,bold)>limit){lines.push(line+" ");line="";}for(const c of (line?" ":"")+word){if(width(line+c,size,bold)>limit){lines.push(line);line="";}line+=c;}}if(line||!lines.length)lines.push(line);return lines;};
export function invoicePdf(invoice:Invoice,today:string):Uint8Array{return renderInvoices([invoice],today);}
export function invoiceBatchPdf(invoices:Invoice[],today:string):Uint8Array{
 if(!invoices.length||invoices.length>50||invoices.some(invoice=>invoice.status!=="ISSUED")||new Set(invoices.map(invoice=>invoice.companyId)).size!==1)throw Error("Select 1–50 finalized invoices from one company.");
 validateInvoiceBook({version:1,companyId:invoices[0].companyId,invoices},invoices[0].companyId);
 return renderInvoices(invoices,today);
}
function renderInvoices(invoices:Invoice[],today:string):Uint8Array{
 const pages:string[][]=[];let page:string[]=[],y=0;
 const text=(x:number,y:number,size:number,value:string,bold=false)=>`BT /${bold?"F2":"F1"} ${size} Tf ${x} ${y} Td (${escape(value)}) Tj ET`;
 for(const invoice of invoices){
 validateInvoiceBook({version:1,companyId:invoice.companyId,invoices:[invoice]},invoice.companyId);
 const next=()=>{
  page=[];pages.push(page);
  const heading=wrap(invoice.issuer,204,12,true),contact=invoice.issuerAddress.split(/[\n|]/).flatMap(part=>wrap(part.trim(),204,9)).filter(Boolean);
  const height=Math.max(82,16+heading.length*15+contact.length*12),bottom=760-height;
  page.push(`0.96 0.98 0.99 rg 28 ${bottom} 556 ${height} re f`, `0.86 0.92 0.97 rg 30 ${bottom+6} 220 ${height-12} re f 0.45 0.58 0.65 RG 30 ${bottom+6} 220 ${height-12} re S 0 0 0 rg`);
  let cy=743;for(const line of heading){page.push(text(38,cy,12,line,true));cy-=15;}for(const line of contact){page.push(text(38,cy,9,line));cy-=12;}
  page.push("0.05 0.48 0.62 RG 1.5 w",`28 760 m 584 760 l S 28 ${bottom} m 584 ${bottom} l S 0 0 0 rg`);
  page.push(drawBrandMark(450,704,42));
  page.push(text(499,716,15,"PayCore",true));
  y=bottom-25;
  for(const part of wrap(`INVOICE # : ${invoice.number}`,548,12,true)){page.push(text(30,y,12,part,true));y-=16;}y-=4;
  page.push(text(30,y,9,`Date: ${invoice.issuedOn}`));y-=22;
 };
 const row=(label:string,value="",bold=false)=>{const lines=wrap(label,value?340:548,9,bold);for(const [i,line] of lines.entries()){if(y<78)next();if(bold&&i===0)page.push(label==="TOTAL COST"?`0.03 0.48 0.62 rg 28 ${y-4} 556 17 re f 1 1 1 rg`:`0.88 0.94 0.97 rg 28 ${y-4} 556 17 re f 0 0 0 rg`);page.push(text(30,y,9,line,bold));if(i===0&&value)page.push(text(580-width(value,9,bold),y,9,value,bold));page.push("0 0 0 rg");y-=15;}y-=4;};
 const chargeHeader=()=>{if(y<105)next();page.push(`0.03 0.48 0.62 rg 28 ${y-5} 556 21 re f 1 1 1 rg`,text(38,y,10,"ITEM DESCRIPTION",true),text(405,y,10,"AMOUNT",true),"0 0 0 rg");y-=7;};
 next();
 const left=["BILL TO:",invoice.customer,invoice.billingAddress,invoice.customerEmail,invoice.customerPhone?`Phone: ${invoice.customerPhone}`:"",invoice.customerFax?`Fax: ${invoice.customerFax}`:""].filter(Boolean).flatMap(value=>value.split('\n').flatMap(part=>wrap(part,272,9)));
 const right=["FOR:",invoice.issuer,invoice.factoringName,invoice.factoringAddress,invoice.factoringContact].filter((value):value is string=>Boolean(value)).flatMap(value=>value.split('\n').flatMap(part=>wrap(part,226,9)));
 // Draw both independent party columns at the same height; long entries continue safely.
 for(let i=0;i<Math.max(left.length,right.length);i++){if(y<88)next();if(left[i])page.push(text(30,y,9,left[i],i<2));if(right[i])page.push(text(350,y,9,right[i],i<2||right[i]===invoice.factoringName));y-=14;}y-=18;
 chargeHeader();
 for(const line of invoice.lines){
  const details:{value:string;bold:boolean;indent:number}[]=[];
  const add=(value:string,bold=false,indent=0)=>{for(const part of value.split('\n'))for(const fragment of wrap(part,326-indent,9,bold))details.push({value:fragment,bold,indent});};
  if(line.loadReference)add(`For the Load #: ${line.loadReference}`,true);
  add(line.description);
  if(line.pickupName||line.pickupAddress){add('');add(`From: ${line.pickupName??""}`,true,30);if(line.pickupAddress)add(line.pickupAddress,false,30);}
  if(line.deliveryName||line.deliveryAddress){add('');add(`To: ${line.deliveryName??""}`,true,30);if(line.deliveryAddress)add(line.deliveryAddress,false,30);}
  add(`${decimalAmount(line.quantityMillis,3)} x ${invoiceMoney(line.unitPriceCents)} per unit`);
  let cursor=0,amountPrinted=false;
  while(cursor<details.length){if(y<115){next();chargeHeader();}const available=Math.floor((y-80)/14),count=Math.min(available,details.length-cursor),height=Math.min(y-80,Math.max(count*14+12,(line.pickupAddress||line.deliveryAddress)?130:50));
   page.push(`0.86 0.92 0.97 rg 28 ${y-height} 352 ${height} re f 0.96 0.98 0.99 rg 380 ${y-height} 204 ${height} re f 0.62 0.73 0.78 RG 0.5 w 28 ${y-height} 556 ${height} re S 380 ${y-height} m 380 ${y} l S 0 0 0 rg`);
   for(let n=0;n<count;n++){const detail=details[cursor+n];page.push(text(38+detail.indent,y-14-n*14,9,detail.value,detail.bold));}
   if(!amountPrinted){page.push(text(405,y-height/2,10,invoiceMoney(lineAmount(line))));amountPrinted=true;}
   cursor+=count;y-=height;
  }
 }
 y-=18;
 const balance=invoiceBalance(invoice);row("Subtotal",invoiceMoney(balance.total.subtotalCents));row("Discount",invoiceMoney(balance.total.discountCents));row(`Tax rate (${decimalAmount(invoice.taxBasisPoints)}%)`,invoiceMoney(balance.total.taxCents));row(invoice.additionalCostsDescription?`Additional costs: ${invoice.additionalCostsDescription}`:"Additional costs",invoiceMoney(invoice.additionalCostsCents??0));row("TOTAL COST",invoiceMoney(balance.total.totalCents),true);
 if(balance.paidCents||invoice.payments.length){row("Recorded received (net of reversals)",invoiceMoney(balance.paidCents));row(invoice.status==="VOID"?"ORIGINAL BALANCE (VOID - DO NOT PAY)":"BALANCE DUE",invoiceMoney(balance.balanceCents),true);}
 if(invoice.factoringName)row(`Make all checks payable to ${invoice.factoringName}.`,"",true);
 if(invoice.paymentInstructions){row("PAYMENT INSTRUCTIONS","",true);row(invoice.paymentInstructions);}if(invoice.billingContact)row(`Invoice contact: ${invoice.billingContact}`);if(invoice.notes){row("NOTES","",true);row(invoice.notes);}if(invoice.payments.length){row("RECORDED PAYMENTS - NO FUNDS MOVED","",true);for(const payment of invoice.payments){const reversal=invoice.paymentReversals.find(reversal=>reversal.paymentId===payment.id);row(`${payment.date} | ${payment.reference}${reversal?" | REVERSED - not counted":""}`,invoiceMoney(payment.amountCents));if(payment.note)row(payment.note);if(reversal)row(`Record correction: ${reversal.reason} | ${reversal.at}`);}}
 row("THANK YOU FOR YOUR BUSINESS!");row(`Invoice ${invoice.number} | ${invoiceStatus(invoice,today)} | USD`);if(invoice.status==="VOID")row("VOID - DO NOT PAY","",true);row("INVOICE | No email sent or payment processed by PayCore.");
 }
 const descriptor=5+pages.length*2;
 const brandObject=descriptor+4;
 const fontObject=(font:typeof statementFont,id:number)=>`<< /Type /Font /Subtype /TrueType /BaseFont /${font.postscriptName} /FirstChar 32 /LastChar 126 /Widths [${Array.from({length:95},(_,i)=>font.widths[String.fromCharCode(i+32) as keyof typeof font.widths]).join(" ")}] /Encoding /WinAnsiEncoding /FontDescriptor ${id} 0 R >>`;
 const objects=["<< /Type /Catalog /Pages 2 0 R >>",`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${5+i*2} 0 R`).join(" ")}] >>`,fontObject(statementFont,descriptor),fontObject(statementBoldFont,descriptor+2)];
 for(const [i,content] of pages.entries()){content.push(text(28,34,8,"Developed by ETL GIS Consulting LLC",true),text(28,22,7,`Saved on this device | Page ${i+1} of ${pages.length}`));const stream=content.join("\n");objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /PayCoreMark ${brandObject} 0 R >> /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6+i*2} 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);}
 for(const [font,data] of [[statementFont,statementFontBase64],[statementBoldFont,statementBoldFontBase64]] as const){const hex=[...atob(data)].map(c=>c.charCodeAt(0).toString(16).padStart(2,"0")).join("")+">";objects.push(`<< /Type /FontDescriptor /FontName /${font.postscriptName} /Flags 96 /FontBBox [${font.bbox.join(" ")}] /ItalicAngle ${font.italicAngle} /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV 80 /FontFile2 ${objects.length+2} 0 R >>`,`<< /Length ${hex.length} /Length1 ${font.byteLength} /Filter /ASCIIHexDecode >>\nstream\n${hex}\nendstream`);}
 objects.push(brandPdfImageObject(brandObject + 1), brandPdfMaskObject());
 let pdf="%PDF-1.4\n";const offsets:number[]=[];objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(n=>`${String(n).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new TextEncoder().encode(pdf);
}
