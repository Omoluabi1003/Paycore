"use client";
import { useState } from "react";
import { ZodError } from "zod";
import { createDraftContractor } from "../lib/settlements";
import type { CalculationInput, CompensationRule, PayrollRun } from "../lib/settlements";

export default function ContractorEntry({ inputs, run, onAdd }: { inputs: CalculationInput[]; run: PayrollRun; onAdd: (input: CalculationInput) => void }) {
  const [open, setOpen] = useState(false), [method, setMethod] = useState("");
  const [error, setError] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const input = createDraftContractor({ name: String(data.get("name") ?? ""), reference: String(data.get("reference") ?? ""), method: method as CompensationRule["method"], rate: String(data.get("rate") ?? ""), effectiveFrom: String(data.get("effectiveFrom") ?? "") }, { run, id: `preview-${crypto.randomUUID()}`, actorId: "preview-specialist", createdAt: new Date().toISOString() }, inputs);
      onAdd(input); setOpen(false); setMethod("");
    } catch (e) { setError(e instanceof ZodError ? (e.issues[0].path.includes("rateBasisPoints") ? "Enter an agreed percentage from 0 to 100." : "Check the contractor name, reference, pay terms and effective date.") : e instanceof Error ? e.message : "Check the contractor details."); }
  }
  const rateLabel = method === "PERCENT_OF_ELIGIBLE_REVENUE" ? "Agreed percentage (%)" : method === "PER_MILE" ? "Agreed amount per mile ($)" : method === "FLAT_PER_LOAD" ? "Agreed amount per load ($)" : "Agreed amount per period ($)";
  return <section className="panel activity-entry" aria-labelledby="contractors-title"><div className="section-heading"><div><p className="eyebrow">YOUR CONTRACTORS</p><h2 id="contractors-title">{inputs.length ? `${inputs.length} contractor${inputs.length === 1 ? "" : "s"} added` : "Start by adding a contractor"}</h2></div><button className="button button-primary" aria-expanded={open} onClick={() => { setOpen(true); setMethod(""); setError(""); }}>Add contractor</button></div><p>You enter the name and agreed pay terms. PayCore calculates the earnings and applies only the deductions you configure. No formulas needed.</p>
    {!inputs.length && <p role="status">No contractors yet. Contractors and financial activity are never added automatically.</p>}
    {open && <form className="activity-form" onSubmit={submit}><h3>Contractor details</h3><label>Contractor name<input name="name" required minLength={2} maxLength={120} autoComplete="off" /></label><label>Contractor reference<input name="reference" required maxLength={32} placeholder="Your unique reference" /></label><label>How is this contractor paid?<select aria-label="How is this contractor paid?" required value={method} onChange={e => setMethod(e.target.value)}><option value="">Choose pay terms</option><option value="PERCENT_OF_ELIGIBLE_REVENUE">Percentage of eligible revenue</option><option value="FLAT_PER_LOAD">Fixed amount per load</option><option value="FLAT_PER_PERIOD">Fixed amount per pay period</option><option value="PER_MILE">Amount per mile</option><option value="MANUAL_EARNINGS">Earnings entered each period</option></select></label>{method && method !== "MANUAL_EARNINGS" && <label>{rateLabel}<input key={method} name="rate" inputMode="decimal" required placeholder="Enter the agreed rate" /></label>}<label>Pay terms effective from<input name="effectiveFrom" type="date" required defaultValue={run.start} max={run.end} /></label>{error && <p role="alert">{error}</p>}<div className="activity-actions"><button className="button button-primary" type="submit">Save contractor</button><button className="button button-secondary" type="button" onClick={() => { setOpen(false); setError(""); }}>Cancel</button></div></form>}
    <p className="guide-rail-note">Preview only: use fictional names and figures. Entries stay in this tab and reset on refresh. No bank or tax details are collected.</p>
  </section>;
}
