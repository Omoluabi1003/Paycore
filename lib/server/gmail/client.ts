import { z } from "zod";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export class GoogleError extends Error {
  status: number;
  constructor(status: number) {
    super("Mailbox provider request failed.");
    this.status = status;
  }
}
export class GoogleResponseLimit extends Error {}
export async function googleJson(
  url: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(url, {
    ...init,
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok) throw new GoogleError(response.status);
  const reader = response.body?.getReader();
  if (!reader) throw Error("Empty Google response.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 20 * 1024 * 1024) {
      await reader.cancel();
      throw new GoogleResponseLimit(
        "Google response exceeds the document limit.",
      );
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export const TokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive().max(86400),
  scope: z.string().optional(),
});
export type Credentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};
export async function exchangeToken(
  parameters: Record<string, string>,
  fetcher: typeof fetch = fetch,
) {
  return TokenSchema.parse(
    await googleJson(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          ...parameters,
          client_id: process.env.GOOGLE_CLIENT_ID ?? "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        }),
      },
      fetcher,
    ),
  );
}
export class GmailClient {
  accessToken: string;
  private fetcher: typeof fetch;
  constructor(accessToken: string, fetcher: typeof fetch = fetch) {
    this.accessToken = accessToken;
    this.fetcher = fetcher;
  }
  async get(path: string) {
    if (!path.startsWith("/") || path.includes(".."))
      throw Error("Invalid Gmail resource.");
    return googleJson(
      `https://gmail.googleapis.com/gmail/v1/users/me${path}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
      this.fetcher,
    );
  }
  async profile() {
    return z
      .object({ emailAddress: z.email(), historyId: z.string().regex(/^\d+$/) })
      .parse(await this.get("/profile"));
  }
  async inboxPage(pageToken?: string) {
    const query = new URLSearchParams({ labelIds: "INBOX", maxResults: "100" });
    if (pageToken) query.set("pageToken", pageToken);
    return this.get(`/messages?${query}`);
  }
  async historyPage(historyId: string, pageToken?: string) {
    const query = new URLSearchParams({
      startHistoryId: historyId,
      maxResults: "100",
    });
    query.append("historyTypes", "messageAdded");
    query.append("historyTypes", "labelAdded");
    if (pageToken) query.set("pageToken", pageToken);
    return this.get(`/history?${query}`);
  }
  async messageMetadata(id: string) {
    return this.get(`/messages/${encodeURIComponent(id)}?format=metadata`);
  }
  async message(id: string) {
    return this.get(`/messages/${encodeURIComponent(id)}?format=full`);
  }
  async attachment(message: string, id: string) {
    return this.get(
      `/messages/${encodeURIComponent(message)}/attachments/${encodeURIComponent(id)}`,
    );
  }
}

export type MailboxClient = Pick<
  GmailClient,
  | "profile"
  | "inboxPage"
  | "historyPage"
  | "messageMetadata"
  | "message"
  | "attachment"
>;
