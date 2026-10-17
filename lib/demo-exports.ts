import type { DemoApproval } from "./demo-payroll.ts";
import { yearToDate } from "./settlements.ts";
export function exactDollars(cents: number): string {
  if(!Number.isSafeInteger(cents))throw new Error("Invalid money amount.");
  const amount=BigInt(cents),abs=amount<BigInt(0)?-amount:amount;
  return `${amount<BigInt(0)?"-":""}${abs/BigInt(100)}.${String(abs%BigInt(100)).padStart(2,"0")}`;
}
function safeCell(value: string|number) {
  const text=typeof value==="string"&&/^[\s\x00-\x1f]*[=+\-@]/.test(value)?`'${value}`:String(value);
  return `"${text.replace(/"/g,'""')}"`;
}
export function demoCsv(state: DemoApproval): string {
  const rows:(string|number)[][]=[["Demo status","Demo payment","Company","Statement ID","Contractor","Reference","Period start","Period end","Line kind","Description","Amount cents","Amount USD"]];
  state.snapshots.forEach((snapshot,index)=>{
    const prefix=[`DEMO ${state.status} - NO REAL PAYMENT`,state.paidAt?"MARKED PAID IN DEMO - NO FUNDS MOVED":"NOT MARKED PAID",state.companyName,`DEMO-${state.payrollRunId}-${index+1}`,snapshot.calculationSnapshot.contractor.displayName,snapshot.calculationSnapshot.contractor.contractorNumber,state.start,state.end];
    for(const line of snapshot.lines) rows.push([...prefix,line.kind,line.description,line.amountCents,exactDollars(line.amountCents)]);
    for(const [label,cents] of [["Eligible revenue",snapshot.grossEligibleRevenueCents],["Calculated earnings",snapshot.grossEarningsCents],["Automatic deductions",snapshot.automaticDeductionsCents],["Entered deductions",snapshot.manualDeductionsCents],["Reimbursements",snapshot.reimbursementsCents],["Adjustments",snapshot.adjustmentsCents],["Net settlement",snapshot.netSettlementCents]] as const)rows.push([...prefix,"TOTAL",label,cents,exactDollars(cents)]);
  });
  return rows.map(row=>row.map(safeCell).join(",")).join("\r\n")+"\r\n";
}
const ascii=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7e]/g,"?");
const escape=(value:string)=>ascii(value).replace(/[\\()]/g,"\\$&");
export function demoPdf(state: DemoApproval): Uint8Array {
  const pages:string[][]=[];
  state.snapshots.forEach((snapshot,index)=>{
    const contractor=snapshot.calculationSnapshot.contractor;
    const ytd=yearToDate([snapshot],snapshot.companyId,snapshot.contractorId,state.end);
    const lines=[state.companyName,`Statement DEMO-${state.payrollRunId}-${index+1}`,`Contractor: ${contractor.displayName} | ${contractor.contractorNumber}`,`Pay period: ${state.start} to ${state.end}`,`Status: DEMO ${state.status}${state.paidAt?" | Marked paid in demo":""}`,`Approved in demo by ${state.actorName} at ${state.approvedAt}`,`Compensation: ${snapshot.compensationMethod.replaceAll("_"," ")}`,`Eligible revenue: USD ${exactDollars(snapshot.grossEligibleRevenueCents)}`,"",...snapshot.lines.map(line=>`${line.kind} | ${line.description} | USD ${exactDollars(line.amountCents)}`),"",`Earnings: USD ${exactDollars(snapshot.grossEarningsCents)}`,`Automatic deductions: USD ${exactDollars(snapshot.automaticDeductionsCents)}`,`Entered deductions: USD ${exactDollars(snapshot.manualDeductionsCents)}`,`Reimbursements: USD ${exactDollars(snapshot.reimbursementsCents)}`,`Adjustments: USD ${exactDollars(snapshot.adjustmentsCents)}`,`NET SETTLEMENT: USD ${exactDollars(snapshot.netSettlementCents)}`,`Demo YTD (this exhibit period): earnings ${exactDollars(ytd.earningsCents)} / deductions ${exactDollars(ytd.deductionsCents)} / net ${exactDollars(ytd.netCents)}`,"", "SIMULATION ONLY. No payroll approved or payment executed in a live system.","Profile and payroll data stay in this tab. Use fictional details."];
    const wrapped=lines.flatMap(line=>{const clean=ascii(line);const output:string[]=[];for(let offset=0;offset<clean.length;offset+=86)output.push(clean.slice(offset,offset+86));return output.length?output:[""];});
    for(let offset=0;offset<wrapped.length;offset+=39)pages.push(wrapped.slice(offset,offset+39));
  });
  const objects:string[]=["<< /Type /Catalog /Pages 2 0 R >>",`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,index)=>`${4+index*2} 0 R`).join(" ")}] >>`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  pages.forEach((lines,index)=>{
    const text=(x:number,y:number,size:number,value:string)=>`BT /F1 ${size} Tf ${x} ${y} Td (${escape(value)}) Tj ET`;
    const content=["0.06 0.17 0.24 rg 0 704 612 88 re f","1 1 1 rg",text(42,752,24,"PayCore"),text(42,724,11,"DEMO SETTLEMENT - NO REAL PAYMENT"),"0.08 0.18 0.24 rg",...lines.map((line,i)=>text(42,680-i*15,10,line)),text(42,50,10,"Developed by ETL GIS Consulting LLC"),text(42,32,9,`Demo page ${index+1} of ${pages.length}`)].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+index*2} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  let pdf="%PDF-1.4\n";const offsets=[0];objects.forEach((object,index)=>{offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});const start=pdf.length;
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
