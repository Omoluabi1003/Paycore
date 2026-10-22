"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { reconcileScan, summarizeScan, type ScanCandidateRecord } from "../../lib/payroll-scan";

const sampleRecords: ScanCandidateRecord[] = [
  { id: "10584", documentId: "demo", contractorId: "james", reference: "Load 10584", amountCents: 245000, sourceFieldIds: ["f1"], state: "VERIFIED", issues: [] },
  { id: "10591", documentId: "demo", contractorId: "james", reference: "Load 10591", amountCents: 187500, sourceFieldIds: ["f2"], state: "VERIFIED", issues: [] },
  { id: "fuel", documentId: "demo", contractorId: "james", reference: "Fuel", category: "FUEL", amountCents: -42500, sourceFieldIds: ["f3"], state: "VERIFIED", issues: [] },
  { id: "advance", documentId: "demo", contractorId: "james", reference: "F/ADV", category: "CASH_ADVANCE", amountCents: -20000, sourceFieldIds: ["f4"], state: "NEEDS_REVIEW", issues: ["Confirm that F/ADV means cash advance recovery."] }
];

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const shell: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "28px 22px 64px", fontFamily: "var(--font-geist-sans), Arial, sans-serif", color: "#102f43" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #d7e2e8", borderRadius: 18, boxShadow: "0 12px 34px rgba(16,47,67,.06)" };
const navItem: React.CSSProperties = { color: "#486581", textDecoration: "none", fontWeight: 650, padding: "11px 13px", borderRadius: 10 };

export default function ScanPage() {
  const [records, setRecords] = useState<ScanCandidateRecord[]>(sampleRecords);
  const [scanned, setScanned] = useState(false);
  const [approved, setApproved] = useState(false);
  const sourceTotalCents = 370000;
  const reconciliation = useMemo(() => reconcileScan(records, sourceTotalCents), [records]);
  const summary = useMemo(() => summarizeScan(records, reconciliation), [records, reconciliation]);

  function verifyAdvance() {
    setRecords(current => current.map(record => record.id === "advance" ? { ...record, state: "VERIFIED", issues: [] } : record));
    setApproved(false);
  }

  return <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f5faf8 0,#f7fafc 320px,#fff 100%)" }}>
    <div style={shell}>
      <header style={{ ...card, padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <Link href="/" style={{ color: "#102f43", fontSize: 23, fontWeight: 800, textDecoration: "none", letterSpacing: "-.03em" }}>PayCore</Link>
        <nav aria-label="PayCore modules" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Link href="/" style={navItem}>Payroll</Link><Link href="/" style={navItem}>Invoices</Link><span style={{ ...navItem, color: "#0b6e5b", background: "#e9f7f2" }}>Scan</span><Link href="/" style={navItem}>Reports</Link>
        </nav>
        <span style={{ fontSize: 12, fontWeight: 750, color: "#627d98" }}>PREVIEW WORKSPACE</span>
      </header>

      <section style={{ padding: "46px 4px 26px", display: "grid", gridTemplateColumns: "minmax(0,1.45fr) minmax(250px,.55fr)", gap: 30, alignItems: "end" }}>
        <div><p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: ".16em", color: "#0b6e5b" }}>PAYCORE SCAN</p><h1 style={{ margin: "10px 0 12px", fontSize: "clamp(38px,6vw,66px)", lineHeight: .98, letterSpacing: "-.055em", maxWidth: 720 }}>Turn payroll documents into review-ready data.</h1><p style={{ margin: 0, maxWidth: 720, color: "#526d82", fontSize: 18, lineHeight: 1.65 }}>Scan it. Verify it. PayCore does the data entry. Every financial value must be traceable, checked and reconciled before it can move toward payroll.</p></div>
        <aside style={{ ...card, padding: 20 }}><strong style={{ display: "block", fontSize: 14 }}>Nothing posts automatically.</strong><p style={{ color: "#627d98", lineHeight: 1.5, fontSize: 13, marginBottom: 0 }}>A specialist reviews uncertain values and approves a reconciled scan before PayCore can create payroll activity.</p></aside>
      </section>

      {!scanned ? <>
        <section style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "34px", display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(260px,.75fr)", gap: 28 }}>
            <div style={{ border: "1.5px dashed #8fb8aa", borderRadius: 16, padding: "42px 28px", background: "#f7fcfa", textAlign: "center" }}>
              <div aria-hidden="true" style={{ width: 62, height: 62, margin: "0 auto 18px", borderRadius: 16, display: "grid", placeItems: "center", background: "#dff4ec", color: "#0b6e5b", fontSize: 28 }}>▤</div>
              <h2 style={{ fontSize: 25, margin: "0 0 8px" }}>Drop payroll documents here</h2><p style={{ color: "#627d98", margin: "0 0 22px" }}>PDF, scanned PDF, photo, CSV or Excel</p>
              <button type="button" onClick={() => setScanned(true)} style={{ border: 0, borderRadius: 10, background: "#0b6e5b", color: "#fff", padding: "13px 20px", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>Try a secure fictional scan</button>
              <p style={{ fontSize: 12, color: "#829ab1", margin: "16px 0 0" }}>Preview uses fictional data while production document storage and recognition remain disconnected.</p>
            </div>
            <div><p style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", color: "#627d98" }}>WHAT PAYCORE CHECKS</p>{[
              ["01","Reads the document","Finds payroll rows, references and financial values."],
              ["02","Matches the context","Connects recognized activity to the right contractor and category."],
              ["03","Checks the money","Reconciles extracted totals against the source document."],
              ["04","Stops uncertainty","Anything ambiguous waits for a specialist instead of being guessed."]
            ].map(([n,title,copy]) => <div key={n} style={{ display: "grid", gridTemplateColumns: "38px 1fr", gap: 10, padding: "12px 0", borderBottom: "1px solid #edf2f5" }}><span style={{ color: "#0b6e5b", fontWeight: 800 }}>{n}</span><div><strong>{title}</strong><p style={{ margin: "4px 0 0", color: "#627d98", fontSize: 13, lineHeight: 1.45 }}>{copy}</p></div></div>)}</div>
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginTop: 16 }}>
          {[['Source linked','Every extracted value keeps evidence back to its document.'],['Duplicate aware','Repeated documents and records are designed to stop before posting.'],['Reconciled first','Source totals and extracted totals must agree before approval.']].map(([title,copy]) => <div key={title} style={{ ...card, padding: 18 }}><strong style={{ fontSize: 14 }}>{title}</strong><p style={{ color: "#627d98", fontSize: 13, lineHeight: 1.5, marginBottom: 0 }}>{copy}</p></div>)}
        </section>
      </> : <section style={{ ...card, padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", paddingBottom: 20, borderBottom: "1px solid #e6edf1" }}><div><p style={{ color: "#0b6e5b", fontWeight: 800, margin: "0 0 6px" }}>SCAN COMPLETE ✓</p><h2 style={{ margin: 0 }}>Fictional_Weekly_Settlement.pdf</h2><p style={{ color: "#627d98", marginBottom: 0 }}>4 records recognized. Review the interpretation before approval.</p></div><div style={{ display: "flex", gap: 10 }}><div style={{ background: "#e9f7f2", borderRadius: 12, padding: "12px 16px" }}><strong>{summary.verified} verified</strong></div><div style={{ background: summary.needsReview ? "#fff6df" : "#e9f7f2", borderRadius: 12, padding: "12px 16px" }}><strong>{summary.needsReview} review</strong></div></div></div>
        <div style={{ overflowX: "auto", marginTop: 18 }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}><thead><tr style={{ textAlign: "left", color: "#627d98", fontSize: 12, borderBottom: "1px solid #d9e2e8" }}><th style={{ padding: 12 }}>SOURCE</th><th>PAYCORE READ</th><th>AMOUNT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{records.map(record => <tr key={record.id} style={{ borderBottom: "1px solid #edf2f5" }}><td style={{ padding: 14, fontWeight: 650 }}>{record.reference}</td><td>{record.category ?? "Load revenue"}</td><td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{money(record.amountCents ?? 0)}</td><td>{record.state === "VERIFIED" ? "✓ Verified" : record.state === "UNREADABLE" ? "Could not read" : "⚠ Needs review"}</td><td>{record.id === "advance" && record.state !== "VERIFIED" ? <button onClick={verifyAdvance} style={{ border: "1px solid #8fb8aa", background: "#fff", borderRadius: 8, padding: "8px 10px", fontWeight: 700 }}>Confirm cash advance</button> : "Source linked"}</td></tr>)}</tbody></table></div>
        <section style={{ marginTop: 24, padding: 22, borderRadius: 14, background: summary.canApprove ? "#f1faf6" : "#fff9eb", border: `1px solid ${summary.canApprove ? "#b9dfd1" : "#ead9a7"}` }}><div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}><div><strong style={{ fontSize: 17 }}>Reconciliation</strong><p style={{ color: "#526d82" }}>Source {money(sourceTotalCents)} · Extracted {money(reconciliation.extractedTotalCents)} · Difference {money(reconciliation.differenceCents ?? 0)}</p><p style={{ marginBottom: 0, fontWeight: 650 }}>{summary.canApprove ? "Totals agree and every value is verified. Ready for specialist approval." : "Review the flagged value. Nothing will be committed yet."}</p></div><button disabled={!summary.canApprove || approved} onClick={() => setApproved(true)} style={{ alignSelf: "center", border: 0, borderRadius: 10, padding: "13px 20px", fontWeight: 800, background: summary.canApprove && !approved ? "#0b6e5b" : "#d9e2e8", color: summary.canApprove && !approved ? "#fff" : "#627d98" }}>{approved ? "Scan approved ✓" : "Approve reconciled scan"}</button></div>{approved && <p style={{ fontSize: 12, color: "#627d98", marginBottom: 0 }}>Preview approval is local only. No payroll records or payments were created.</p>}</section>
      </section>}
    </div>
  </main>;
}
