import { safeCents, yearToDate } from "./settlements.ts";
import type { Settlement, History } from "./settlements.ts";
export const workbookDeductionGroups = [
 {label:"Driver / contractor advance",categories:["CASH_ADVANCE"]},
 {label:"Escrow",categories:["ESCROW","ESCROW_DEDUCTION"]},
 {label:"Insurance",categories:["INSURANCE","INSURANCE_DEDUCTION"]},
 {label:"Fuel",categories:["FUEL","FUEL_DEDUCTION"]},
 {label:"Truck registration",categories:["TRUCK_REGISTRATION","TRUCK_REGISTRATION_DEDUCTION"]},
 {label:"Trailer registration",categories:["TRAILER_REGISTRATION","TRAILER_REGISTRATION_DEDUCTION"]},
 {label:"Registration (unspecified)",categories:["REGISTRATION","REGISTRATION_DEDUCTION"]},
 {label:"IFTA",categories:["IFTA","IFTA_DEDUCTION"]},
 {label:"Factoring",categories:["FACTORING","FACTORING_DEDUCTION"]},
 {label:"Maintenance",categories:["MAINTENANCE","MAINTENANCE_DEDUCTION"]},
 {label:"Administrative fee",categories:["ADMIN_FEE"]},
] as const;
const sum=(values:number[])=>safeCents(values.reduce((total,value)=>total+BigInt(value),BigInt(0)));
export function workbookStatement(settlement:Settlement,history:History=[]){
 const known=new Set<string>(workbookDeductionGroups.flatMap(group=>[...group.categories]));
 const deductions=settlement.lines.filter(line=>line.kind==="DEDUCTION");
 const deductionDetails=deductions.map(line=>{
  const transaction=settlement.calculationSnapshot.transactions.find(tx=>line.sourceId===`transaction:${tx.id}`);
  const rule=settlement.calculationSnapshot.deductionRules.find(rule=>rule.id===line.ruleId);
  return {...line,description:transaction?.description??rule?.description??line.description,explanation:line.origin==="AUTOMATIC"?line.description:undefined,date:transaction?.transactionDate,reference:transaction?.referenceNumber};
 });
 const groups=[...workbookDeductionGroups.map(group=>({label:group.label,amountCents:sum(deductions.filter(line=>(group.categories as readonly string[]).includes(line.category)).map(line=>line.amountCents))})),{label:"Other deductions",amountCents:sum(deductions.filter(line=>!known.has(line.category)).map(line=>line.amountCents))}];
 const fuelEntries=settlement.calculationSnapshot.transactions.filter(tx=>tx.transactionType==="FUEL_DEDUCTION");
 const fuelDetailCents=sum(fuelEntries.map(tx=>tx.amountCents));
 const expectedFuelCents=settlement.calculationSnapshot.fuelReconciliation?.expectedTotalCents;
 return {deductionDetails,groups:groups.map(group=>({...group,details:deductionDetails.filter(line=>{const categories=workbookDeductionGroups.find(item=>item.label===group.label)?.categories;return categories?(categories as readonly string[]).includes(line.category):!known.has(line.category);})})),totalDeductionsCents:sum(groups.map(group=>group.amountCents)),fuelEntries,fuelDetailCents,expectedFuelCents,fuelMatches:expectedFuelCents===undefined?null:expectedFuelCents===fuelDetailCents,ytd:yearToDate(history,settlement.companyId,settlement.contractorId,settlement.end),loads:settlement.calculationSnapshot.loads,netCents:settlement.netSettlementCents};
}
