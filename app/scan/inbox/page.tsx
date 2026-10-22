import Link from "next/link";

const scans = [
  { name: "Loads_Oct_19.xlsx", meta: "142 records · $183,420.00", state: "Ready", note: "Reconciled and ready for specialist review", tone: "#e9f7f2" },
  { name: "Fuel_Report_1021.pdf", meta: "38 records · 3 matches needed", state: "Needs review", note: "Contractor matching requires attention", tone: "#fff6df" },
  { name: "September_Settlements.pdf", meta: "74 pages", state: "Scanning", note: "Reading source pages and checking totals", tone: "#eef5fb" },
  { name: "Loads_Oct_12.csv", meta: "126 records", state: "Completed", note: "Approved scan · preview record only", tone: "#f3f6f8" },
];

export default function ScanInboxPage() {
  return <main style={{minHeight:"100vh",background:"#f5f8fa",color:"#102f43",fontFamily:"var(--font-geist-sans),Arial,sans-serif"}}>
    <div style={{maxWidth:1180,margin:"0 auto",padding:"28px 22px 64px"}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap",background:"#fff",border:"1px solid #d7e2e8",borderRadius:16,padding:"14px 18px"}}>
        <Link href="/" style={{fontWeight:850,fontSize:22,color:"#102f43",textDecoration:"none"}}>PayCore</Link>
        <nav aria-label="Scan workspace" style={{display:"flex",gap:8,alignItems:"center"}}><Link href="/scan" style={{color:"#486581",fontWeight:700,textDecoration:"none",padding:"9px 12px"}}>New scan</Link><span style={{color:"#0b6e5b",fontWeight:800,background:"#e9f7f2",padding:"9px 12px",borderRadius:9}}>Scan inbox</span></nav>
      </header>

      <section style={{padding:"40px 2px 22px",display:"flex",justifyContent:"space-between",alignItems:"end",gap:24,flexWrap:"wrap"}}>
        <div><p style={{margin:0,fontSize:12,fontWeight:850,letterSpacing:".15em",color:"#0b6e5b"}}>PAYCORE SCAN</p><h1 style={{margin:"8px 0 10px",fontSize:"clamp(38px,6vw,58px)",letterSpacing:"-.05em",lineHeight:1}}>Your scan inbox.</h1><p style={{margin:0,color:"#627d98",fontSize:17,maxWidth:680,lineHeight:1.6}}>One place to see what is scanning, what is ready, and exactly what needs a payroll specialist before anything can move forward.</p></div>
        <Link href="/scan" style={{background:"#0b6e5b",color:"#fff",textDecoration:"none",fontWeight:800,padding:"13px 18px",borderRadius:10}}>Scan a document</Link>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:18}}>
        {[["4","Scans in workspace"],["1","Ready"],["1","Needs review"],["0","Silent guesses"]].map(([value,label])=><article key={label} style={{background:"#fff",border:"1px solid #d7e2e8",borderRadius:14,padding:18}}><strong style={{display:"block",fontSize:27,fontVariantNumeric:"tabular-nums"}}>{value}</strong><span style={{color:"#627d98",fontSize:13}}>{label}</span></article>)}
      </section>

      <section style={{background:"#fff",border:"1px solid #d7e2e8",borderRadius:16,overflow:"hidden"}}>
        <div style={{padding:"20px 22px",borderBottom:"1px solid #e6edf1"}}><strong style={{fontSize:18}}>Payroll scans</strong><p style={{margin:"5px 0 0",color:"#627d98",fontSize:13}}>Fictional preview queue. No production documents or payroll records are stored here yet.</p></div>
        {scans.map((scan,index)=><article key={scan.name} style={{display:"grid",gridTemplateColumns:"minmax(0,1.3fr) minmax(150px,.7fr) minmax(180px,.8fr)",gap:18,alignItems:"center",padding:"18px 22px",borderBottom:index===scans.length-1?0:"1px solid #edf2f5"}}>
          <div><strong style={{display:"block",fontSize:15}}>{scan.name}</strong><span style={{color:"#627d98",fontSize:13}}>{scan.meta}</span></div>
          <div><span style={{display:"inline-block",background:scan.tone,borderRadius:999,padding:"7px 10px",fontSize:12,fontWeight:800}}>{scan.state}</span></div>
          <div style={{color:"#526d82",fontSize:13,lineHeight:1.45}}>{scan.note}</div>
        </article>)}
      </section>

      <section style={{marginTop:18,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
        <article style={{background:"#102f43",color:"#fff",borderRadius:15,padding:20}}><small style={{opacity:.72,fontWeight:800,letterSpacing:".1em"}}>CONTROL</small><h2 style={{fontSize:19}}>Nothing posts from the inbox.</h2><p style={{opacity:.78,fontSize:13,lineHeight:1.55,marginBottom:0}}>A scan must be verified, reconciled and explicitly approved before a future production commit can create payroll activity.</p></article>
        <article style={{background:"#fff",border:"1px solid #d7e2e8",borderRadius:15,padding:20}}><small style={{color:"#0b6e5b",fontWeight:800,letterSpacing:".1em"}}>TRACEABILITY</small><h2 style={{fontSize:19}}>Every value keeps its evidence.</h2><p style={{color:"#627d98",fontSize:13,lineHeight:1.55,marginBottom:0}}>The production design retains document, page, source region, extracted value, review decision and resulting transaction lineage.</p></article>
      </section>
    </div>
  </main>;
}
