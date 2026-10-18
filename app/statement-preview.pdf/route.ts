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
  // Pure fixture construction: no workspace approval, persistence or payment operation.
  const sample = simulateApproval([input], { companyName: "Synthetic Logistics LLC", actor: "Synthetic example specialist", at, reviewed: true, reviewReasons: {}, statementHeader: { address: "101 Example Way", cityStateZip: "Example City, ST 00000", email: "office@example.test", phone: "202-555-0100", mcNumber: "SYN-MC", usdotNumber: "SYN-DOT", payrollNumber: "SYN-2026-006", invoicePayDate: "2026-10-23" } });
  return new Response(new Uint8Array(demoPdf(sample)).buffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="PayCore-SYNTHETIC-statement-preview.pdf"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
