"use client";
import { useState } from "react";
import { createDraftContractor, previewRun } from "../lib/draft-contractor";
import type { CalculationInput } from "../lib/settlements";

export default function ContractorEntry({ inputs, onChange }: { inputs: CalculationInput[]; onChange: (next: CalculationInput[]) => void }) {
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  const [method, setMethod] = useState("PERCENT_OF_ELIGIBLE_REVENUE");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const contractor = createDraftContractor(values, inputs, previewRun, crypto.randomUUID(), new Date().toISOString());
      onChange([...inputs, contractor]); setOpen(false); setError("");
    } catch (error) {
      setError(error instanceof Error && error.name !== "ZodError" ? error.message : "Check the name, reference, pay rate, and deduction amount.");
    }
  }
  return <section className="panel activity-entry" aria-labelledby="contractor-entry-title"><h2 id="contractor-entry-title">Add your contractors</h2><p>You enter the people and agreed pay terms. PayCore calculates earnings, deductions, and net pay—no spreadsheet formulas needed.</p>
    {!inputs.length && <p>No contractors yet. Add a contractor to begin payroll.</p>}
    <button className="button button-primary" onClick={() => { setOpen(!open); setError(""); }} aria-expanded={open}>Add contractor</button>
    {open && <form className="activity-form" onSubmit={submit}><label>Contractor name<input name="name" required minLength={2} maxLength={120} /></label><label>Unique contractor reference<input name="reference" required maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_-]*" /></label><label>Pay method<select name="method" value={method} onChange={event => setMethod(event.target.value)}><option value="PERCENT_OF_ELIGIBLE_REVENUE">Percentage of revenue</option><option value="PER_MILE">Amount per mile</option><option value="FLAT_PER_PERIOD">Fixed amount per pay period</option></select></label><label>{method === "PERCENT_OF_ELIGIBLE_REVENUE" ? "Agreed percentage (%)" : method === "PER_MILE" ? "Agreed amount per mile ($)" : "Agreed amount per pay period ($)"}<input name="rate" required inputMode="decimal" /></label><label>Agreed deduction each payroll ($)<input name="deduction" required inputMode="decimal" defaultValue="0.00" /></label><p>Enter only agreed deductions. Add one-time charges and reimbursements under activity.</p>{error && <p role="alert">{error}</p>}<div className="activity-actions"><button type="submit" className="button button-primary">Add to draft</button><button type="button" className="button button-secondary" onClick={() => setOpen(false)}>Cancel</button></div></form>}
    <p className="guide-rail-note">Save your draft before refreshing to retain entries.</p>
  </section>;
}
