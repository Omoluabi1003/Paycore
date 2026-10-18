import {invoiceBalance,invoiceStatus,validateInvoiceBook} from "./invoices.ts";
import type {Invoice,InvoiceBook} from "./invoices.ts";
import {calculateContractorSettlement} from "./settlements.ts";
import type {CalculationInput,Settlement} from "./settlements.ts";
import type {DemoApproval} from "./demo-payroll.ts";
export type ReportFilter={year:string;from:string;to:string;status:string;search:string};
export type PayrollReportRow={key:string;snapshot:Settlement;status:"Draft"|"Approved"|"Paid"|"Locked";approvedBy?:string;approvedAt?:string;current:boolean};
export const reportKey=(snapshot:Settlement)=>JSON.stringify([snapshot.companyId,snapshot.payrollRunId,snapshot.contractorId]);
const dateMatches=(date:string,filter:ReportFilter)=>(filter.year==="All"||date.slice(0,4)===filter.year)&&(!filter.from||date>=filter.from)&&(!filter.to||date<=filter.to);
const find=(value:string,search:string)=>value.toLowerCase().includes(search.trim().toLowerCase());
export function reportMoney(cents:bigint){const abs=cents<BigInt(0)?-cents:cents;return `${cents<BigInt(0)?"-":""}$${(abs/BigInt(100)).toLocaleString("en-US")}.${String(abs%BigInt(100)).padStart(2,"0")}`;}
export function invoiceReportRows(book:InvoiceBook,companyId:string,filter:ReportFilter,today:string):Invoice[]{
 if(book.companyId!==companyId)throw Error("These invoices belong to another company.");
 return book.invoices.filter(invoice=>invoice.companyId===companyId&&dateMatches(invoice.issuedOn,filter)&&find(`${invoice.number} ${invoice.customer}`,filter.search)&&(filter.status==="All"||filter.status==="Finalized"&&invoice.status==="ISSUED"||invoiceStatus(invoice,today)===filter.status)).sort((a,b)=>b.issuedOn.localeCompare(a.issuedOn)||a.number.localeCompare(b.number));
}
export function invoiceReportTotals(invoices:Invoice[]){return invoices.reduce((totals,invoice)=>{const balance=invoiceBalance(invoice);if(invoice.status==="ISSUED"){totals.invoiced+=BigInt(balance.total.totalCents);totals.received+=BigInt(balance.paidCents);totals.outstanding+=BigInt(balance.balanceCents);}else if(invoice.status==="DRAFT")totals.drafts+=BigInt(balance.total.totalCents);return totals;},{invoiced:BigInt(0),received:BigInt(0),outstanding:BigInt(0),drafts:BigInt(0)});}
export function payrollReportRows(companyId:string,inputs:CalculationInput[],approval:DemoApproval|null,valid:boolean):PayrollReportRow[]{
 const rows=new Map<string,PayrollReportRow>();
 for(const snapshot of [...inputs.flatMap(input=>input.history??[]),...(approval?.history??[])])if(snapshot.companyId===companyId&&snapshot.status==="APPROVED"&&!rows.has(reportKey(snapshot)))rows.set(reportKey(snapshot),{key:reportKey(snapshot),snapshot,status:"Approved",approvedBy:snapshot.approvedBy,approvedAt:snapshot.approvedAt,current:false});
 if(approval?.companyId===companyId){for(const snapshot of approval.snapshots)if(snapshot.companyId===companyId)rows.set(reportKey(snapshot),{key:reportKey(snapshot),snapshot,status:approval.status==="PAID"?"Paid":approval.status==="LOCKED"?"Locked":"Approved",approvedBy:snapshot.approvedBy,approvedAt:snapshot.approvedAt,current:true});}
 else if(valid){for(const input of inputs)if(input.run.companyId===companyId&&input.contractor.companyId===companyId){const snapshot=calculateContractorSettlement(input);if(!rows.has(reportKey(snapshot)))rows.set(reportKey(snapshot),{key:reportKey(snapshot),snapshot,status:"Draft",current:true});}}
 return [...rows.values()].sort((a,b)=>b.snapshot.end.localeCompare(a.snapshot.end)||a.snapshot.calculationSnapshot.contractor.displayName.localeCompare(b.snapshot.calculationSnapshot.contractor.displayName));
}
export function filterPayrollReport(rows:PayrollReportRow[],filter:ReportFilter){return rows.filter(row=>dateMatches(row.snapshot.end,filter)&&find(`${row.snapshot.calculationSnapshot.contractor.displayName} ${row.snapshot.calculationSnapshot.contractor.contractorNumber}`,filter.search)&&(filter.status==="All"||filter.status==="Finalized"&&row.status!=="Draft"||row.status===filter.status));}
export function payrollReportTotals(rows:PayrollReportRow[]){return rows.reduce((totals,{snapshot})=>({earnings:totals.earnings+BigInt(snapshot.grossEarningsCents),deductions:totals.deductions+BigInt(snapshot.automaticDeductionsCents)+BigInt(snapshot.manualDeductionsCents),reimbursements:totals.reimbursements+BigInt(snapshot.reimbursementsCents),adjustments:totals.adjustments+BigInt(snapshot.adjustmentsCents),net:totals.net+BigInt(snapshot.netSettlementCents)}),{earnings:BigInt(0),deductions:BigInt(0),reimbursements:BigInt(0),adjustments:BigInt(0),net:BigInt(0)});}
export function selectedInvoiceDocuments(rows:Invoice[],selected:string[]){const documents=rows.filter(row=>selected.includes(row.id));if(!documents.length||documents.length>50||documents.some(row=>row.status!=="ISSUED"))throw Error("Select 1–50 finalized, non-void invoices.");if(new Set(documents.map(row=>row.companyId)).size!==1)throw Error("Select invoices from one company.");return documents;}
export function selectedPayrollDocuments(rows:PayrollReportRow[],selected:string[],approval:DemoApproval|null){
 const documents=rows.filter(row=>selected.includes(row.key));if(!approval||!documents.length||documents.length>50||documents.some(row=>row.status==="Draft"||!row.current||row.snapshot.companyId!==approval.companyId||!approval.snapshots.some(snapshot=>reportKey(snapshot)===row.key)))throw Error("Select 1–50 statements from this approved exhibit payroll. Historical document files are not retained in this exhibit.");
 // Keep the original approval/header/history so statement identifiers and YTD reproduce correctly.
 return {approval,contractorIds:documents.map(row=>row.snapshot.contractorId)};
}
const csvCell=(value:string)=>`"${(/^[\s\x00-\x1f]*[=+\-@]/.test(value)?"'":"")+value.replace(/"/g,'""')}"`;
export const reportCsv=(rows:string[][])=>rows.map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";

/** One row per finalized invoice, with stable company/invoice keys for downstream joins. */
export function invoiceReportCsv(companyId:string,companyName:string,invoices:Invoice[],today:string){
 validateInvoiceBook({version:1,companyId,invoices},companyId);
 if(!invoices.length||invoices.some(invoice=>invoice.status!=="ISSUED"))throw Error("Choose finalized non-void invoices for export.");
 return reportCsv([["Company ID","Invoice ID","Invoice number","Company","Customer","Issue date","Due date","Status","Currency","Total cents","Received cents","Balance cents","Record mode"],...invoices.map(invoice=>{const balance=invoiceBalance(invoice);return [companyId,invoice.id,invoice.number,companyName,invoice.customer,invoice.issuedOn,invoice.dueOn,invoiceStatus(invoice,today),invoice.currency,String(balance.total.totalCents),String(balance.paidCents),String(balance.balanceCents),"FICTIONAL EXHIBIT"];})]);
}
