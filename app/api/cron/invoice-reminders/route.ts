import { NextResponse } from "next/server";
import { cronAuthorized } from "../../../../lib/server/gmail/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET))
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // Never send reminders from browser/demo state. Delivery requires an authoritative
  // invoice repository and an explicitly implemented production transport adapter.
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const mailConfigured = Boolean(
    process.env.PAYCORE_REMINDER_FROM && process.env.PAYCORE_REMINDER_TRANSPORT,
  );
  if (!databaseConfigured || !mailConfigured) {
    return NextResponse.json({
      ok: true,
      mode: "safe-hold",
      databaseConfigured,
      mailConfigured,
      sent: 0,
      message: "Reminder scheduler is active, but delivery remains held until the authoritative database and mail transport are configured.",
    });
  }
  return NextResponse.json({
    ok: true,
    mode: "safe-hold",
    sent: 0,
    message: "Delivery adapter must be explicitly implemented before reminders can leave PayCore.",
  });
}
