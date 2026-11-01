"use client";
import {useState} from "react";
import type {CalculationInput} from "../lib/settlements";
import {parseDecimalEntry} from "../lib/settlements";
import {createFuelReceipt,fuelReceiptTotal} from "../lib/fuel-receipts";
import {duplicateReceiptIds} from "../lib/activity-register";
import type {DraftCorrection} from "../lib/activity-register";
import {exactDollars} from "../lib/demo-exports";
import DraftCorrectionForm from "./draft-correction-form";
const money=(cents:number)=>`$${exactDollars(cents)}`;
export default function FuelDetailEntry({inputs,onChange,onCorrect}:{inputs:CalculationInput[];onChange:(inputs:CalculationInput[])=>void;onCorrect?:(inputs:CalculationInput[],correction:DraftCorrection)=>void}){
 const [contractor,setContractor]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[editing,setEditing]=useState('');
 const input=inputs.find(item=>item.contractor.id===contractor)??inputs[0];
 if(!input)return null;
 const receipts=input.transactions.filter(tx=>tx.transactionType==='FUEL_DEDUCTION'),duplicates=duplicateReceiptIds(input);
 let total:number|null=null;try{total=fuelReceiptTotal(input);}catch{}
 const replace=(updated:CalculationInput)=>onChange(inputs.map(item=>item.contractor.id===updated.contractor.id?updated:item));
 return <details id="fuel-source-check" className="panel activity-entry fuel-detail-entry"><summary>Fuel receipt details and source check</summary>
  <p>Enter each receipt once. PayCore totals these fuel deductions automatically. Use a card label or last four digits in the description.</p>
  <label>Contractor<select aria-label="Fuel contractor" value={input.contractor.id} onChange={event=>{setContractor(event.target.value);setError('');setMessage('');setEditing('');}}>{inputs.map(item=><option key={item.contractor.id} value={item.contractor.id}>{item.contractor.displayName}</option>)}</select></label>
  <form key={`receipts-${input.contractor.id}`} onSubmit={event=>{event.preventDefault();const form=event.currentTarget,values=new FormData(form);try{replace(createFuelReceipt(input,{date:String(values.get('date')),documentNumber:String(values.get('documentNumber')),description:String(values.get('description')),place:String(values.get('place')),cityState:String(values.get('cityState')),amount:String(values.get('amount'))},{id:crypto.randomUUID(),actor:'preview-specialist',at:new Date().toISOString()}));form.reset();setError('');setMessage('Fuel receipt added to this contractor’s draft.');}catch(problem){setError(problem instanceof Error?problem.message:'Check the fuel receipt.');}}}>
   <div className="table-scroll"><table className="fuel-receipts-table"><caption>Fuel receipt details · {input.contractor.displayName}</caption><thead><tr><th>Date</th><th>Document number</th><th>Description / fuel card used</th><th>Place or store</th><th>City &amp; state</th><th>Amount ($)</th></tr></thead><tbody>
    {receipts.map(receipt=><tr key={receipt.id}><td>{receipt.transactionDate}</td><td>{receipt.referenceNumber}{duplicates.has(receipt.id)&&<small className="review-warning">Possible duplicate</small>}{onCorrect&&receipt.id.startsWith('sample-entry-')&&!input.history?.some(record=>record.sourceIds.includes(`transaction:${receipt.id}`))&&<button type="button" className="text-link" aria-label={`Correct fuel receipt ${receipt.referenceNumber}`} onClick={()=>setEditing(receipt.id)}>Correct</button>}</td><td>{receipt.description}</td><td>{receipt.place||'—'}</td><td>{receipt.cityState||'—'}</td><td>{money(receipt.amountCents)}</td></tr>)}
    <tr><td><input aria-label="New fuel receipt date" name="date" type="date" min={input.run.start} max={input.run.end} defaultValue={input.run.start} required/></td><td><input aria-label="New fuel document number" name="documentNumber" maxLength={128} required/></td><td><input aria-label="New fuel description / card used" name="description" maxLength={128} placeholder="Fuel card ending 1234" required/></td><td><input aria-label="New fuel place or store" name="place" maxLength={128} required/></td><td><input aria-label="New fuel city & state" name="cityState" maxLength={128} required/></td><td><input aria-label="New fuel amount" name="amount" inputMode="decimal" placeholder="0.00" required/></td></tr>
   </tbody><tfoot><tr><th scope="row" colSpan={5}>Fuel total</th><td>{total===null?'Check receipt amounts':money(total)}</td></tr></tfoot></table></div>
   <button type="submit" className="button button-secondary">Add fuel receipt</button>
  </form>
  {editing&&onCorrect&&<DraftCorrectionForm key={editing} inputs={inputs} contractorId={input.contractor.id} sourceId={editing} onCancel={()=>setEditing('')} onCorrect={(next,correction)=>{onCorrect(next,correction);setEditing('');setMessage('Fuel receipt corrected. Review the updated total.');}}/>}
  <form key={`source-${input.contractor.id}-${input.fuelReconciliation?.expectedTotalCents??''}`} className="activity-form" onSubmit={event=>{event.preventDefault();try{const values=new FormData(event.currentTarget);replace({...input,fuelReconciliation:{expectedTotalCents:parseDecimalEntry(String(values.get('expected')))}});setError('');setMessage('Fuel source total saved for comparison. No extra deduction was added.');}catch(problem){setError(problem instanceof Error?problem.message:'Check the source total.');}}}>
   <label>Expected fuel-detail total ($)<input name="expected" inputMode="decimal" required defaultValue={input.fuelReconciliation?exactDollars(input.fuelReconciliation.expectedTotalCents):''}/></label><button type="submit" className="button button-secondary">Check fuel total</button>
   {input.fuelReconciliation&&<><p role="status">{total===input.fuelReconciliation.expectedTotalCents?'Matched':'Mismatch — check the receipt entries'} · Receipts {total===null?'need attention':money(total)} · Expected {money(input.fuelReconciliation.expectedTotalCents)}</p><button type="button" className="text-link" onClick={()=>{const {fuelReconciliation:removed,...rest}=input;replace(rest);setMessage('Source check cleared. Receipt deductions are unchanged.');}}>Clear fuel source check</button></>}
  </form><p className="guide-rail-note">The source total is optional and checks your receipts. It does not create another deduction.</p>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </details>;
}
