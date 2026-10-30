"use client";
import { useState } from "react";
import { PAYCORE_PUBLIC_URL } from "../lib/brand-identity";
import { sharePayCoreLink } from "../lib/brand-sharing";
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
    <div className="paycore-share-actions"><button type="button" onClick={share}>Share PayCore</button></div>
    {status===messages.manual&&<label>Current app link<input className="paycore-public-link" aria-label="Current app link" readOnly value={PAYCORE_PUBLIC_URL} onFocus={event=>event.currentTarget.select()}/></label>}
    <span role="status">{status}</span>
  </div>;
}
