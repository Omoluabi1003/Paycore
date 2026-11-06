import { sampleContractors } from "../../lib/sample-payroll";
import { sampleCsv } from "../../lib/sample-exports";
// Fixed public fictional output is generated at build time, never from a session.
export const dynamic = "force-static";
export function GET() {
  return new Response(sampleCsv(sampleContractors), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="PayCore-SAMPLE-payroll.csv"', "Cache-Control": "public, max-age=3600, s-maxage=86400", "X-Content-Type-Options": "nosniff" } });
}
