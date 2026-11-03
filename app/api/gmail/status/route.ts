import { gmailConfiguration } from "../../../../lib/server/gmail/config";
import { auth0Configured } from "../../../../lib/server/auth0";
import {
  companies,
  apiError,
  companyAccess,
} from "../../../../lib/server/gmail/access";
import { scoped } from "../../../../lib/server/gmail/database";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const configuration = gmailConfiguration();
  if (!auth0Configured() || !process.env.DATABASE_URL)
    return Response.json(
      {
        configured: false,
        authConfigured: auth0Configured(),
        missing: configuration.missing,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    const available = await companies();
    const company =
      new URL(request.url).searchParams.get("companyId") ??
      available[0]?.company_id;
    if (!company)
      return Response.json(
        {
          configured: true,
          automationReady: configuration.ready,
          missing: configuration.missing,
          companies: [],
          mailboxes: [],
          error: "Your secure account needs a company membership.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    const access = await companyAccess(company, "documents.read");
    const mailboxes = await scoped(
      company,
      access.userId,
      async (sql) =>
        (
          await sql.query(
            "SELECT id,email,active,last_synced_at,last_error,checkpoint->>'phase' AS phase FROM gmail_mailboxes WHERE company_id=$1 ORDER BY connected_at DESC",
            [company],
          )
        ).rows,
    );
    return Response.json(
      {
        configured: true,
        automationReady: configuration.ready,
        missing: configuration.missing,
        companyId: company,
        companies: available,
        mailboxes,
        canConnect: access.roles.some((role) =>
          ["OWNER_ADMIN", "FINANCE"].includes(role),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
