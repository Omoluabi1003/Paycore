import { Resolver } from "node:dns/promises";
export function providerFromMx(records: readonly { exchange: string }[]) {
  const hosts = records.map((row) =>
    row.exchange.toLowerCase().replace(/\.$/, ""),
  );
  if (hosts.some((host) => host.endsWith(".mail.protection.outlook.com")))
    return "MICROSOFT" as const;
  if (
    hosts.some(
      (host) =>
        host === "smtp.google.com" ||
        host === "aspmx.l.google.com" ||
        host.endsWith(".aspmx.l.google.com"),
    )
  )
    return "GMAIL" as const;
  return "UNKNOWN" as const;
}
const cache = new Map<
  string,
  { provider: ReturnType<typeof providerFromMx>; expires: number }
>();
export async function discoverMailboxProvider(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return "UNKNOWN";
  const saved = cache.get(domain);
  if (saved && saved.expires > Date.now()) return saved.provider;
  try {
    const resolver = new Resolver({ timeout: 1500, tries: 1 });
    const result = providerFromMx(await resolver.resolveMx(domain));
    cache.set(domain, { provider: result, expires: Date.now() + 600000 });
    return result;
  } catch {
    return "UNKNOWN";
  }
}
