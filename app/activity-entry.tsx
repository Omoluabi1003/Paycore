"use client";
import { useEffect, useState } from "react";
import type { CalculationInput, PayrollTransaction } from "../lib/settlements";
import Decimal from "decimal.js";

type Action = "Load" | "Deduction" | "Reimbursement" | "Adjustment";
const categories = ["FUEL_DEDUCTION", "INSURANCE_DEDUCTION", "CASH_ADVANCE", "ESCROW_DEDUCTION", "REGISTRATION_DEDUCTION", "TRUCK_REGISTRATION_DEDUCTION", "TRAILER_REGISTRATION_DEDUCTION", "IFTA_DEDUCTION", "MAINTENANCE_DEDUCTION", "FACTORING_DEDUCTION", "OTHER_DEDUCTION"] as const;
export default function ActivityEntry({ inputs, onChange, requestedAction }: { requestedAction?: { action: "Load" | "Deduction"; serial: number } | null; inputs: CalculationInput[]; onChange: (inputs: CalculationInput[]) => void }) {
  const [person, setPerson] = useState(0), [action, setAction] = useState<Action>("Load"), [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const selected = inputs[person];
  useEffect(() => { if (requestedAction) { setAction(requestedAction.action); setOpen(true); setError(""); } }, [requestedAction]);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = event.currentTarget, values = new FormData(form);
    try {
      const dollars = String(values.get("amount"));
      if (!/^-?\d+(\.\d{1,2})?$/.test(dollars)) throw new Error("Enter an amount with at most two decimal places.");
      const exact = new Decimal(dollars).times(100);
      if (exact.abs().greaterThan(Number.MAX_SAFE_INTEGER)) throw new Error("This amount is too large.");
      const amountCents = exact.toNumber();
      if (action !== "Adjustment" && amountCents < 0) throw new Error("Enter a positive amount.");
      const description = String(values.get("description")).trim(), reference = String(values.get("reference")).trim();
      if (!description || !reference) throw new Error("Enter a description and reference.");
      const date = String(values.get("date"));
      if (date < selected.run.start || date > selected.run.end) throw new Error("Choose a date within this pay period.");
      const identifier = `sample-entry-${crypto.randomUUID()}`;
      let updated: CalculationInput;
      if (action === "Load") {
        const miles = Number(values.get("miles"));
        if (!Number.isSafeInteger(miles) || miles < 0) throw new Error("Enter whole, nonnegative miles.");
        updated = { ...selected, loads: [...selected.loads, { id: identifier, companyId: selected.run.companyId, contractorId: selected.contractor.id, loadNumber: reference, proNumber: reference, date, origin: "Sample origin", destination: description, loadedMiles: miles, emptyMiles: 0, grossRevenueCents: amountCents, status: "ELIGIBLE" }] };
      } else {
        const transactionType = action === "Deduction" ? String(values.get("category")) as PayrollTransaction["transactionType"] : action === "Reimbursement" ? "REIMBURSEMENT" : "ADJUSTMENT";
        updated = { ...selected, transactions: [...selected.transactions, { id: identifier, companyId: selected.run.companyId, contractorId: selected.contractor.id, payPeriodId: selected.run.payPeriodId, transactionType, referenceNumber: reference, transactionDate: date, description, amountCents, miles: 0, source: "MANUAL", enteredBy: "sample-specialist", createdAt: new Date().toISOString() }] };
      }
      onChange(inputs.map((input, index) => index === person ? updated : input)); form.reset(); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Check the activity details."); }
  }
  return <section className="panel activity-entry" aria-labelledby="activity-title"><h2 id="activity-title">Enter fictional activity</h2><p>Choose a contractor. Their configured pay and deductions apply automatically. Amounts and review checks update immediately.</p><label>Contractor <select value={person} onChange={e => { setPerson(Number(e.target.value)); setOpen(false); setError(""); }}>{inputs.map((input, i) => <option key={input.contractor.id} value={i}>{input.contractor.displayName}</option>)}</select></label><div className="activity-actions">{(["Load", "Deduction", "Reimbursement", "Adjustment"] as const).map(label => <button className="button button-secondary" key={label} onClick={() => { setAction(label); setOpen(true); setError(""); }}>Add {label}</button>)}</div>
    {open && <form onSubmit={submit} className="activity-form"><h3>Add {action.toLowerCase()} · {selected.contractor.displayName}</h3><label>Reference <input name="reference" required maxLength={128} /></label><label>{action === "Load" ? "Destination / description" : "Description"}<input name="description" required maxLength={128} placeholder={action === "Deduction" ? "e.g. Fuel purchase — Dallas stop" : undefined} /></label><label>Date <input type="date" name="date" min={selected.run.start} max={selected.run.end} defaultValue={selected.run.start} required /></label><label>{action === "Load" ? "Gross revenue ($)" : "Amount ($)"}<input name="amount" inputMode="decimal" required placeholder={action === "Adjustment" ? "Signed amount, e.g. -25.00" : "0.00"} /></label>{action === "Load" && <label>Total miles <input name="miles" type="number" min="0" step="1" required defaultValue="0" /></label>}{action === "Deduction" && <label>Category <select name="category" aria-label="Deduction category">{categories.map(category => <option key={category} value={category}>{category === "REGISTRATION_DEDUCTION" ? "registration (legacy / unspecified)" : category.replaceAll("_", " ").toLowerCase()}</option>)}</select></label>}{error && <p role="alert">{error}</p>}<div className="activity-actions"><button type="submit" className="button button-primary">Add to draft</button><button type="button" className="button button-secondary" onClick={() => setOpen(false)}>Cancel</button></div></form>}
    <p className="guide-rail-note">Enter each fuel purchase separately with its description, date, receipt reference and amount. PayCore totals the purchases and deducts them once.</p><p className="guide-rail-note">Fictional entries stay in this tab. Save a demo draft before refreshing to recover them. After simulated approval, downloads contain your entered demo figures.</p>
  </section>;
}
