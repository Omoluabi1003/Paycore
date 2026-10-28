import test from 'node:test';
import assert from 'node:assert/strict';
import { activateExhibitContractor, continueExhibit } from '../lib/exhibit-journey.ts';
import { simulateApproval } from '../lib/demo-payroll.ts';
import { calculateGridRow } from '../lib/payroll-grid.ts';
import { calculateContractorSettlement,yearToDate } from '../lib/settlements.ts';
import { nextPayPeriod, workingPeriod } from '../lib/pay-periods.ts';
import { encodeDraft,decodeDraft } from '../lib/demo-draft.ts';
import { demoPdf } from '../lib/demo-exports.ts';
const at='2026-10-17T12:00:00Z',schedule={version:1,start:'2026-10-05',end:'2026-10-16',timeZone:'UTC'},run=workingPeriod(schedule);
const data={name:'Synthetic Contractor',reference:'SYN-1',method:'PERCENT_OF_ELIGIBLE_REVENUE',rate:'70',insurance:'25',insuranceDescription:'Synthetic agreed insurance',advance:'150',installment:'100'};
const options={actor:'Synthetic Specialist',companyName:'Synthetic Exhibit',at,reviewed:true,reviewReasons:{}};
function first(){const result=activateExhibitContractor(data,[],run,'synthetic',at);result.row.revenue='1000';result.input=calculateGridRow(result.row,[result.input],at,run);return result;}
test('three exhibit periods retain agreements, cap final installment, stop at zero and preserve snapshots',()=>{
 const original=first(),firstApproval=simulateApproval([original.input],options),frozen=JSON.stringify(firstApproval);
 assert.equal(firstApproval.snapshots[0].netSettlementCents,57500);assert.equal(original.input.deductionRules.find(rule=>rule.category==='CASH_ADVANCE').remainingBalanceCents,15000);
 const secondRun=nextPayPeriod(schedule,run),second=continueExhibit([original.input],[original.row],firstApproval,secondRun);
 assert.equal(second.inputs[0].loads.length,0);assert.equal(second.inputs[0].transactions.length,0);assert.equal(second.rows[0].revenue,'0');assert.equal(second.inputs[0].deductionRules.find(rule=>rule.category==='CASH_ADVANCE').remainingBalanceCents,5000);
 second.rows[0].revenue='1000';second.inputs[0]=calculateGridRow(second.rows[0],second.inputs,at,secondRun);
 assert.deepEqual(calculateContractorSettlement(second.inputs[0]).blockers,[]);assert.equal(second.inputs[0].compensationRules[0].effectiveFrom,run.start);
 const secondApproval=simulateApproval(second.inputs,options);assert.equal(secondApproval.snapshots[0].netSettlementCents,62500);assert.equal(secondApproval.balances[0].remainingBalanceCents,0);
 const thirdRun=nextPayPeriod(schedule,secondRun),third=continueExhibit(second.inputs,second.rows,secondApproval,thirdRun);third.rows[0].revenue='1000';third.inputs[0]=calculateGridRow(third.rows[0],third.inputs,at,thirdRun);
 const thirdApproval=simulateApproval(third.inputs,options);assert.equal(thirdApproval.snapshots[0].netSettlementCents,67500);assert.equal(thirdApproval.snapshots[0].lines.filter(line=>line.category==='CASH_ADVANCE').length,0);
 assert.equal(yearToDate([...third.inputs[0].history,...thirdApproval.snapshots],run.companyId,'synthetic',thirdRun.end).netCents,187500);
 assert.equal(JSON.stringify(firstApproval),frozen);const pdfText=[...new TextDecoder().decode(demoPdf(thirdApproval)).matchAll(/\((.*)\) Tj/g)].map(match=>match[1]).join('');assert.ok(pdfText.includes('net 1875.00'));
 assert.notEqual(original.input.loads[0].id,second.inputs[0].loads[0].id);
});
test('one-time charges, fuel checks and selected factoring do not silently recur',()=>{
 const original=first();original.input.fuelReconciliation={expectedTotalCents:0};
 original.input.deductionRules.push({...original.input.deductionRules[0],id:'once',frequency:'ONE_TIME',amountCents:100});
 original.input.deductionRules.push({...original.input.deductionRules[0],id:'future-once',frequency:'ONE_TIME',effectiveFrom:nextPayPeriod(schedule,run).start,amountCents:200});
 original.input.deductionRules.push({...original.input.deductionRules[0],id:'selected-factor',category:'FACTORING',calculationMethod:'PERCENTAGE',rateBasisPoints:100,percentageBase:'SELECTED_LOAD_REVENUE',selectedLoadIds:[original.input.loads[0].id]});
 const approved=simulateApproval([original.input],options),next=continueExhibit([original.input],[original.row],approved,nextPayPeriod(schedule,run));
 assert.equal(next.inputs[0].deductionRules.some(rule=>rule.id==='future-once'),true);assert.equal(next.inputs[0].fuelReconciliation,undefined);assert.equal(next.inputs[0].deductionRules.some(rule=>['once','selected-factor'].includes(rule.id)),false);
 assert.deepEqual(continueExhibit([original.input],[original.row],approved,nextPayPeriod(schedule,run)),next);
 assert.throws(()=>continueExhibit([original.input],[original.row],approved,{...run,companyId:'other'}));
});
test('multi-period demo recovery retains validated history and rejects mixed-company history',()=>{
 const original=first(),approved=simulateApproval([original.input],options),nextRun=nextPayPeriod(schedule,run),next=continueExhibit([original.input],[original.row],approved,nextRun);
 const raw=encodeDraft(next,'Synthetic exhibit',nextRun,at),restored=decodeDraft(raw,'Synthetic exhibit',nextRun);
 assert.equal(restored.inputs[0].history[0].netSettlementCents,57500);assert.equal(restored.inputs[0].deductionRules.find(rule=>rule.category==='CASH_ADVANCE').remainingBalanceCents,5000);
 const foreign=JSON.parse(raw);foreign.inputs[0].history[0].companyId='other';assert.throws(()=>decodeDraft(JSON.stringify(foreign),'Synthetic exhibit',nextRun));
});
test('activation needs an explicit valid rate, unique identity and described recurring obligation',()=>{
 for(const changes of[{rate:''},{rate:'101'},{insuranceDescription:''},{installment:''}])assert.throws(()=>activateExhibitContractor({...data,...changes},[],run,'synthetic',at));
 const original=first();assert.throws(()=>activateExhibitContractor(data,[original.input],run,'other',at));
 const other=activateExhibitContractor({...data,reference:'SYN-2',rate:'60'},[original.input],run,'other',at);other.row.revenue='1000';const different=calculateGridRow(other.row,[other.input],at,run);assert.equal(calculateContractorSettlement(different).grossEarningsCents,60000);assert.equal(calculateContractorSettlement(original.input).grossEarningsCents,70000);
});
