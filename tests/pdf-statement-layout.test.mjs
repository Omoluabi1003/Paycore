import { statementBoldFont, statementBoldFontBase64 } from '../lib/pdf-fonts/century-gothic-bold-italic.ts';
import { createHash } from 'node:crypto';
import { statementFont, statementFontBase64 } from '../lib/pdf-fonts/tr-century-gothic-italic.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {activateExhibitContractor} from '../lib/exhibit-journey.ts';
import {calculateGridRow} from '../lib/payroll-grid.ts';
import {simulateApproval} from '../lib/demo-payroll.ts';
import {demoPdf} from '../lib/demo-exports.ts';
import {statementReport} from '../lib/demo-statement-pdf.ts';
import {workingPeriod} from '../lib/pay-periods.ts';
const at='2026-10-18T12:00:00Z';
function fixture(start,end,method='PERCENT_OF_ELIGIBLE_REVENUE',rate='70'){
 const run=workingPeriod({version:1,start,end,timeZone:'UTC'});
 const setup=activateExhibitContractor({name:'Synthetic PDF Person',reference:'SYN-PDF',method,rate,insurance:'25',insuranceDescription:'Synthetic agreed insurance',advance:'',installment:''},[],run,'synthetic-pdf',at);
 return calculateGridRow({...setup.row,revenue:'1000'},[setup.input],at,run);
}
const approve=input=>simulateApproval([input],{actor:'Synthetic Specialist',companyName:'Synthetic Logistics',at,reviewed:true,reviewReasons:{}});
test('spreadsheet PDF preserves YTD categories when the compensation method changes',()=>{
 const earlier=approve(fixture('2026-10-01','2026-10-07')).snapshots[0];
 const input=fixture('2026-10-08','2026-10-14','FLAT_PER_PERIOD','800');input.history=[earlier];
 const approved=approve(input),report=statementReport(approved,approved.snapshots[0]);
 assert.equal(report.ytd.earningsCents,150000);assert.equal(report.ytd.deductionsCents,5000);assert.equal(report.ytd.netCents,145000);
 assert.equal(report.deductions.find(item=>item.label==='Insurance').ytdCents,5000);
 assert.deepEqual(report.earnings.find(item=>item.category==='PERCENT_OF_ELIGIBLE_REVENUE'),{category:'PERCENT_OF_ELIGIBLE_REVENUE',current:0,ytd:70000});
 assert.equal(report.earnings.find(item=>item.category==='FLAT_PER_PERIOD').current,80000);
 const before=JSON.stringify(approved);const pdf=new TextDecoder().decode(demoPdf(approved));
 for(const heading of ['CONTRACTOR PAYROLL','HOURS AND EARNINGS','DEDUCTIONS BY CATEGORY','TOTALS','ADVANCES, DEDUCTIONS AND REIMBURSEMENT DETAILS','LOAD DETAIL'])assert.ok(pdf.includes(heading));
 assert.ok(pdf.includes('/BaseFont /TRCenturyGothicItalic'));assert.ok(pdf.includes('/FontFile2'));assert.ok(!pdf.includes('/Helvetica'));assert.equal(JSON.stringify(approved),before);
 assert.deepEqual(demoPdf(approved),demoPdf(approved));
});
test('report YTD excludes future, foreign-company, foreign-contractor and unapproved history',()=>{
 const approved=approve(fixture('2026-10-08','2026-10-14')),snapshot=approved.snapshots[0];
 const variants=[{...snapshot,end:'2026-10-30'},{...snapshot,companyId:'foreign'},{...snapshot,contractorId:'foreign'},{...snapshot,status:'DRAFT'},{...snapshot,end:'2025-10-14'}];
 const report=statementReport({...approved,history:variants},snapshot);
 assert.equal(report.ytd.earningsCents,70000);assert.equal(report.deductions.find(item=>item.label==='Insurance').ytdCents,2500);
});
test('compact reference-style statement fits one Letter page and escapes entered PDF syntax',()=>{
 const input=fixture('2026-10-08','2026-10-14');input.contractor.displayName='Synthetic (PDF) \\ Person';
 const pdf=new TextDecoder().decode(demoPdf(approve(input)));
 assert.match(pdf,/\/MediaBox \[0 0 612 792\]/);assert.match(pdf,/\/Count 1\b/);
 assert.ok(pdf.includes('Synthetic \\(PDF\\) \\\\ Person'));assert.ok(pdf.includes('SIMULATION ONLY'));
});

test('PDF embeds the supplied unmodified TrueType font and uses character-ordered metrics',()=>{
 const pdf=new TextDecoder().decode(demoPdf(approve(fixture('2026-10-08','2026-10-14'))));
 const stream=pdf.match(/\/Length1 (\d+) \/Filter \/ASCIIHexDecode >>\nstream\n([0-9a-f]+)>/);
 assert.ok(stream);const bytes=Buffer.from(stream[2],'hex');assert.equal(bytes.length,Number(stream[1]));
 assert.deepEqual(bytes,Buffer.from(statementFontBase64,'base64'));assert.equal(createHash('sha256').update(bytes).digest('hex'),statementFont.sha256);
 assert.equal(statementFont.embeddingFlags,0);
 const widths=pdf.match(/\/FirstChar 32 \/LastChar 126 \/Widths \[([^\]]+)\]/)[1].split(' ').map(Number);
 assert.equal(widths.length,95);for(let i=0;i<95;i++)assert.equal(widths[i],statementFont.widths[String.fromCharCode(i+32)]);
 assert.ok(pdf.includes('/F2 4 0 R'));assert.ok(pdf.includes('/F2 7 Tf 0 Tr'));assert.ok(!pdf.includes('2 Tr')); // Real Bold Italic face replaces simulated weight.
});

test('headings embed the supplied Century Gothic Bold Italic bytes and their own widths',()=>{
 const pdf=new TextDecoder().decode(demoPdf(approve(fixture('2026-10-08','2026-10-14'))));
 const streams=[...pdf.matchAll(/\/Length1 (\d+) \/Filter \/ASCIIHexDecode >>\nstream\n([0-9a-f]+)>/g)];
 assert.equal(streams.length,2);const bytes=Buffer.from(streams[1][2],'hex');
 assert.equal(bytes.length,statementBoldFont.byteLength);assert.equal(bytes.length,Number(streams[1][1]));
 assert.deepEqual(bytes,Buffer.from(statementBoldFontBase64,'base64'));assert.equal(createHash('sha256').update(bytes).digest('hex'),statementBoldFont.sha256);
 assert.equal(statementBoldFont.embeddingFlags,0);assert.ok(pdf.includes('/BaseFont /CenturyGothic-BoldItalic'));
 const fontWidths=[...pdf.matchAll(/\/FirstChar 32 \/LastChar 126 \/Widths \[([^\]]+)\]/g)];assert.equal(fontWidths.length,2);
 const widths=fontWidths[1][1].split(' ').map(Number);assert.equal(widths.length,95);
 for(let i=0;i<95;i++)assert.equal(widths[i],statementBoldFont.widths[String.fromCharCode(i+32)]);
});
