import test from 'node:test';
import assert from 'node:assert/strict';
import { demoDraftKeys,presentationSteps } from '../lib/exhibit-controls.ts';
import { activateExhibitContractor } from '../lib/exhibit-journey.ts';
import { calculateGridRow } from '../lib/payroll-grid.ts';
import { simulateApproval } from '../lib/demo-payroll.ts';
import { demoPdf } from '../lib/demo-exports.ts';
import { workingPeriod } from '../lib/pay-periods.ts';
const at='2026-10-17T12:00:00Z',run=workingPeriod({version:1,start:'2026-10-05',end:'2026-10-16',timeZone:'UTC'});
function fixture(){const setup=activateExhibitContractor({name:'Synthetic PDF Contractor',reference:'SYN-PDF',method:'PERCENT_OF_ELIGIBLE_REVENUE',rate:'70',insurance:'25',insuranceDescription:'Synthetic described insurance',advance:'150',installment:'100'},[],run,'synthetic-pdf',at);setup.row.revenue='1000';setup.input=calculateGridRow(setup.row,[setup.input],at,run);return setup;}
test('reset key selection keeps other profiles, similarly named companies and unrelated browser data',()=>{
 const scope=JSON.stringify(['Synthetic presenter','Synthetic company']),other=JSON.stringify(['Synthetic presenter','Synthetic company 2']);
 const prefix=`paycore-demo-draft-v1:${encodeURIComponent(scope)}:`;
 const keys=[prefix+'period-one',prefix+'period-two',`paycore-demo-draft-v1:${encodeURIComponent(other)}:period-one`,'paycore-preview-pay-schedule-v1','unrelated'];
 assert.deepEqual(demoDraftKeys(keys,scope),keys.slice(0,2));assert.equal(presentationSteps.length,7);assert.match(presentationSteps[4].text,/explicit simulated approval/);
});
test('styled PDF uses frozen financial facts, described deductions, balances, YTD and attribution deterministically',()=>{
 const setup=fixture(),approved=simulateApproval([setup.input],{actor:'Synthetic presenter',companyName:'Synthetic company',at,reviewed:true,reviewReasons:{}}),before=JSON.stringify(approved);
 const bytes=demoPdf(approved),pdf=new TextDecoder().decode(bytes),text=[...pdf.matchAll(/\((.*)\) Tj/g)].map(match=>match[1]).join('');
 assert.ok(text.includes('NET SETTLEMENT: USD 575.00'));assert.ok(text.includes('Synthetic described insurance'));assert.ok(text.includes('Opening USD 150.00 | Deducted USD 100.00 | Remaining USD 50.00'));assert.ok(text.includes('net 575.00'));
 assert.ok(text.includes('Developed by ETL GIS Consulting LLC'));assert.ok(text.includes('LOADS AND ELIGIBLE REVENUE'));assert.ok(text.includes('DEDUCTIONS BY CATEGORY'));assert.ok(text.includes('not additional charges'));
 assert.deepEqual(demoPdf(approved),bytes);assert.equal(JSON.stringify(approved),before);assert.ok(pdf.includes('/Helvetica-Bold'));
 const xref=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(xref,xref+4),'xref');
});
test('long receipt details paginate with repeated period, footer and no missing descriptions',()=>{
 const setup=fixture();for(let i=0;i<70;i++)setup.input.transactions.push({id:'sample-entry-reimb-'+i,companyId:run.companyId,contractorId:setup.input.contractor.id,payPeriodId:run.payPeriodId,transactionType:'REIMBURSEMENT',referenceNumber:'SYN-'+i,description:`Synthetic receipt ${i} `+'W'.repeat(90),transactionDate:run.start,amountCents:100,miles:0,source:'MANUAL',enteredBy:'synthetic-specialist',createdAt:at});
 const approved=simulateApproval([setup.input],{actor:'Synthetic presenter',companyName:'Synthetic company',at,reviewed:true,reviewReasons:{}}),pdf=new TextDecoder().decode(demoPdf(approved));
 const pages=Number(pdf.match(/\/Count (\d+)/)[1]);assert.ok(pages>1);assert.ok(pdf.includes('Synthetic receipt 69'));
 assert.equal([...pdf.matchAll(/Developed by ETL GIS Consulting LLC/g)].length,pages);assert.ok([...pdf.matchAll(/Pay period: 2026-10-05 to 2026-10-16/g)].length>=pages);
});
