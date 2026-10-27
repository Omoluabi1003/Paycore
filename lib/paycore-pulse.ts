import type { ContractorReadiness } from "./payroll-readiness.ts";

export type PulseSeverity="BLOCKER"|"REVIEW";
export type PulseAction={id:string;contractorId:string;contractor:string;reference:string;code:string;message:string;severity:PulseSeverity};
export type PayCorePulse={score:number;state:"READY"|"ATTENTION"|"BLOCKED"|"EMPTY";headline:string;summary:string;blockers:number;reviews:number;actions:PulseAction[]};

export function buildPayCorePulse(contractors:ContractorReadiness[]):PayCorePulse{
 if(!contractors.length)return {score:0,state:"EMPTY",headline:"Payroll has not started",summary:"Add a contractor to begin readiness checks.",blockers:0,reviews:0,actions:[]};
 const actions=contractors.flatMap(person=>person.issues.filter(issue=>!issue.reason).map((issue,index)=>({id:`${person.id}:${issue.code}:${index}`,contractorId:person.id,contractor:person.name,reference:person.reference,code:issue.code,message:issue.message,severity:(issue.blocking?"BLOCKER":"REVIEW") as PulseSeverity})));
 const blockers=actions.filter(action=>action.severity==="BLOCKER").length;
 const reviews=actions.filter(action=>action.severity==="REVIEW").length;
 const ready=contractors.filter(person=>person.status==="READY"||["APPROVED","PAID","LOCKED"].includes(person.status)).length;
 const score=Math.round(ready/contractors.length*100);
 if(blockers)return {score,state:"BLOCKED",headline:"Payroll is not safe to run yet",summary:`${blockers} blocking ${blockers===1?"issue":"issues"} must be resolved before approval.`,blockers,reviews,actions};
 if(reviews)return {score,state:"ATTENTION",headline:"Payroll needs human review",summary:`${reviews} ${reviews===1?"item":"items"} need confirmation before approval.`,blockers,reviews,actions};
 return {score:100,state:"READY",headline:"Payroll is calculation-ready",summary:"No calculation blockers or unresolved warnings were detected. Human review and approval are still required.",blockers,reviews,actions};
}
