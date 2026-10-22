import Link from "next/link";

export default function NotFound() {
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f8fa",fontFamily:"Arial,sans-serif",color:"#102f43",padding:24}}><section style={{maxWidth:520,background:"#fff",border:"1px solid #d7e2e8",borderRadius:16,padding:26}}><strong style={{display:"block",fontSize:20}}>That scan is not available.</strong><p style={{color:"#627d98",lineHeight:1.55}}>Return to the Scan Inbox. No payroll data was changed.</p><Link href="/scan/inbox" style={{display:"inline-block",borderRadius:9,background:"#0b6e5b",color:"#fff",fontWeight:800,padding:"11px 15px",textDecoration:"none"}}>Back to Scan Inbox</Link></section></main>;
}
