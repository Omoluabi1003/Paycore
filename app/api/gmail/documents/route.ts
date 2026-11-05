import { companyAccess, apiError } from "../../../../lib/server/gmail/access";
import { readDocuments } from "../../../../lib/server/gmail/read-documents";
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
    return Response.json(
      await readDocuments(access, status, page),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
