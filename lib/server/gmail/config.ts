import type { MailboxProvider } from "../../mailbox-links.ts";
function commonSetup() {
  const missing: string[] = [];
  if (
    !process.env.AUTH0_DOMAIN ||
    !process.env.AUTH0_CLIENT_ID ||
    !process.env.AUTH0_CLIENT_SECRET ||
    !process.env.AUTH0_SECRET ||
    !process.env.APP_BASE_URL
  )
    missing.push("Secure account connection");
  if (!process.env.DATABASE_URL) missing.push("Private database");
  if (!/^[a-f0-9]{64}$/i.test(process.env.GMAIL_ENCRYPTION_KEY ?? ""))
    missing.push("Mailbox encryption");
  if (!process.env.CRON_SECRET) missing.push("Automatic scheduler");
  return missing;
}
export function mailboxConfiguration(provider: MailboxProvider) {
  const missing = commonSetup();
  const configured =
    provider === "GMAIL"
      ? Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        )
      : Boolean(
          process.env.MICROSOFT_CLIENT_ID &&
            process.env.MICROSOFT_CLIENT_SECRET &&
            /^[A-Za-z0-9.-]+$/.test(
              process.env.MICROSOFT_TENANT_ID || "organizations",
            ),
        );
  if (!configured)
    missing.push(
      provider === "GMAIL"
        ? "Google mailbox connection"
        : "Microsoft 365 mailbox connection",
    );
  return { configured, ready: missing.length === 0, missing };
}
export const gmailConfiguration = () => mailboxConfiguration("GMAIL");
export function mailboxAutomationConfiguration() {
  const google = mailboxConfiguration("GMAIL"),
    microsoft = mailboxConfiguration("MICROSOFT"),
    missing = commonSetup();
  if (!google.configured && !microsoft.configured)
    missing.push("Microsoft 365 or Google mailbox connection");
  return {
    ready: missing.length === 0,
    missing,
    providers: {
      GMAIL: { ready: google.ready },
      MICROSOFT: { ready: microsoft.ready },
    },
  };
}
export { configuredOrigin as applicationOrigin } from "../security/http.ts";
