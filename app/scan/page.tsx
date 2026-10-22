"use client";

import { useMemo, useState } from "react";
import { reconcileScan, summarizeScan, type ScanCandidateRecord } from "../../lib/payroll-scan";

const sampleRecords: ScanCandidateRecord[] = [
  { id: "10584", documentId: "demo", contractorId: "james", reference: "Load 10584", amountCents: 245000, sourceFieldIds: ["f1"], state: "VERIFIED", issues: [] },
  { id: "10591", documentId: "demo", contractorId: "james", reference: "Load 10591", amountCents: 187500, sourceFieldIds: ["f2"], state: "VERIFIED", issues: [] },
  { id: "fuel", documentId: "demo", contractorId: "james", reference: "Fuel", category: "FUEL", amountCents: -42500, sourceFieldIds: ["f3"], state: "VERIFIED", issues: [] },
  { id: "advance", documentId: "demo", contractorId: "james", reference: "F/ADV", category: "CASH_ADVANCE", amountCents: -20000, sourceFieldIds: ["f4"], state: "NEEDS_REVIEW", issues: ["Confirm that F/ADV means cash advance recovery."] }
];

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function ScanPage() {
  const [records, setRecords] = useState<ScanCandidateRecord[]>(sampleRecords);
  const [scanned, setScanned] = useState(false);
  const [approved, setApproved] = useState(false);
  const sourceTotalCents = 370000;
  const reconciliation = useMemo(() => reconcileScan(records, sourceTotalCents), [records]);
  const summary = useMemo(() => summarizeScan(records, reconciliation), [records, reconciliation]);

  function verifyAdvance() {
    setRecords((current) => current.map((record) => record.id === "advance" ? { ...record, state: "VERIFIED", issues: [] } : record));
    setApproved(false);
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px", fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}>
      <p style={{ fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>PayCore Scan</p>
      <h1 style={{ fontSize: 42, margin: "8px 0" }}>Scan payroll documents</h1>
      <p style={{ maxWidth: 700, color: "#52606d", lineHeight: 1.6 }}>Scan it. Verify it. PayCore does the data entry. Uncertain financial values stop for review before anything can become payroll data.</p>

      <section style={{ marginTop: 32, padding: 28, border: "1px solid #d9e0e6", borderRadius: 12 }}>
        {!scanned ? <>
          <h2>Drop a payroll document here</h2>
          <p>PDF, scanned PDF, photo, CSV or Excel</p>
          <button onClick={() => setScanned(true)} style={{ padding: "12px 18px", fontWeight: 700, cursor: "pointer" }}>Try fictional scan</button>
          <p style={{ fontSize: 13, color: "#667085", marginTop: 16 }}>This preview uses fictional data. Production OCR and private document storage remain intentionally disconnected until the secure scanning backend is ready.</p>
        </> : <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div><strong>Scan complete</strong><p>4 records found in Fictional_Weekly_Settlement.pdf</p></div>
            <div><strong>{summary.verified} verified</strong><p>{summary.needsReview} needs your attention</p></div>
          </div>

          <div style={{ overflowX: "auto", marginTop: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #d9e0e6" }}><th style={{ padding: 10 }}>Source</th><th>PayCore read</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{records.map((record) => <tr key={record.id} style={{ borderBottom: "1px solid #edf0f2" }}>
                <td style={{ padding: 10 }}>{record.reference}</td><td>{record.category ?? "Load revenue"}</td><td>{money(record.amountCents ?? 0)}</td><td>{record.state === "VERIFIED" ? "Verified" : record.state === "UNREADABLE" ? "Could not read" : "Needs your attention"}</td>
                <td>{record.id === "advance" && record.state !== "VERIFIED" ? <button onClick={verifyAdvance}>Confirm cash advance</button> : ""}</td>
              </tr>)}</tbody>
            </table>
          </div>

          <section style={{ marginTop: 24, padding: 20, background: "#f7f8fa", borderRadius: 10 }}>
            <strong>Reconciliation</strong>
            <p>Source total: {money(sourceTotalCents)} · PayCore extracted: {money(reconciliation.extractedTotalCents)} · Difference: {money(reconciliation.differenceCents ?? 0)}</p>
            <p>{summary.canApprove ? "Verified and reconciled. Ready for specialist approval." : "Review required. Nothing will be committed yet."}</p>
            <button disabled={!summary.canApprove || approved} onClick={() => setApproved(true)} style={{ padding: "12px 18px", fontWeight: 700 }}>{approved ? "Scan approved" : "Approve scan"}</button>
            {approved ? <p style={{ fontSize: 13, color: "#52606d" }}>Preview approval recorded locally only. No payroll records or payments were created.</p> : null}
          </section>
        </>}
      </section>
    </main>
  );
}
