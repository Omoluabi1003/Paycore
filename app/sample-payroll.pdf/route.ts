import { sampleContractors } from "../../lib/sample-payroll";
import { samplePdf } from "../../lib/sample-exports";
export const runtime = "nodejs";
export function GET() {
  return new Response(new Uint8Array(samplePdf(sampleContractors)).buffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="PayCore-SAMPLE-statements.pdf"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

