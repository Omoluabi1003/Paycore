export type MailboxProvider = "GMAIL" | "MICROSOFT";
export function mailboxSourceLink(
  provider: MailboxProvider,
  email: string,
  id: string,
  supplied?: string,
) {
  if (provider === "MICROSOFT") {
    if (supplied) {
      try {
        const url = new URL(supplied);
        if (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          [
            "outlook.office.com",
            "outlook.office365.com",
            "outlook.live.com",
          ].includes(url.hostname) &&
          !url.port
        )
          return url.href;
      } catch {}
    }
    return `https://outlook.office.com/mail/deeplink/read/${encodeURIComponent(id)}`;
  }
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#all/${encodeURIComponent(id)}`;
}
