"use client";
import PeriodComparison from "./period-comparison";
import { useState } from "react";
import { calculateContractorSettlement, safeCents, yearToDate } from "../lib/settlements";
import type { CalculationInput } from "../lib/settlements";
import type { DemoApproval } from "../lib/demo-payroll";
import { exactDollars } from "../lib/demo-exports";
const money = (cents: number) => `$${exactDollars(cents)}`;
export default function ExhibitStatement({ inputs, approval }: { inputs: CalculationInput[]; approval: DemoApproval | null }) {
  const [person, setPerson] = useState(""), [portal, setPortal] = useState(false), [period, setPeriod] = useState("current");
  const input = inputs.find(input => input.contractor.id === person) ?? inputs[0];
  if (!input) return null;
  const current = approval?.snapshots.find(snapshot => snapshot.contractorId === input.contractor.id) ?? calculateContractorSettlement(input);
  const previous = (input.history ?? []).filter(snapshot => snapshot.contractorId === input.contractor.id && snapshot.companyId === input.run.companyId);
  const statement = period === "current" ? current : previous.find(snapshot => snapshot.payrollRunId === period) ?? current;
  const isCurrent = statement === current;
  const history = [...previous, ...(approval?.snapshots ?? [])];
  const ytd = yearToDate(history, input.run.companyId, input.contractor.id, statement.end);
  const snapshot = statement.calculationSnapshot;
  return <section className={`panel exhibit-statement ${portal ? "contractor-preview" : ""}`} aria-label="Settlement explanation and contractor preview"><div className="section-heading"><div><p className="eyebrow">{portal ? "SIMULATED CONTRACTOR VIEW" : "EVERY AMOUNT HAS A REASON"}</p><h2>{portal ? "Your settlement, clearly explained." : "Why this amount?"}</h2></div><button className="button button-secondary" onClick={() => setPortal(!portal)}>{portal ? "Back to payroll explanation" : "Preview contractor view"}</button></div>
    {portal && <p className="demo-explanation">Internal exhibit preview only. This is not a signed-in contractor portal and does not provide private contractor access.</p>}
    <div className="ops-filters"><label>Explain contractor<select aria-label="Explain contractor" value={input.contractor.id} onChange={event => { setPerson(event.target.value); setPeriod("current"); }}>{inputs.map(input => <option key={input.contractor.id} value={input.contractor.id}>{input.contractor.displayName}</option>)}</select></label><label>Statement period<select aria-label="Statement period" value={period} onChange={event => setPeriod(event.target.value)}><option value="current">{current.start} to {current.end} · {approval ? `Demo ${approval.status}` : "Draft"}</option>{previous.map(snapshot => <option key={snapshot.payrollRunId} value={snapshot.payrollRunId}>{snapshot.start} to {snapshot.end} · Demo approved</option>)}</select></label></div>
    <div className="exhibit-net"><span>{snapshot.contractor.displayName} · {statement.start} to {statement.end}</span><strong>{money(statement.netSettlementCents)}</strong><span>{isCurrent && !approval ? "Projected settlement · draft" : "Frozen exhibit statement · no real payment"}</span></div>
    <p>Eligible revenue: <strong>{money(statement.grossEligibleRevenueCents)}</strong> from {snapshot.loads.filter(load => load.status === "ELIGIBLE").length} work entries.</p>
    <details open><summary>Follow the calculation</summary><ol className="explanation-lines">{statement.lines.map(line => <li key={line.id}><div><strong>{line.description}</strong><small>{line.kind.replaceAll("_", " ").toLowerCase()} · {line.origin === "AUTOMATIC" ? "Configured agreement" : "Entered activity"}</small></div><span>{line.kind === "DEDUCTION" ? "−" : ""}{money(line.amountCents)}</span></li>)}</ol><p><strong>Net = earnings − deductions + reimbursements + adjustments.</strong></p></details>
    <details><summary>Included work and loads</summary>{snapshot.loads.map(load => <p key={load.id}>{load.loadNumber} · {load.date} · {load.destination} · {money(load.grossRevenueCents)} · {load.status === "ELIGIBLE" ? "Eligible" : "Excluded"}</p>)}</details>
    <PeriodComparison statement={statement} history={history} />
    <h3>Advance balances</h3>{snapshot.deductionRules.filter(rule => rule.remainingBalanceCents !== undefined).map(rule => { const deducted = safeCents(statement.lines.filter(line => line.ruleId === rule.id && line.kind === "DEDUCTION").reduce((sum, line) => sum + BigInt(line.amountCents), BigInt(0))); const remaining = rule.remainingBalanceCents! - deducted; return <p key={rule.id}>{rule.description}: opening {money(rule.remainingBalanceCents!)} · this settlement {money(deducted)} · {remaining === 0 ? "Paid off in this simulation" : `Remaining ${money(remaining)}`}</p>; })}{!snapshot.deductionRules.some(rule => rule.remainingBalanceCents !== undefined) && <p>No advance plan configured.</p>}
    <p className="guide-rail-note">{isCurrent && !approval ? "Approved-history YTD · draft excluded" : "Demo approved-history YTD"}: earnings {money(ytd.earningsCents)} · deductions {money(ytd.deductionsCents)} · net {money(ytd.netCents)}.</p>
  </section>;
}
