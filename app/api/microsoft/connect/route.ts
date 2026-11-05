import { requireSameOrigin } from "../../../../lib/server/security/http";
import { requireMicrosoftOwner } from "../../../../lib/server/gmail/access";
import {
  companyAccess,
  apiError,
  ApiError,
} from "../../../../lib/server/gmail/access";
import { mailboxConfiguration } from "../../../../lib/server/gmail/config";
import { beginMicrosoftConnect } from "../../../../lib/server/microsoft/oauth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (!mailboxConfiguration("MICROSOFT").ready)
      throw new ApiError(503, "Microsoft mailbox setup is not complete.");
    requireSameOrigin(request);
    const company = new URL(request.url).searchParams.get("companyId") ?? "";
    await requireMicrosoftOwner();
    const access = await companyAccess(company, "documents.connect");
    return Response.redirect(
      await beginMicrosoftConnect(company, access.userId),
      303,
    );
  } catch (error) {
    return apiError(error);
  }
}
