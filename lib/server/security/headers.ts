// A conservative baseline compatible with Next.js inline hydration and local PDFs.
// This is not a nonce-based script policy or a substitute for output escaping.
export const securityHeaders = [
  { key: "Content-Security-Policy", value: "base-uri 'none'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://login.microsoftonline.com https://accounts.google.com" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];
export const privateHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Vercel-CDN-Cache-Control", value: "no-store" },
];
