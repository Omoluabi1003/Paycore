"use client";
import { useEffect, useRef, useState } from "react";
import { correctDraftTransaction } from "../lib/activity-register";
import type { DraftCorrection } from "../lib/activity-register";
import type { CalculationInput } from "../lib/settlements";
import { exactDollars } from "../lib/demo-exports";
export default function DraftCorrectionForm({ inputs, contractorId, sourceId, onCorrect, onCancel }: { inputs: CalculationInput[]; contractorId: string; sourceId: string; onCorrect: (inputs: CalculationInput[], correction: DraftCorrection) => void; onCancel: () => void }) {
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.querySelector("input")?.focus(); }, []);
  const transaction = inputs.find(input => input.contractor.id === contractorId)?.transactions.find(tx => tx.id === sourceId);
  if (!transaction) return <p role="alert">The entry is no longer available. Reopen the activity register.</p>;
  return <form ref={form} className="activity-form correction-form" aria-label={`Correct ${transaction.referenceNumber}`} onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); try { const result = correctDraftTransaction(inputs, contractorId, sourceId, { description: String(values.get("description")), reference: String(values.get("reference")), date: String(values.get("date")), amount: String(values.get("amount")), reason: String(values.get("reason")) }, new Date().toISOString()); onCorrect(result.inputs, result.correction); setError(""); } catch (error) { setError(error instanceof Error ? error.message : "Check this correction."); } }}><h3>Correct draft entry · {transaction.referenceNumber}</h3><p>Check the source receipt first. Describe why this entry needs changing.</p><label>Description<input name="description" required maxLength={128} defaultValue={transaction.description} /></label><label>Receipt / reference<input name="reference" required maxLength={128} defaultValue={transaction.referenceNumber} /></label><label>Date<input name="date" type="date" required defaultValue={transaction.transactionDate} /></label><label>Amount ($)<input name="amount" inputMode="decimal" required defaultValue={exactDollars(transaction.amountCents)} /></label><label>Reason for correction<input name="reason" required maxLength={240} /></label>{error && <p role="alert">{error}</p>}<div className="activity-actions"><button className="button button-primary" type="submit">Save correction</button><button className="button button-secondary" type="button" onClick={onCancel}>Cancel correction</button></div></form>;
}
