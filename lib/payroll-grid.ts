import { createDraftContractor, previewRun } from "./draft-contractor.ts";
import { calculateContractorSettlement } from "./settlements.ts";
import type { CalculationInput } from "./settlements.ts";
import { z } from "zod";
export const gridColumns = ["name", "reference", "method", "rate", "revenue", "miles", "deduction", "charge", "reimbursement"] as const;
export type GridColumn = typeof gridColumns[number];
export type GridRow = Record<GridColumn, string> & { id: string };
export const emptyGridRow = (id: string): GridRow => ({ id, name: "", reference: "", method: "PERCENT_OF_ELIGIBLE_REVENUE", rate: "", revenue: "0", miles: "0", deduction: "0", charge: "0", reimbursement: "0" });
function cents(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("Enter a positive amount or zero, with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("This amount is too large.");
  return Number(amount);
}
export function calculateGridRow(row: GridRow, existing: CalculationInput[], now: string): CalculationInput {
  const prior = existing.find(input => input.contractor.id === row.id);
  let draft: CalculationInput;
  try { draft = createDraftContractor({ name: row.name, reference: row.reference, method: row.method, rate: row.rate, deduction: row.deduction }, existing.filter(input => input.contractor.id !== row.id), previewRun, row.id, now); }
  catch (error) { if (error instanceof z.ZodError) throw new Error(error.issues[0]?.message ?? "Check this row."); throw error; }
  const revenue = cents(row.revenue), charge = cents(row.charge), reimbursement = cents(row.reimbursement);
  if (!/^\d+$/.test(row.miles) || !Number.isSafeInteger(Number(row.miles))) throw new Error("Miles must be a whole, nonnegative number.");
  const prefix = `grid-${row.id}`;
  draft.loads = [...(prior?.loads.filter(load => load.id !== `${prefix}-load`) ?? []), { id: `${prefix}-load`, companyId: draft.run.companyId, contractorId: row.id, loadNumber: `${prefix}-work`, proNumber: `${prefix}-work`, date: draft.run.start, origin: "Period entry", destination: "Period work total", loadedMiles: Number(row.miles), emptyMiles: 0, grossRevenueCents: revenue, status: "ELIGIBLE" }];
  draft.transactions = prior?.transactions.filter(tx => ![`${prefix}-charge`, `${prefix}-reimbursement`].includes(tx.id)) ?? [];
  for (const [kind, amount, description] of [["charge", charge, "Entered period deduction"], ["reimbursement", reimbursement, "Entered period reimbursement"]] as const) {
    if (amount) draft.transactions.push({ id: `${prefix}-${kind}`, companyId: draft.run.companyId, contractorId: row.id, payPeriodId: draft.run.payPeriodId, transactionType: kind === "charge" ? "OTHER_DEDUCTION" : "REIMBURSEMENT", referenceNumber: `${prefix}-${kind}`, transactionDate: draft.run.start, description, amountCents: amount, miles: 0, source: "MANUAL", enteredBy: "preview-specialist", createdAt: now });
  }
  draft.history = prior?.history ?? [];
  draft.contractor.createdAt = prior?.contractor.createdAt ?? now;
  const result = calculateContractorSettlement(draft);
  if (result.blockers.length) throw new Error(result.blockers[0].message);
  return draft;
}
// Paste only into rows the specialist explicitly added; never create contractors from clipboard data.
export function pasteGrid(rows: GridRow[], startRow: number, startColumn: number, text: string): GridRow[] {
  const matrix = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").map(line => line.split("\t"));
  if (startRow + matrix.length > rows.length || matrix.some(line => startColumn + line.length > gridColumns.length)) throw new Error("Add enough rows before pasting, and keep pasted values within the entry columns.");
  return rows.map((row, index) => {
    const values = matrix[index - startRow];
    if (!values) return row;
    const updated = { ...row };
    values.forEach((value, column) => { updated[gridColumns[startColumn + column]] = value.trim(); });
    return updated;
  });
}
