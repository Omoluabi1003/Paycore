import { requirePermission } from "../access.ts";
import type { CompanyAccess } from "../access.ts";
import { scoped } from "./database.ts";
import { event } from "./repository.ts";

export async function readDocuments(
  access: CompanyAccess,
  status: "RECORDED" | "EXCEPTION",
  page: number,
  transaction = scoped,
) {
  requirePermission(access, "documents.read", Date.now());
  if (!["RECORDED", "EXCEPTION"].includes(status) ||
      !Number.isSafeInteger(page) || page < 0 || page > 100000)
    throw Error("Invalid document query.");
  return transaction(access.companyId, access.userId, async (sql) => {
    const rows = (await sql.query(
      "SELECT d.id,d.source_provider,d.source_url,d.message_id,m.email AS mailbox_email,d.source_name,d.fields,d.status,d.issues,d.received_at,d.recorded_at FROM incoming_documents d JOIN gmail_mailboxes m ON m.id=d.mailbox_id AND m.company_id=d.company_id WHERE d.company_id=$1 AND d.status=$2 ORDER BY d.recorded_at DESC,d.id LIMIT 51 OFFSET $3",
      [access.companyId, status, page * 50],
    )).rows;
    const documents = rows.slice(0, 50);
    // Persist access evidence in the same transaction before returning any records.
    // Never copy financial fields, source URLs, mailbox addresses or credentials.
    await event(sql, access.companyId, access.userId, "documents.read", {
      status, page, count: documents.length,
      documentIds: documents.map(row => row.id),
    });
    return { documents, hasMore: rows.length > 50, page };
  });
}
