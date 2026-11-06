import { cronAuthorized } from "../../../../lib/server/gmail/crypto";
import { mailboxAutomationConfiguration } from "../../../../lib/server/gmail/config";
import { runGmailScheduler } from "../../../../lib/server/gmail/worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (
    !cronAuthorized(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.PAYCORE_MAILBOX_SYNC_ENABLED === "false")
    return Response.json({ active: false, paused: true }, { headers: { "Cache-Control": "no-store" } });
  const configuration = mailboxAutomationConfiguration();
  if (!configuration.ready)
    return Response.json(
      { active: false, missing: configuration.missing },
      { status: 503 },
    );
  try {
    return Response.json(
      { active: true, ...(await runGmailScheduler()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        active: false,
        error:
          "Mailbox scheduler could not complete. It will retry on the next run.",
      },
      { status: 503 },
    );
  }
}
