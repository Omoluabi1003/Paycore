"use client";
import { useState } from "react";
import { PAYCORE_PUBLIC_URL } from "../lib/brand-identity";
import { copyPayCoreLink, sharePayCoreLink } from "../lib/brand-sharing";
import type { ShareStatus } from "../lib/brand-sharing";
const messages: Record<ShareStatus, string> = { shared: "PayCore link shared.", copied: "PayCore link copied.", manual: "Copy the public link shown below.", cancelled: "" };
export default function SharePayCore() {
  const [status, setStatus] = useState("");
  const copy = () => navigator.clipboard?.writeText ? (text: string) => navigator.clipboard.writeText(text) : undefined;
  async function share() {
    const result = await sharePayCoreLink({ share: navigator.share ? data => navigator.share(data) : undefined, copy: copy() });
    setStatus(messages[result]);
  }
  return <div className="paycore-sharing" aria-label="Share PayCore">
    <div className="paycore-share-actions"><button type="button" onClick={share}>Share PayCore</button><button type="button" onClick={async () => setStatus(messages[await copyPayCoreLink(copy())])}>Copy link</button><a href={PAYCORE_PUBLIC_URL}>Open PayCore</a></div>
    <a className="paycore-public-link" href={PAYCORE_PUBLIC_URL}>{PAYCORE_PUBLIC_URL}</a>
    <span role="status">{status}</span><small>Shares the public app link, without payroll records or personal details.</small>
  </div>;
}
