"use client";

export default function Error({reset}:{reset:()=>void}) {
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f8fa",fontFamily:"Arial,sans-serif",color:"#102f43",padding:24}}><section role="alert" style={{maxWidth:520,background:"#fff",border:"1px solid #d7e2e8",borderRadius:16,padding:26}}><strong style={{display:"block",fontSize:20}}>Scan Inbox could not open.</strong><p style={{color:"#627d98",lineHeight:1.55}}>No scan or payroll data was changed. Try opening the queue again.</p><button type="button" onClick={reset} style={{border:0,borderRadius:9,background:"#0b6e5b",color:"#fff",fontWeight:800,padding:"11px 15px",cursor:"pointer"}}>Try again</button></section></main>;
}
