import { requireMicrosoftOwner } from "../../../../lib/server/gmail/access";
import { companyAccess } from "../../../../lib/server/gmail/access";
import {
  applicationOrigin,
  mailboxConfiguration,
} from "../../../../lib/server/gmail/config";
import {
  microsoftStateCompany,
  finishMicrosoftConnect,
} from "../../../../lib/server/microsoft/oauth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!mailboxConfiguration("MICROSOFT").ready)
    return Response.json(
      { error: "Microsoft mailbox setup is not complete." },
      { status: 503 },
    );
  const url = new URL(request.url);
  try {
    const state = url.searchParams.get("state") ?? "",
      code = url.searchParams.get("code") ?? "";
    if (url.searchParams.has("error") || !code)
      throw Error("Microsoft consent was not completed.");
    await requireMicrosoftOwner();
    const company = microsoftStateCompany(state),
      access = await companyAccess(company, "documents.connect");
    await finishMicrosoftConnect(company, access.userId, state, code);
    return Response.redirect(
      `${applicationOrigin()}/scan?mailbox=connected`,
      303,
    );
  } catch {
    return Response.redirect(
      `${applicationOrigin()}/scan?mailbox=connection-failed`,
      303,
    );
  }
}
