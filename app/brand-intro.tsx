"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export default function BrandIntro({ splash, children }: { splash: ReactNode; children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 7000);
    return () => window.clearTimeout(timer);
  }, []);
  return <>
    {visible && <div className="brand-intro-overlay" role="region" aria-label="PayCore introduction">
      {splash}
      <button type="button" className="brand-intro-skip" onClick={() => setVisible(false)}>Skip introduction</button>
      <span className="brand-intro-progress" aria-hidden="true" />
    </div>}
    <div className="paycore-app-content" inert={visible} aria-hidden={visible || undefined}>{children}</div>
  </>;
}
