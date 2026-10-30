// Current hosting address is a fallback, not a permanent brand domain.
export function resolvePublicUrl(configured?: string): string {
  const url = new URL(configured?.trim() || "https://paycore-1.vercel.app/");
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("PayCore public URL must be an HTTPS address without credentials.");
  }
  return `${url.origin}/`;
}
export const PAYCORE_PUBLIC_URL = resolvePublicUrl(process.env.NEXT_PUBLIC_PAYCORE_URL);
export const PAYCORE_SHARE = {
  title: "PayCore | Contractor Settlements & Payroll",
  text: "Enter the facts. Understand every deduction. Developed by ETL GIS Consulting LLC.",
  url: PAYCORE_PUBLIC_URL,
};
