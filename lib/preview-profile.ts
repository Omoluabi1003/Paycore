// A local suggestion, never an identity lookup or verified profile.
export function suggestDisplayName(email: string): string {
  const local = email.trim().split("@")[0].split("+")[0];
  const words = local.split(/[._-]+/).filter(Boolean);
  if (!words.length || words.length > 4 || words.some(word => !/^[\p{L}]+$/u.test(word))) return "";
  if (["admin", "info", "contact", "support", "payroll", "office", "accounts", "hello", "team", "billing", "sales", "hr", "noreply", "no", "reply"].some(word => words.some(part => part.toLowerCase() === word))) return "";
  return words.map(word => word.charAt(0).toLocaleUpperCase() + word.slice(1)).join(" ").slice(0, 120);
}
export function profileInitials(name: string): string {
  return Array.from(name.trim().split(/\s+/).filter(Boolean).map(word => Array.from(word)[0]).slice(0, 2).join("").toLocaleUpperCase()).slice(0, 2).join("") || "P";
}
