import { PAYCORE_PUBLIC_URL, PAYCORE_SHARE } from "./brand-identity.ts";
export type ShareStatus = "shared" | "copied" | "manual" | "cancelled";
type Copy = (text: string) => Promise<void>;
export async function copyPayCoreLink(copy?: Copy): Promise<ShareStatus> {
  if (!copy) return "manual";
  try { await copy(PAYCORE_PUBLIC_URL); return "copied"; }
  catch { return "manual"; }
}
export async function sharePayCoreLink({ share, copy }: { share?: (data: typeof PAYCORE_SHARE) => Promise<void>; copy?: Copy }): Promise<ShareStatus> {
  if (share) {
    try { await share({ ...PAYCORE_SHARE }); return "shared"; }
    catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return "cancelled";
    }
  }
  return copyPayCoreLink(copy);
}
