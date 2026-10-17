import { sampleContractors } from "../../lib/sample-payroll";
import { sampleCsv } from "../../lib/sample-exports";
export function GET() {
  return new Response(sampleCsv(sampleContractors), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="PayCore-SAMPLE-payroll.csv"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
