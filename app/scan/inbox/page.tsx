import Link from "next/link";
import "./scan-inbox.css";

const scans = [
  { name: "Loads_Oct_19.xlsx", meta: "142 records · $183,420.00", state: "Ready", note: "Reconciled and ready for specialist review", tone: "ready" },
  { name: "Fuel_Report_1021.pdf", meta: "38 records · 3 matches needed", state: "Needs review", note: "Contractor matching requires attention", tone: "review" },
  { name: "September_Settlements.pdf", meta: "74 pages", state: "Scanning", note: "Reading source pages and checking totals", tone: "scanning" },
  { name: "Loads_Oct_12.csv", meta: "126 records", state: "Completed", note: "Approved scan record", tone: "complete" },
];

function BackgroundPhoto(){return <div className="inbox-photo" aria-hidden="true"><div className="photo-desk"><div className="photo-laptop"><span className="photo-bar"/><span/><span/><span/></div><div className="photo-paper paper-a"><b>PAYROLL</b><i/><i/><i/><strong>$183,420</strong></div><div className="photo-paper paper-b"><b>LOAD REPORT</b><i/><i/><i/><i/></div><div className="photo-phone"><span/><span/><span/></div><div className="photo-hand"/></div></div>}

export default function ScanInboxPage() {
  return <main className="inbox-page">
    <BackgroundPhoto/><div className="inbox-grid" aria-hidden="true"/><div className="inbox-orb inbox-orb-a" aria-hidden="true"/><div className="inbox-orb inbox-orb-b" aria-hidden="true"/>
    <div className="inbox-shell">
      <header className="inbox-header"><Link href="/" className="inbox-brand">PayCore</Link><nav aria-label="Scan workspace"><Link href="/scan">New scan</Link><span>Scan inbox</span></nav></header>
      <section className="inbox-hero"><div><p className="inbox-kicker">PAYCORE SCAN</p><h1>Your scan inbox.</h1><p>A focused command center for documents entering payroll. See what is ready, isolate what needs attention, and move only verified data forward.</p><div className="hero-proof"><span>4 documents</span><span>1 review item</span><span>0 silent guesses</span></div></div><Link href="/scan" className="inbox-cta">Scan a document <b>↗</b></Link></section>
      <section className="inbox-stats">{[["4","In workspace","Documents currently moving through Scan"],["1","Ready","Reconciled and ready to review"],["1","Needs review","One decision requires a specialist"],["0","Silent guesses","Ambiguity never moves forward unseen"]].map(([value,label,copy])=><article key={label}><small>{label}</small><strong>{value}</strong><p>{copy}</p></article>)}</section>
      <section className="inbox-queue"><div className="queue-heading"><div><p className="inbox-kicker">DOCUMENT FLOW</p><strong>Payroll scans</strong></div><span>LIVE WORKSPACE · SPECIALIST CONTROLLED</span></div>{scans.map((scan,index)=><article className="scan-row" key={scan.name}><div className="scan-file"><span className="file-icon">▤</span><div><strong>{scan.name}</strong><small>{scan.meta}</small></div></div><div><span className={`status ${scan.tone}`}><i/>{scan.state}</span></div><p>{scan.note}</p><span className="row-action">{scan.tone==="review"?"Review →":scan.tone==="ready"?"Open →":"View →"}</span><span className="row-index">0{index+1}</span></article>)}</section>
      <section className="inbox-controls"><article><small>CONTROL</small><h2>Nothing posts from the inbox.</h2><p>A scan must be verified, reconciled and explicitly approved before it can create payroll activity.</p></article><article><small>TRACEABILITY</small><h2>Every value keeps its evidence.</h2><p>Document, source location, extracted value, review decision and transaction lineage stay connected.</p></article></section>
    </div>
  </main>;
}
