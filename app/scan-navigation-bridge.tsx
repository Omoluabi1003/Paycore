"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7V4h3 M17 4h3v3 M20 17v3h-3 M7 20H4v-3 M7 9h10v6H7z" />
    </svg>
  );
}

export default function ScanNavigationBridge() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const locate = () => {
      const sidebar = document.querySelector<HTMLElement>(".sidebar");
      const workspaceNav = sidebar?.querySelector<HTMLElement>("nav:not([aria-label])") ?? null;
      setTarget(workspaceNav);
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  return createPortal(
    <Link className="nav-item paycore-scan-nav-item" href="/scan" aria-label="Open PayCore Scan">
      <ScanIcon />
      <span>Scan</span>
    </Link>,
    target,
  );
}
