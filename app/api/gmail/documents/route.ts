import { companyAccess, apiError } from "../../../../lib/server/gmail/access";
import { scoped } from "../../../../lib/server/gmail/database";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      company = url.searchParams.get("companyId") ?? "",
      status =
        url.searchParams.get("status") === "EXCEPTION"
          ? "EXCEPTION"
          : "RECORDED";
    const raw = Number(url.searchParams.get("page") ?? 0),
      page = Number.isSafeInteger(raw) && raw >= 0 ? Math.min(raw, 100000) : 0;
    const access = await companyAccess(company, "documents.read");
    const rows = await scoped(
      company,
      access.userId,
      async (sql) =>
        (
          await sql.query(
            "SELECT d.id,d.message_id,m.email AS mailbox_email,d.source_name,d.fields,d.status,d.issues,d.received_at,d.recorded_at FROM incoming_documents d JOIN gmail_mailboxes m ON m.id=d.mailbox_id AND m.company_id=d.company_id WHERE d.company_id=$1 AND d.status=$2 ORDER BY d.recorded_at DESC,d.id LIMIT 51 OFFSET $3",
            [company, status, page * 50],
          )
        ).rows,
    );
    return Response.json(
      { documents: rows.slice(0, 50), hasMore: rows.length > 50, page },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
