const metrics = [
  { label: "Payroll status", value: "Ready to start", note: "No blocking issues" },
  { label: "Active contractors", value: "12", note: "2 need profile review" },
  { label: "Current gross", value: "$48,260.00", note: "Illustrative demo data" },
  { label: "Projected net", value: "$31,884.42", note: "Before approval" },
];

const steps = [
  ["1", "Choose pay period", "Confirm the dates you want to process."],
  ["2", "Review activity", "Check loads, earnings, expenses and deductions."],
  ["3", "Resolve warnings", "PayCore explains anything that needs attention."],
  ["4", "Preview payroll", "See exactly what each contractor will receive."],
  ["5", "Approve & export", "Lock the run and generate settlement statements."],
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">P</span><span>PayCore</span></div>
        <nav>
          {['Overview','Contractors','Loads','Expenses','Payroll','Statements','Reports'].map((item, i) => (
            <a className={i === 0 ? 'active' : ''} href="#" key={item}>{item}</a>
          ))}
        </nav>
        <div className="sidebarBottom">
          <a href="#">Settings</a><a href="#">Audit history</a>
          <div className="secure"><span>●</span> Protected workspace</div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">PAYROLL OPERATIONS</p><h1>Good afternoon.</h1><p className="muted">Everything you need to prepare payroll, in one place.</p></div>
          <button className="primary">Start payroll</button>
        </header>

        <div className="notice"><strong>Safety check:</strong> PayCore will never finalize payroll without a review and explicit approval.</div>

        <section className="metrics">
          {metrics.map((m) => <article className="card" key={m.label}><p>{m.label}</p><h2>{m.value}</h2><small>{m.note}</small></article>)}
        </section>

        <section className="grid">
          <article className="panel workflow">
            <div className="panelHead"><div><p className="eyebrow">GUIDED WORKFLOW</p><h2>Run payroll without guesswork</h2></div><span className="pill">Draft</span></div>
            <div className="steps">
              {steps.map(([n,title,text]) => <div className="step" key={n}><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}
            </div>
            <button className="primary wide">Begin guided payroll</button>
          </article>

          <article className="panel attention">
            <p className="eyebrow">NEEDS ATTENTION</p><h2>2 items to review</h2>
            <div className="issue"><span>!</span><div><strong>Missing contractor rate</strong><p>One contractor cannot be calculated until a rate is added.</p></div></div>
            <div className="issue"><span>!</span><div><strong>Possible duplicate load</strong><p>Two records share the same load number. Confirm before payroll.</p></div></div>
            <button className="secondary wide">Review issues</button>
          </article>
        </section>

        <section className="panel recent">
          <div className="panelHead"><div><p className="eyebrow">RECENT PAYROLL</p><h2>Payroll history</h2></div><button className="textButton">View all</button></div>
          <div className="table"><div className="tr th"><span>Pay period</span><span>Contractors</span><span>Gross</span><span>Net payroll</span><span>Status</span></div>
          <div className="tr"><span>Sep 21 – Oct 4</span><span>12</span><span>$46,920.00</span><span>$30,742.16</span><span className="paid">Paid</span></div>
          <div className="tr"><span>Sep 7 – Sep 20</span><span>11</span><span>$43,510.00</span><span>$28,906.72</span><span className="paid">Paid</span></div></div>
        </section>
        <p className="demo">Demo interface. Financial values shown here are illustrative and are not production payroll records.</p>
      </section>
    </main>
  );
}