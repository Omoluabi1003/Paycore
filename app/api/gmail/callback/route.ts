import { companyAccess } from "../../../../lib/server/gmail/access";
import {
  applicationOrigin,
  gmailConfiguration,
} from "../../../../lib/server/gmail/config";
import {
  stateCompany,
  finishGoogleConnect,
} from "../../../../lib/server/gmail/oauth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!gmailConfiguration().ready)
    return Response.json(
      { error: "Mailbox setup is not complete." },
      { status: 503 },
    );
  const url = new URL(request.url);
  try {
    const state = url.searchParams.get("state") ?? "",
      code = url.searchParams.get("code") ?? "";
    if (url.searchParams.has("error") || !code)
      throw Error("Google consent was not completed.");
    const company = stateCompany(state),
      access = await companyAccess(company, "documents.connect");
    await finishGoogleConnect(company, access.userId, state, code);
    return Response.redirect(
      `${applicationOrigin()}/scan?gmail=connected`,
      303,
    );
  } catch {
    return Response.redirect(
      `${applicationOrigin()}/scan?gmail=connection-failed`,
      303,
    );
  }
}
