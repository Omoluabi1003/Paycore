import {
  companyAccess,
  apiError,
  ApiError,
} from "../../../../lib/server/gmail/access";
import {
  applicationOrigin,
  gmailConfiguration,
} from "../../../../lib/server/gmail/config";
import { beginGoogleConnect } from "../../../../lib/server/gmail/oauth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (!gmailConfiguration().ready)
      throw new ApiError(503, "Mailbox setup is not complete.");
    if (request.headers.get("origin") !== applicationOrigin())
      throw new ApiError(403, "Open this action from PayCore.");
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
