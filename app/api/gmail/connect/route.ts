import { requireSameOrigin } from "../../../../lib/server/security/http";
import {
  companyAccess,
  apiError,
  ApiError,
} from "../../../../lib/server/gmail/access";
import { gmailConfiguration } from "../../../../lib/server/gmail/config";
import { beginGoogleConnect } from "../../../../lib/server/gmail/oauth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (!gmailConfiguration().ready)
      throw new ApiError(503, "Mailbox setup is not complete.");
    requireSameOrigin(request);
    const company = new URL(request.url).searchParams.get("companyId") ?? "";
    const access = await companyAccess(company, "documents.connect");
    return Response.redirect(
      await beginGoogleConnect(company, access.userId),
      303,
    );
  } catch (error) {
    return apiError(error);
  }
}
