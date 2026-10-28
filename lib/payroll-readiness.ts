import { previewGridRow } from "./payroll-grid.ts";
import type { GridRow } from "./payroll-grid.ts";
import { calculateContractorSettlement } from "./settlements.ts";
import type { CalculationInput, PayrollRun, Settlement } from "./settlements.ts";
import type { DemoApproval } from "./demo-payroll.ts";
export type ContractorReadiness = { id: string; name: string; reference: string; status: "READY"|"REVIEW"|"BLOCKED"|"APPROVED"|"PAID"|"LOCKED"; input?: CalculationInput; settlement?: Settlement; issues: { message: string; code: string; blocking: boolean; reason?: string }[] };
export function payrollReadiness(inputs: CalculationInput[], rows: GridRow[], run: PayrollRun, demo: DemoApproval|null) {
 const contractors:ContractorReadiness[]=rows.map(row=>{
  const common={id:row.id,name:row.name.trim()||"Unnamed contractor",reference:row.reference.trim()||"Reference needed"};
  try {
   if(rows.some(other=>other.id!==row.id&&other.reference.trim().toUpperCase()===row.reference.trim().toUpperCase()))throw new Error("Use a unique contractor reference.");
   const input=demo?inputs.find(item=>item.contractor.id===row.id):previewGridRow(row,inputs,new Date().toISOString(),run);
   if(!input)throw new Error("Complete this contractor’s entry.");
   const snapshot=demo?.snapshots.find(item=>item.contractorId===row.id);
   const settlement=snapshot??calculateContractorSettlement(input);
   const issues=[...settlement.blockers.map(issue=>({...issue,blocking:true})),...settlement.warnings.map(issue=>({...issue,blocking:false,reason:snapshot?.reviewReasons[issue.code]}))];
   const status=demo?.status??(settlement.blockers.length?"BLOCKED":settlement.warnings.length?"REVIEW":"READY");
   return {...common,status,input,settlement:settlement.blockers.length?undefined:settlement,issues};
  }catch(error){return {...common,status:"BLOCKED",issues:[{code:"INCOMPLETE_ENTRY",message:error instanceof Error?error.message:"Complete this contractor’s entry.",blocking:true}]};}
 });
 const sum=(key:"grossEligibleRevenueCents"|"grossEarningsCents"|"automaticDeductionsCents"|"manualDeductionsCents"|"reimbursementsCents"|"adjustmentsCents"|"netSettlementCents")=>{
  const cents=contractors.reduce((total,person)=>total+BigInt(person.settlement?.[key]??0),BigInt(0));
  if(cents>BigInt(Number.MAX_SAFE_INTEGER)||cents<BigInt(Number.MIN_SAFE_INTEGER))throw new RangeError("Payroll totals exceed the supported range.");
  return Number(cents);
 };
 const deductionTotal=BigInt(sum("automaticDeductionsCents"))+BigInt(sum("manualDeductionsCents"));
 if(deductionTotal>BigInt(Number.MAX_SAFE_INTEGER))throw new RangeError("Payroll deductions exceed the supported range.");
 const ready=contractors.filter(person=>person.status==="READY"||["APPROVED","PAID","LOCKED"].includes(person.status)).length;
 const review=contractors.filter(person=>person.status==="REVIEW").length,blocked=contractors.filter(person=>person.status==="BLOCKED").length;
 return {contractors,ready,review,blocked,readiness:contractors.length?Math.round(ready/contractors.length*100):0,totals:{deductions:Number(deductionTotal),revenue:sum("grossEligibleRevenueCents"),earnings:sum("grossEarningsCents"),automatic:sum("automaticDeductionsCents"),manual:sum("manualDeductionsCents"),reimbursements:sum("reimbursementsCents"),adjustments:sum("adjustmentsCents"),net:sum("netSettlementCents")}};
}
