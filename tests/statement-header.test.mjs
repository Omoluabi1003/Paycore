import test from 'node:test';import assert from 'node:assert/strict';
import {StatementHeaderSchema,nextStatementHeader} from '../lib/statement-header.ts';
import {activateExhibitContractor} from '../lib/exhibit-journey.ts';
import {calculateGridRow} from '../lib/payroll-grid.ts';
import {simulateApproval} from '../lib/demo-payroll.ts';
import {demoPdf} from '../lib/demo-exports.ts';
import {encodeDraft,decodeDraft} from '../lib/demo-draft.ts';
import {workingPeriod} from '../lib/pay-periods.ts';
const at='2026-10-18T12:00:00Z',run=workingPeriod({version:1,start:'2026-10-05',end:'2026-10-16',timeZone:'UTC'});
const header=StatementHeaderSchema.parse({address:'101 Example Way',cityStateZip:'Example City, ST 00000',email:'office@example.test',phone:'202-555-0100',mcNumber:'SYN-MC',usdotNumber:'SYN-DOT',payrollNumber:'SYN-2026-006',invoicePayDate:'2026-10-23'});
function fixture(){const setup=activateExhibitContractor({name:'Synthetic Contractor',reference:'SYN-1',address:'202 Example Lane',cityStateZip:'Example Town, ST 00000',phone:'202-555-0101',method:'PERCENT_OF_ELIGIBLE_REVENUE',rate:'70',insurance:'',insuranceDescription:'',advance:'',installment:''},[],run,'synthetic-1',at);setup.row.revenue='1000';setup.input=calculateGridRow(setup.row,[setup.input],at,run);return setup;}
test('entered header and contact survive grid edits and draft recovery and freeze with approval',()=>{
 const setup=fixture();assert.equal(setup.input.contractor.address,'202 Example Lane');
 const restored=decodeDraft(encodeDraft({inputs:[setup.input],rows:[setup.row],statementHeader:header},'synthetic-scope',run,at),'synthetic-scope',run);assert.deepEqual(restored.statementHeader,header);assert.equal(restored.inputs[0].contractor.phone,'202-555-0101');
 const approved=simulateApproval(restored.inputs,{statementHeader:header,companyName:'Synthetic Company',actor:'Synthetic Specialist',at,reviewed:true,reviewReasons:{}}),before=JSON.stringify(approved),pdf=new TextDecoder().decode(demoPdf(approved));
 for(const value of ['101 Example Way','office@example.test','202-555-0100','SYN-MC','SYN-DOT','SYN-2026-006','2026-10-23','202 Example Lane','202-555-0101'])assert.ok(pdf.includes(value),value);
 assert.equal(approved.snapshots[0].netSettlementCents,70000);assert.ok(Object.isFrozen(approved.statementHeader));assert.equal(JSON.stringify(approved),before);
 const future=nextStatementHeader(header);assert.equal(future.address,header.address);assert.equal(future.payrollNumber,'');assert.equal(future.invoicePayDate,'');assert.equal(header.payrollNumber,'SYN-2026-006');
});
test('statement fields validate dates, email, image type, dimensions and bounds',()=>{
 for(const bad of [{email:'not-email'},{invoicePayDate:'2026-02-30'},{phone:'x'.repeat(121)},{logo:{data:'data:image/svg+xml;base64,AAAA',width:10,height:10}},{logo:{data:'data:image/jpeg;base64,AAAA',width:10,height:10}}])assert.throws(()=>StatementHeaderSchema.parse(bad));
 assert.equal(StatementHeaderSchema.parse({}).payrollNumber,'');
});

test('a validated JPEG logo is frozen and embedded once with safe PDF image resources',()=>{
 const logo={data:'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABGALQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDg6KKK1PCCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiunudC0yG4gTzLhbeaUwx3olR4ZMqdr5A+TDbSUOTgnkEVInha1NlewPLONWt/JiEYZShnZZXaPGM5Cxhev380XL9mzlKK6ODSdLXVGs7iO8kH9ni8DRzqmD9l88rgoeCeB6D1qW08L/ANo3uhNa2eoGw1Ar58gG/wAoee8Z+cKAMKoPI7+lFwUG9jl6K3pdIhg0Cxv/AOz9Rn8+BpZLhJAIYyJXTH+rPZQfvd6nGlaRPHZiGG+je50+5vMvcowUxibC4EYyCYh37n60C5Gc1RWxqdlpthJeWIe5F9aNsaRmBjlcMA6hQuVxyQSTnb2zTRo4ml0KCByJdSjGS54VjPJGMe2FH60C5Xexk0V0lho2l6y92tk13CtlG1xM8rK/mQr94qAo2t0wCT168ctGj2MlquoGHULe0SB5pIpcFnAZFXZJtCkEyKDwduCeeKLj5Gc7RWjqFpbLY2t/ZiVYJ2kiMczhmR02k/MAMgh1PQdx2zWdQS1YKKKKACiiigAooooAKKKKACiiigAoBwQR1FFFAGje6xJeW7wC1trdJZRNL5CsPMcAgEgkgfebhQBz06U6fXryea9mHlxyXd6t8zRggpIu8jbzwP3h9eg5rMooHzM1rrxBc3Wszam0NvHLLbtbmONSEVTD5PAzx8vv19uKhg1m4gutKuFSIvpm3yQQcNiVpRu55+Zj0xxj61n0UBzM0JNVE2nW9pLYWrm3iaKKcmQOql2fs+0nLntRHrNxF9m2pF/o9pLaJkHlJPM3E89f3rY+g49c+igOZmnd63Ndwyq9tbLNOqrPcKrb5QCDzkkDJAJIAyRz3pV1pxaWkP2O2M1mhSC5zIJE+dnB4fbkMx7Vl0UBzM2k8S3EEjSWlpZ2zyPunMSN++HOVYFiApycqoA/IYT/AISOZYYbeKxs4rWMy5gVXKyCQIGDEsSfuKQc5B78DGNRRYfOy5e6g96kMQhit4IQRHDDu2gk5J+YkknjknsPSqdFFBLdwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9k=',width:180,height:70};
 const valid=StatementHeaderSchema.parse({...header,logo});assert.throws(()=>StatementHeaderSchema.parse({...header,logo:{...logo,width:181}}));
 const setup=fixture(),approved=simulateApproval([setup.input],{statementHeader:valid,companyName:'Synthetic Company',actor:'Synthetic Specialist',at,reviewed:true,reviewReasons:{}});
 const pdf=new TextDecoder().decode(demoPdf(approved));assert.ok(Object.isFrozen(approved.statementHeader.logo));assert.ok(pdf.includes('/Subtype /Image /Width 180 /Height 70'));assert.ok(pdf.includes('/CompanyLogo '));assert.ok(pdf.includes('/Filter [/ASCIIHexDecode /DCTDecode]'));
 const xref=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(xref,xref+4),'xref');
});
