import type { DemoApproval } from "./demo-payroll.ts";
import { renderDemoPdf } from "./demo-statement-pdf.ts";
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
export function demoPdf(state: DemoApproval): Uint8Array {
  return renderDemoPdf(state, exactDollars);
}
