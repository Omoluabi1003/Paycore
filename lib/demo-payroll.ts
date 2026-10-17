import { prepareApproval } from "./settlements.ts";
import type { ApprovedSettlement, CalculationInput } from "./settlements.ts";
export type DemoApproval = { history?: ApprovedSettlement[]; version: 1; companyName: string; actorName: string; companyId: string; payrollRunId: string; start: string; end: string; status: "APPROVED" | "PAID" | "LOCKED"; approvedAt: string; paidAt?: string; lockedAt?: string; snapshots: ApprovedSettlement[]; balances: { contractorId: string; ruleId: string; expectedBalanceCents: number; remainingBalanceCents: number }[]; audit: { action: string; at: string; actor: string }[] };
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function identity(value: string) { if (!value.trim() || value.length > 120) throw new Error("Enter a display name of up to 120 characters."); return value.trim(); }
export function simulateApproval(inputs: CalculationInput[], options: { companyName: string; actor: string; at: string; reviewed: boolean; reviewReasons: Record<string, Record<string, string>> }): DemoApproval {
  if (!options.reviewed || !inputs.length) throw new Error("Complete preparation and acknowledge your review first.");
  const actor=identity(options.actor), companyName=identity(options.companyName);
  const first=inputs[0].run, contractors=new Set<string>(), sources=new Set<string>();
  const snapshots: ApprovedSettlement[]=[], balances: DemoApproval["balances"]=[];
  for(const input of inputs){
    if(input.run.id!==first.id || input.run.companyId!==first.companyId || input.run.start!==first.start || input.run.end!==first.end || input.run.payPeriodId!==first.payPeriodId || contractors.has(input.contractor.id)) throw new Error("Each contractor must belong to this demo payroll exactly once.");
    contractors.add(input.contractor.id);
    const prepared=prepareApproval(input,actor,options.at,options.reviewReasons[input.contractor.id]??{});
    for(const source of prepared.settlement.sourceIds){ if(sources.has(source)) throw new Error("An activity appears more than once in this payroll.");sources.add(source); }
    snapshots.push(prepared.settlement);balances.push(...prepared.balanceUpdates.map(update=>({...update,contractorId:input.contractor.id})));
  }
  const history = [...new Map(inputs.flatMap(input => input.history ?? []).map(snapshot => [`${snapshot.companyId}:${snapshot.contractorId}:${snapshot.payrollRunId}`, snapshot])).values()];
  return freeze({version:1,history:structuredClone(history),companyName,actorName:actor,companyId:first.companyId,payrollRunId:first.id,start:first.start,end:first.end,status:"APPROVED",approvedAt:options.at,snapshots:structuredClone(snapshots),balances,audit:[{action:"Simulated approval; financial snapshot frozen",at:options.at,actor}]});
}
export function transitionDemo(state: DemoApproval, action: "MARK_PAID" | "LOCK", actorName: string, at: string): DemoApproval {
  const actor=identity(actorName), timestamp=Date.parse(at);
  const previous=state.audit[state.audit.length-1];
  if(!Number.isFinite(timestamp)||timestamp<Date.parse(previous.at)) throw new Error("Choose a valid event time after the previous demo event.");
  if(state.status==="LOCKED") throw new Error("This demo payroll is locked.");
  if(action==="MARK_PAID" && state.status!=="APPROVED") throw new Error("This demo payroll has already been marked paid.");
  return freeze({...structuredClone(state),status:action==="LOCK"?"LOCKED":"PAID",...(action==="LOCK"?{lockedAt:at}:{paidAt:at}),audit:[...state.audit,{action:action==="LOCK"?"Locked in demo":"Marked paid in demo; no funds moved",at,actor}]});
}
export function demoCents(value: string): number {
  if(!/^\d+(\.\d{1,2})?$/.test(value))throw new Error("Enter a positive dollar amount with up to two decimal places.");
  const [whole,fraction=""]=value.split("."), cents=BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,"0"));
  if(cents<=BigInt(0)||cents>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("Enter a positive amount within the supported range.");
  return Number(cents);
}
export function configureDemoAdvance(input: CalculationInput, balance: string, installment: string, at: string): CalculationInput {
  if(!["DRAFT","REVIEW"].includes(input.run.status))throw new Error("Only draft demo payroll can be edited.");
  const id=`demo-advance-${input.contractor.id}`;
  return {...input,deductionRules:[...input.deductionRules.filter(rule=>rule.id!==id),{id,contractorId:input.contractor.id,active:true,effectiveFrom:input.run.start,effectiveTo:null,createdBy:"demo-specialist",createdAt:at,category:"CASH_ADVANCE",description:"Demo advance installment",calculationMethod:"INSTALLMENT",amountCents:demoCents(installment),remainingBalanceCents:demoCents(balance),frequency:"UNTIL_BALANCE_PAID"}]};
}
