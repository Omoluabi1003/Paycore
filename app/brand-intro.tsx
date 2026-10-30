"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { createIntroSessionGuard } from "../lib/brand-intro-session";

const entry = createIntroSessionGuard();
export default function BrandIntro({ splash, children }: { splash: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const decision = useRef<boolean | null>(null);
  useEffect(() => {
    if (decision.current === null) {
      let storage: Storage | null = null;
      try { storage = window.sessionStorage; } catch { /* Use the document guard. */ }
      decision.current = entry.claim(pathname, storage);
    }
    if (pathname !== "/" || !decision.current) {
      decision.current = false;
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => { decision.current = false; setVisible(false); }, 7000);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  function dismiss() { decision.current = false; setVisible(false); }
  return <>
    {visible && <div className="brand-intro-overlay" role="region" aria-label="PayCore introduction">
      {splash}
      <button type="button" className="brand-intro-skip" onClick={dismiss}>Skip introduction</button>
      <span className="brand-intro-progress" aria-hidden="true" />
    </div>}
    <div className="paycore-app-content" inert={visible} aria-hidden={visible || undefined}>{children}</div>
  </>;
}
