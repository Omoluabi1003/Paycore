import { z } from "zod";
import {
  googleJson,
  GoogleError,
  GoogleResponseLimit,
  TokenSchema,
} from "../gmail/client.ts";
import { mailboxSourceLink } from "../../mailbox-links.ts";
export const MICROSOFT_SCOPES =
  "openid profile email offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read";
export function microsoftAuthority() {
  const tenant = process.env.MICROSOFT_TENANT_ID || "organizations";
  if (!/^[A-Za-z0-9.-]+$/.test(tenant))
    throw Error("Invalid Microsoft tenant.");
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
}
export async function exchangeMicrosoftToken(
  parameters: Record<string, string>,
  fetcher: typeof fetch = fetch,
) {
  return TokenSchema.parse(
    await googleJson(
      `${microsoftAuthority()}/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          ...parameters,
          client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
          client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
          scope: MICROSOFT_SCOPES,
        }),
      },
      fetcher,
    ),
  );
}
export function graphUrl(value: string, delta = false) {
  const url = new URL(
    value.startsWith("/") ? `https://graph.microsoft.com/v1.0${value}` : value,
  );
  if (
    url.protocol !== "https:" ||
    url.hostname !== "graph.microsoft.com" ||
    url.port ||
    url.username ||
    url.password ||
    !url.pathname.startsWith("/v1.0/") ||
    (delta && !/\/messages\/delta$/i.test(url.pathname))
  )
    throw Error("Invalid Microsoft Graph continuation URL.");
  return url.href;
}
export class MicrosoftClient {
  private token: string;
  private fetcher: typeof fetch;
  private inboxId?: string;
  constructor(token: string, fetcher: typeof fetch = fetch) {
    this.token = token;
    this.fetcher = fetcher;
  }
  private async get(path: string) {
    return googleJson(
      graphUrl(path),
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Prefer: 'IdType="ImmutableId", outlook.body-content-type="text"',
        },
      },
      this.fetcher,
    );
  }
  private async inbox() {
    if (!this.inboxId) {
      const row = await this.get("/me/mailFolders/inbox?$select=id");
      this.inboxId = z.string().min(1).parse(row.id);
    }
    return this.inboxId;
  }
  async profile() {
    const row = await this.get("/me?$select=id,mail,userPrincipalName");
    const emailAddress = z.email().parse(row.mail || row.userPrincipalName);
    await this.inbox();
    return { emailAddress, accountId: z.string().min(1).parse(row.id), historyId: "microsoft-delta" };
  }
  private async delta(cursor?: string) {
    const page = await this.get(
      cursor
        ? graphUrl(cursor, true)
        : "/me/mailFolders/inbox/messages/delta?$select=id&$top=100",
    );
    const next = page["@odata.nextLink"]
        ? graphUrl(page["@odata.nextLink"], true)
        : undefined,
      final = page["@odata.deltaLink"]
        ? graphUrl(page["@odata.deltaLink"], true)
        : undefined;
    if (!next && !final)
      throw Error("Microsoft delta response lacks a continuation.");
    const ids = (page.value ?? [])
      .filter((entry: any) => !entry["@removed"])
      .map((entry: any) => ({ id: z.string().min(1).parse(entry.id) }));
    return { ids, next, final };
  }
  async inboxPage(cursor?: string) {
    const page = await this.delta(cursor);
    return {
      messages: page.ids,
      nextPageToken: page.next,
      historyId: page.final,
    };
  }
  async historyPage(historyId: string, pageToken?: string) {
    const page = await this.delta(pageToken || historyId);
    return {
      history: [
        {
          messagesAdded: page.ids.map((message: { id: string }) => ({
            message,
          })),
        },
      ],
      nextPageToken: page.next,
      historyId: page.final || historyId,
    };
  }
  async messageMetadata(id: string) {
    const [row, inbox] = await Promise.all([
      this.get(
        `/me/messages/${encodeURIComponent(id)}?$select=id,parentFolderId,receivedDateTime,webLink`,
      ),
      this.inbox(),
    ]);
    return {
      labelIds: row.parentFolderId === inbox ? ["INBOX"] : [],
      internalDate: String(Date.parse(row.receivedDateTime)),
      sourceUrl: mailboxSourceLink("MICROSOFT", "", id, row.webLink),
    };
  }
  async message(id: string) {
    const [row, inbox] = await Promise.all([
      this.get(
        `/me/messages/${encodeURIComponent(id)}?$select=id,subject,from,body,receivedDateTime,parentFolderId,hasAttachments,webLink`,
      ),
      this.inbox(),
    ]);
    const parts: any[] = [
      {
        mimeType:
          row.body?.contentType?.toLowerCase() === "html"
            ? "text/html"
            : "text/plain",
        body: {
          data: Buffer.from(row.body?.content ?? "").toString("base64url"),
        },
      },
    ];
    if (row.hasAttachments) {
      let next: string | undefined =
        `/me/messages/${encodeURIComponent(id)}/attachments?$select=id,name,contentType,size,isInline&$top=100`;
      let count = 0;
      while (next) {
        const page = await this.get(next);
        for (const item of page.value ?? []) {
          if (++count > 1000)
            throw new GoogleResponseLimit("Too many Microsoft attachments.");
          const file =
            item["@odata.type"] === "#microsoft.graph.fileAttachment";
          parts.push({
            filename: item.name || "Attachment",
            mimeType: file
              ? item.contentType || "application/octet-stream"
              : "application/vnd.microsoft.item-attachment",
            headers: [
              {
                name: "Content-Disposition",
                value: item.isInline ? "inline" : "attachment",
              },
            ],
            body: file
              ? { attachmentId: item.id, size: item.size }
              : {
                  data: Buffer.from(
                    "Unsupported Outlook attachment type.",
                  ).toString("base64url"),
                },
          });
        }
        next = page["@odata.nextLink"]
          ? graphUrl(page["@odata.nextLink"])
          : undefined;
      }
    }
    const sender = row.from?.emailAddress;
    return {
      labelIds: row.parentFolderId === inbox ? ["INBOX"] : [],
      internalDate: String(Date.parse(row.receivedDateTime)),
      sourceUrl: mailboxSourceLink("MICROSOFT", "", id, row.webLink),
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "Subject", value: row.subject || "" },
          {
            name: "From",
            value: sender?.name
              ? `${sender.name} <${sender.address}>`
              : sender?.address || "",
          },
        ],
        parts,
      },
    };
  }
  async attachment(message: string, id: string) {
    const row = await this.get(
      `/me/messages/${encodeURIComponent(message)}/attachments/${encodeURIComponent(id)}`,
    );
    if (
      row["@odata.type"] !== "#microsoft.graph.fileAttachment" ||
      typeof row.contentBytes !== "string"
    )
      throw Error("Microsoft attachment is not a file.");
    return {
      data: Buffer.from(row.contentBytes, "base64").toString("base64url"),
    };
  }
}
