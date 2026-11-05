import { requireSameOrigin } from "../../../../lib/server/security/http";
import { requireMicrosoftOwner } from "../../../../lib/server/gmail/access";
import { isBrice } from "../../../../lib/server/microsoft/ownership";
import {
  companyAccess,
  apiError,
  ApiError,
} from "../../../../lib/server/gmail/access";
import { scoped } from "../../../../lib/server/gmail/database";
import { event } from "../../../../lib/server/gmail/repository";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const url = new URL(request.url),
      company = url.searchParams.get("companyId") ?? "",
      mailbox = url.searchParams.get("mailboxId") ?? "";
    const access = await companyAccess(company, "documents.connect");
    await scoped(company, access.userId, async (sql) => {
      const box = (await sql.query("SELECT provider,email,connected_by FROM gmail_mailboxes WHERE company_id=$1 AND id=$2 FOR UPDATE", [company, mailbox])).rows[0];
      if (!box) throw new ApiError(404, "Mailbox not found.");
      if (box.provider === "MICROSOFT" || isBrice(box.email)) {
        await requireMicrosoftOwner();
        if (box.connected_by !== access.userId) throw new ApiError(403, "Only the connected account can disconnect this mailbox.");
      }
      const found = (
        await sql.query(
          "UPDATE gmail_mailboxes SET active=false,credentials='' WHERE company_id=$1 AND id=$2 RETURNING id",
          [company, mailbox],
        )
      ).rows[0];
      if (!found) throw new ApiError(404, "Mailbox not found.");
      await sql.query(
        "DELETE FROM gmail_sync_jobs WHERE company_id=$1 AND mailbox_id=$2",
        [company, mailbox],
      );
      await event(sql, company, access.userId, "gmail.disconnected", {
        mailboxId: mailbox,
      });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
