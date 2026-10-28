import { activateExhibitContractor } from "../../lib/exhibit-journey";
import { calculateGridRow } from "../../lib/payroll-grid";
import { simulateApproval } from "../../lib/demo-payroll";
import { demoPdf } from "../../lib/demo-exports";
import { workingPeriod } from "../../lib/pay-periods";

export const runtime = "nodejs";
// Fixed public fictional example only. Never read request/session/workspace records here.
export function GET() {
  const at = "2026-10-18T12:00:00Z";
  const run = workingPeriod({ version: 1, start: "2026-10-05", end: "2026-10-16", timeZone: "UTC" });
  const setup = activateExhibitContractor({ name: "Synthetic Contractor", reference: "SYN-PDF", address: "202 Example Lane", cityStateZip: "Example Town, ST 00000", phone: "202-555-0101", method: "PERCENT_OF_ELIGIBLE_REVENUE", rate: "70", insurance: "25", insuranceDescription: "Synthetic agreed insurance", advance: "150", installment: "100" }, [], run, "synthetic-preview", at);
  const input = calculateGridRow({ ...setup.row, revenue: "1000" }, [setup.input], at, run);
  // Richer fixed fictional specimen to exhibit the Excel-style load and receipt sections.
  const template=input.loads[0];
  input.loads=Array.from({length:5},(_,index)=>({...template,id:`synthetic-load-${index+1}`,loadNumber:`SYN-LOAD-${index+1}`,proNumber:`SYN-PRO-${index+1}`,date:`2026-10-${String(5+index).padStart(2,"0")}`,origin:"Example Origin, ST",destination:`Example Destination ${index+1}, ST`,loadedMiles:100,emptyMiles:20,grossRevenueCents:100000}));
  input.transactions.push(...Array.from({length:4},(_,index)=>({id:`synthetic-fuel-${index+1}`,companyId:run.companyId,contractorId:input.contractor.id,payPeriodId:run.payPeriodId,transactionType:"FUEL_DEDUCTION" as const,referenceNumber:`SYN-FUEL-${index+1}`,transactionDate:`2026-10-${String(5+index).padStart(2,"0")}`,description:`Fuel - Example Station ${index+1}, Example City, ST`,amountCents:1000,miles:0,source:"MANUAL",enteredBy:"synthetic-specialist",createdAt:at})));
  input.fuelReconciliation={expectedTotalCents:4000};
  // Pure fixture construction: no workspace approval, persistence or payment operation.
  const sample = simulateApproval([input], { companyName: "Synthetic Logistics LLC", actor: "Synthetic example specialist", at, reviewed: true, reviewReasons: {}, statementHeader: { address: "101 Example Way", cityStateZip: "Example City, ST 00000", email: "office@example.test", phone: "202-555-0100", mcNumber: "SYN-MC", usdotNumber: "SYN-DOT", payrollNumber: "SYN-2026-006", invoicePayDate: "2026-10-23" } });
  return new Response(new Uint8Array(demoPdf(sample)).buffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="PayCore-SYNTHETIC-statement-preview.pdf"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
