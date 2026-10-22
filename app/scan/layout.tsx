import Link from "next/link";

export default function ScanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>
    <nav aria-label="PayCore Scan workspace" style={{position:"sticky",top:0,zIndex:40,display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,padding:"10px clamp(16px,4vw,32px)",background:"rgba(255,255,255,.96)",borderBottom:"1px solid #dfe7eb",backdropFilter:"blur(12px)",fontFamily:"var(--font-geist-sans),Arial,sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <Link href="/" style={{fontWeight:850,color:"#102f43",textDecoration:"none",marginRight:12}}>PayCore</Link>
        <Link href="/scan" style={{padding:"8px 11px",borderRadius:9,color:"#0b6e5b",textDecoration:"none",fontWeight:750}}>Scan</Link>
        <Link href="/scan/inbox" style={{padding:"8px 11px",borderRadius:9,color:"#486581",textDecoration:"none",fontWeight:700}}>Scan Inbox</Link>
      </div>
      <Link href="/" style={{fontSize:13,color:"#486581",textDecoration:"none",fontWeight:700}}>Back to workspace</Link>
    </nav>
    {children}
  </>;
}
