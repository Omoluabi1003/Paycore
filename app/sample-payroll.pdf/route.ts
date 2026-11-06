import { sampleContractors } from "../../lib/sample-payroll";
import { samplePdf } from "../../lib/sample-exports";
export const runtime = "nodejs";
// Fixed public fictional output is generated at build time, never from a session.
export const dynamic = "force-static";
export function GET() {
  return new Response(new Uint8Array(samplePdf(sampleContractors)).buffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="PayCore-SAMPLE-statements.pdf"', "Cache-Control": "public, max-age=3600, s-maxage=86400", "X-Content-Type-Options": "nosniff" } });
}

