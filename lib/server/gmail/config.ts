export function gmailConfiguration() {
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
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    missing.push("Google mailbox connection");
  if (!/^[a-f0-9]{64}$/i.test(process.env.GMAIL_ENCRYPTION_KEY ?? ""))
    missing.push("Mailbox encryption");
  if (!process.env.CRON_SECRET) missing.push("Automatic scheduler");
  return { ready: missing.length === 0, missing };
}
export function applicationOrigin() {
  const url = new URL(process.env.APP_BASE_URL ?? "");
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    throw Error("HTTPS application URL required.");
  return url.origin;
}
