export const BRAND_INTRO_SESSION_KEY = "paycore-brand-intro-seen-v1";
type IntroStorage = Pick<Storage, "getItem" | "setItem">;

// Presentation state only, never identity or authorization. A document-local
// guard still prevents repeats during client navigation if tab storage is blocked.
export function createIntroSessionGuard() {
  let enteredThisDocument = false;
  return {
    claim(pathname: string, storage: IntroStorage | null): boolean {
      let seen = enteredThisDocument;
      enteredThisDocument = true;
      try {
        seen ||= storage?.getItem(BRAND_INTRO_SESSION_KEY) === "1";
        storage?.setItem(BRAND_INTRO_SESSION_KEY, "1");
      } catch { /* The presentation must not depend on storage availability. */ }
      // A deep link opens its task directly and consumes this entry decision.
      return pathname === "/" && !seen;
    },
  };
}
