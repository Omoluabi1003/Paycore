"use client";
import { useRef, useState } from "react";
import { calculateGridRow, emptyGridRow, gridColumns, pasteGrid } from "../lib/payroll-grid";
import type { GridRow } from "../lib/payroll-grid";
import { calculateContractorSettlement } from "../lib/settlements";
import type { CalculationInput, PayrollRun } from "../lib/settlements";
const labels = ["Contractor name", "Reference", "Pay method", "Pay rate", "Revenue ($)", "Miles", "Recurring deduction ($)", "One-time deduction ($)", "Reimbursement ($)"];
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export default function PayrollGrid({ inputs, onChange, onValidityChange, run, rows, onRowsChange }: { run: PayrollRun; rows: GridRow[]; onRowsChange: (rows: GridRow[]) => void; inputs: CalculationInput[]; onChange: (next: CalculationInput[]) => void; onValidityChange: (valid: boolean) => void }) {
  const [pasteError, setPasteError] = useState("");
  const table = useRef<HTMLTableElement>(null);
  const parsed = rows.map(row => {
    try { return { input: calculateGridRow(row, inputs.filter(input => !rows.some(other => other.id === input.contractor.id && other.id !== row.id)), new Date().toISOString(), run), error: "" }; }
    catch (error) { return { input: null, error: error instanceof Error ? error.message : "Check this row." }; }
  });
  function update(next: GridRow[]) {
    onRowsChange(next); setPasteError("");
    const candidates: CalculationInput[] = [];
    let valid = true;
    for (const row of next) {
      try { candidates.push(calculateGridRow(row, [...inputs.filter(input => input.contractor.id === row.id), ...candidates], new Date().toISOString(), run)); }
      catch { valid = false; }
    }
    // Incomplete edits never replace the last valid payroll with partial amounts.
    onValidityChange(valid && next.length > 0);
    if (valid) onChange(candidates);
  }
  function focusCell(row: number, column: number) { table.current?.querySelector<HTMLElement>(`[data-cell="${row}-${column}"]`)?.focus(); }
  function addRow() {
    update([...rows, emptyGridRow(crypto.randomUUID())]);
    requestAnimationFrame(() => focusCell(rows.length, 0));
  }
  return <section className="panel payroll-sheet" aria-labelledby="sheet-title"><div className="section-heading"><div><h2 id="sheet-title">Your payroll desk</h2><p>Enter the facts. PayCore does the math.</p></div><button className="button button-primary" onClick={addRow}>Add contractor row</button></div>
    <p id="sheet-help">Tab moves across cells. Enter moves down. Paste cells copied from a spreadsheet into rows you have added. Pay rate is a percentage for % revenue, or dollars for other methods.</p>
    <div className="table-scroll"><table ref={table} aria-describedby="sheet-help"><caption className="sr-only">Editable contractor payroll for {run.start} through {run.end}, in US dollars</caption><thead><tr><th scope="col">Row</th>{labels.map(label => <th key={label} scope="col">{label}</th>)}<th scope="col">Earnings</th><th scope="col">Net pay</th><th scope="col">Check</th><th scope="col">Action</th></tr></thead><tbody>{rows.map((row, rowIndex) => {
      const entry = parsed[rowIndex];
      const detail = entry.input ? calculateContractorSettlement(entry.input) : null;
      const duplicate = rows.some(other => other.id !== row.id && other.reference.trim().toUpperCase() === row.reference.trim().toUpperCase());
      const error = duplicate && row.reference.trim() ? "Use a unique contractor reference." : entry.error;
      return <tr key={row.id}><th scope="row">{rowIndex + 1}</th>{gridColumns.map((column, columnIndex) => {
        const props = { "aria-label": `${labels[columnIndex]}, row ${rowIndex + 1}`, "aria-invalid": Boolean(error), "aria-describedby": error ? `row-error-${row.id}` : undefined, "data-cell": `${rowIndex}-${columnIndex}`, value: row[column], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => update(rows.map(other => other.id === row.id ? { ...other, [column]: event.target.value } : other)), onKeyDown: (event: React.KeyboardEvent) => { if (event.key === "Enter") { event.preventDefault(); focusCell(rowIndex + (event.shiftKey ? -1 : 1), columnIndex); } }, onPaste: (event: React.ClipboardEvent) => { const text = event.clipboardData.getData("text"); if (/[\t\n]/.test(text)) { event.preventDefault(); try { update(pasteGrid(rows, rowIndex, columnIndex, text)); } catch (error) { setPasteError(error instanceof Error ? error.message : "Check the pasted values."); } } } };
        return <td key={column}>{column === "method" ? <select {...props}><option value="PERCENT_OF_ELIGIBLE_REVENUE">% revenue</option><option value="PER_MILE">Per mile</option><option value="FLAT_PER_PERIOD">Per period</option></select> : <input {...props} inputMode={["name", "reference"].includes(column) ? "text" : "decimal"} maxLength={column === "name" ? 120 : column === "reference" ? 32 : 24} />}</td>;
      })}<td className="calculated-cell">{detail && !error ? money(detail.grossEarningsCents) : "—"}</td><td className="calculated-cell">{detail && !error ? money(detail.netSettlementCents) : "—"}</td><td className="sheet-status" id={`row-error-${row.id}`}>{error || detail?.warnings.map(warning => warning.message).join(" ") || "Calculated"}</td><td><button type="button" className="button button-secondary" aria-label={`Remove row ${rowIndex + 1}`} onClick={() => update(rows.filter(other => other.id !== row.id))}>Remove</button></td></tr>;
    })}</tbody></table></div>
    {!rows.length && <p className="sheet-empty">No contractors added. Add a row to start.</p>}
    {pasteError && <p role="alert">{pasteError}</p>}
    <p className="guide-rail-note" role="status">{parsed.some(entry => entry.error) ? "Finish the highlighted rows to update payroll totals and continue review. Totals below retain the last complete entry." : "Earnings and net pay are calculated. Review all agreed deductions before finalizing."}</p>
    <p className="guide-rail-note">Preview only · Use fictional details · Entries reset on refresh. Detailed activity is added on top of these period figures.</p>
  </section>;
}
