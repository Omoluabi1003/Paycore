export default function Loading() {
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f8fa",fontFamily:"Arial,sans-serif",color:"#102f43"}}><div role="status" aria-live="polite" style={{textAlign:"center"}}><strong style={{display:"block",fontSize:20}}>Opening Scan Inbox…</strong><span style={{display:"block",marginTop:8,color:"#627d98",fontSize:13}}>Preparing the document review queue.</span></div></main>;
}
