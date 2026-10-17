"use client";
import { useRef, useState } from "react";
import { BrandLogo } from "./brand";
type View = "overview" | "prepare" | "review";
type Contractor = {
    name: string;
    initials: string;
    reference: string;
    gross: number;
    rate: number;
    settlement: {
        contractorEarnings: number;
        factoringCharge: number;
        totalDeductions: number;
        totalReimbursements: number;
        netPay: number;
    };
};
type IconName = "grid" | "layers" | "check" | "arrow" | "shield" | "clock" | "chevron" | "help";
const paths: Record<IconName, string> = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    layers: "m12 3 9 5-9 5-9-5 9-5z M3 12l9 5 9-5 M3 16l9 5 9-5",
    check: "m5 12 4 4L19 6", arrow: "M4 12h16 m-6-6 6 6-6 6",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3z m-4 9 3 3 5-6",
    clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    chevron: "m9 5 7 7-7 7", help: "M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};
function Icon({ name, size = 20 }: {
    name: IconName;
    size?: number;
}) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (amount: number) => currency.format(amount);
const nav: {
    view: View;
    label: string;
    icon: IconName;
}[] = [
    { view: "overview", label: "Overview", icon: "grid" },
    { view: "prepare", label: "Prepare payroll", icon: "layers" },
    { view: "review", label: "Review & approve", icon: "shield" },
];
export default function Workspace({ contractors }: {
    contractors: Contractor[];
}) {
    const [view, setView] = useState<View>("overview");
    const [checked, setChecked] = useState([false, false, false]);
    const [acknowledged, setAcknowledged] = useState(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const reviewed = checked.filter(Boolean).length;
    const total = (key: keyof Contractor["settlement"]) => contractors.reduce((sum, person) => sum + Math.round(person.settlement[key] * 100), 0) / 100;
    const gross = contractors.reduce((sum, person) => sum + Math.round(person.gross * 100), 0) / 100;
    function navigate(next: View) {
        setView(next);
        requestAnimationFrame(() => heading.current?.focus());
    }
    const title = view === "overview" ? "A clear path to payday." : view === "prepare" ? "Good payroll starts here." : "Every detail. In plain sight.";
    return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="sidebar" aria-label="Workspace navigation">
      <a className="brand" href="/" aria-label="PayCore home"><BrandLogo /></a>
      <div className="workspace-label"><span className="company-avatar">N</span><div>Northstar Logistics<small>Demo workspace</small></div></div>
      <p className="nav-caption">WORKSPACE</p>
      <nav>{nav.map((item) => <button key={item.view} onClick={() => navigate(item.view)} aria-current={view === item.view ? "page" : undefined} className={view === item.view ? "nav-item active" : "nav-item"}><Icon name={item.icon}/><span>{item.label}</span>{view === item.view ? <span className="nav-dot"/> : null}</button>)}</nav>
      <div className="sidebar-bottom"><div className="guide-card"><span className="guide-symbol"><Icon name="help"/></span><strong>A little guidance.<br />A lot of confidence.</strong><p>Take a guided tour of your next payroll.</p><button onClick={() => navigate("prepare")} className="guide-link">Explore the workflow <Icon name="arrow" size={16}/></button></div><div className="profile"><span className="profile-avatar">NL</span><div>Northstar team<small>Sample account</small></div><span className="profile-status" aria-label="Demo account"/></div></div>
    </aside>
    <div className="workspace-main">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{nav.find((item) => item.view === view)?.label}</strong></div><span className="demo-tag"><span />Interactive demo</span></header>
      <main id="main-content" className="content">
        <div className="page-heading"><div><p className="eyebrow">YOUR PAYROLL, WITH PEACE OF MIND</p><h1 ref={heading} tabIndex={-1}>{title}</h1><p className="page-description">{view === "overview" ? "Less busywork. More clarity. One thoughtful step at a time." : view === "prepare" ? "Review the sample details below. We’ll keep the next step clear." : "Know what’s included before anything is approved."}</p></div><span className="period-label"><Icon name="clock" size={16}/>Oct 5 – 18, 2026</span></div>
        {view === "overview" ? <>
          <section className="hero-card" aria-labelledby="hero-title"><div className="hero-copy"><span className="hero-status"><span />DRAFT PAYROLL</span><h2 id="hero-title">Your next payroll.<br />A little more effortless.</h2><p>Bring earnings, deductions, and your final review together in one calm workspace.</p><button className="button button-light" onClick={() => navigate("prepare")}>Prepare payroll <Icon name="arrow" size={18}/></button><small><Icon name="shield" size={14}/>You review. You stay in control.</small></div><div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="pay-preview"><div className="preview-icon"><Icon name="layers" size={23}/></div><span>Estimated contractor pay</span><strong>{money(total("netPay"))}</strong><div className="preview-divider"/><div className="preview-foot"><span>3 sample contractors</span><span className="soft-pill">Draft</span></div></div><div className="floating-note"><span><Icon name="check" size={15}/></span>Clarity at every step</div></div></section>
          <section className="metric-grid" aria-label="Sample payroll totals"><Metric label="Gross revenue" value={money(gross)} note="For the selected pay period"/><Metric label="Contractor earnings" value={money(total("contractorEarnings"))} note="Before deductions & reimbursements"/><Metric label="Estimated net pay" value={money(total("netPay"))} note="Subject to your final review" featured/><Metric label="Contractors" value="03" note="Included in this sample run"/></section>
          <div className="overview-grid"><section className="panel journey"><div className="section-heading"><div><p className="eyebrow">A SIMPLE WAY FORWARD</p><h2>From draft to done.</h2></div><span className="subtle-chip">3 steps</span></div><ol className="journey-list"><li><span className="step-number">01</span><div><h3>Get the details together</h3><p>Confirm the period, contractors, and earnings.</p></div><span className="step-label">Prepare</span></li><li><span className="step-number">02</span><div><h3>Give everything a second look</h3><p>Review deductions and each contractor’s statement.</p></div><span className="step-label">Review</span></li><li><span className="step-number">03</span><div><h3>Make it official, when you’re ready</h3><p>Explicit approval comes before finalization.</p></div><Icon name="shield" size={19}/></li></ol><button className="text-link" onClick={() => navigate("prepare")}>Let’s walk through it <Icon name="arrow" size={17}/></button></section>
          <section className="panel attention-panel"><span className="section-icon"><Icon name="shield" size={22}/></span><p className="eyebrow">BUILT AROUND YOUR REVIEW</p><h2>A thoughtful pause<br />before payday.</h2><p>Your review checklist keeps the important details in view. Nothing is finalized automatically.</p><div className="checklist-progress"><span>{reviewed} of 3 sample checks reviewed</span><div className="progress-track"><span style={{ width: `${reviewed / 3 * 100}%` }}/></div></div><button className="button button-secondary" onClick={() => navigate("prepare")}>Open checklist <Icon name="arrow" size={17}/></button></section></div>
          <section className="panel statements"><div className="section-heading"><div><p className="eyebrow">THE PEOPLE BEHIND THE NUMBERS</p><h2>This pay period.</h2></div><button className="text-link" onClick={() => navigate("review")}>View breakdown <Icon name="arrow" size={17}/></button></div><ContractorTable contractors={contractors}/></section>
        </> : null}
        {view === "prepare" ? <>
          <StepBar current={1}/><div className="work-grid"><section className="panel preparation"><div className="section-heading"><div><p className="eyebrow">01 / PREPARE</p><h2>Start with the essentials.</h2></div><span className="subtle-chip">Sample run</span></div><div className="period-box"><span>PAY PERIOD</span><strong>October 5 – 18, 2026</strong><small>Biweekly · 3 sample contractors · USD</small></div><h3 className="checklist-title">Your review checklist</h3><p className="muted">Check each item after reviewing the sample information.</p><div className="review-checklist">{[
                ["Confirm the pay period", "All sample earnings belong to October 5–18, 2026."],
                ["Review contractor rates", "Avery: 72% · Jordan: 68% · Morgan: 70%."],
                ["Review deductions & reimbursements", `${money(total("totalDeductions"))} in deductions, including a 2.5% factoring charge on gross; ${money(total("totalReimbursements"))} in reimbursements.`],
            ].map(([label, description], index) => <label className={checked[index] ? "check-row checked" : "check-row"} key={label}><input type="checkbox" checked={checked[index]} onChange={(event) => { const value = event.target.checked; setChecked((previous) => previous.map((item, position) => position === index ? value : item)); setAcknowledged(false); }}/><span><strong>{label}</strong><small>{description}</small></span></label>)}</div><div className="action-row"><span role="status">{reviewed === 3 ? "All sample checks reviewed." : `${3 - reviewed} checks left to review.`}</span><button className="button button-primary" disabled={reviewed !== 3} onClick={() => navigate("review")}>Continue to review <Icon name="arrow" size={17}/></button></div></section><Summary gross={gross} earnings={total("contractorEarnings")} deductions={total("totalDeductions")} reimbursements={total("totalReimbursements")} net={total("netPay")}/></div><section className="panel statements"><div className="section-heading"><div><p className="eyebrow">EARNINGS AT A GLANCE</p><h2>Your sample contractors.</h2></div></div><ContractorTable contractors={contractors}/></section>
        </> : null}
        {view === "review" ? <>
          <StepBar current={2}/><div className="work-grid"><div><section className="panel review-panel"><div className="section-heading"><div><p className="eyebrow">02 / REVIEW</p><h2>Here’s how it adds up.</h2></div><span className="subtle-chip">Draft · USD</span></div><p className="muted">Open a sample statement to see the earnings, charges, and reimbursements behind each total.</p><div className="statement-list">{contractors.map((person) => <details className="statement-detail" key={person.reference}><summary><span className="person-avatar">{person.initials}</span><span className="person-name">{person.name}<small>{person.reference} · {person.rate}% contractor rate</small></span><strong>{money(person.settlement.netPay)}</strong><Icon name="chevron" size={16}/></summary><dl className="statement-breakdown"><div><dt>Gross revenue</dt><dd>{money(person.gross)}</dd></div><div><dt>Contractor earnings ({person.rate}%)</dt><dd>{money(person.settlement.contractorEarnings)}</dd></div><div><dt>Factoring (2.5% of gross)</dt><dd>−{money(person.settlement.factoringCharge)}</dd></div><div><dt>Other deductions</dt><dd>−{money(person.settlement.totalDeductions - person.settlement.factoringCharge)}</dd></div><div><dt>Reimbursements</dt><dd>+{money(person.settlement.totalReimbursements)}</dd></div><div className="breakdown-total"><dt>Estimated net pay</dt><dd>{money(person.settlement.netPay)}</dd></div></dl></details>)}</div></section><section className="panel approval-panel"><span className="section-icon"><Icon name="shield"/></span><div><h2>Your approval is always a separate step.</h2><p>{reviewed === 3 ? "The sample checklist is complete. Review the breakdown before acknowledging it below." : "Complete all three preparation checks before acknowledging this review."}</p><label className="acknowledgement"><input type="checkbox" checked={acknowledged} disabled={reviewed !== 3} onChange={(event) => setAcknowledged(event.target.checked)}/><span>I have reviewed these sample statements and totals.</span></label><p className="demo-explanation" role="status">{acknowledged ? "Sample review acknowledged. No payroll has been approved or paid." : "Demo only. Approval, payments, and exports are unavailable."}</p><div className="approval-actions"><button className="text-link" onClick={() => navigate("prepare")}>Back to preparation</button><button className="button button-primary" disabled>Approval unavailable in demo</button></div></div></section></div><Summary gross={gross} earnings={total("contractorEarnings")} deductions={total("totalDeductions")} reimbursements={total("totalReimbursements")} net={total("netPay")}/></div>
        </> : null}
        <footer className="workspace-footer"><a className="developer-credit" href="/welcome">Developed by <strong>ETL GIS Consulting LLC</strong></a><span><Icon name="shield" size={15}/>Designed for a careful review.</span><p>Illustrative demo data. Changes stay in this page and reset on refresh. No real payroll is processed.</p><details><summary>About this demo</summary><p>This preview demonstrates the operator experience. Production authentication, authorization, saved audit history, and payment controls remain required before processing live payroll.</p></details></footer>
      </main>
    </div>
  </div>;
}
function Metric({ label, value, note, featured = false }: {
    label: string;
    value: string;
    note: string;
    featured?: boolean;
}) {
    return <article className={featured ? "metric featured" : "metric"}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}
function StepBar({ current }: {
    current: number;
}) {
    return <ol className="step-bar" aria-label="Payroll workflow">{["Prepare details", "Review statements", "Approve payroll"].map((label, index) => <li key={label} className={index + 1 === current ? "current" : index + 1 < current ? "complete" : ""} aria-current={index + 1 === current ? "step" : undefined}><span>{index + 1 < current ? <Icon name="check" size={15}/> : `0${index + 1}`}</span>{label}{index < 2 ? <i /> : null}</li>)}</ol>;
}
function Summary({ gross, earnings, deductions, reimbursements, net }: {
    gross: number;
    earnings: number;
    deductions: number;
    reimbursements: number;
    net: number;
}) {
    return <aside className="panel payroll-summary" aria-label="Sample payroll summary"><p className="eyebrow">YOUR PAYROLL AT A GLANCE</p><h2>One clear picture.</h2><span className="summary-period">Oct 5 – 18, 2026 · 3 contractors</span><dl><div><dt>Gross revenue</dt><dd>{money(gross)}</dd></div><div><dt>Contractor earnings</dt><dd>{money(earnings)}</dd></div><div><dt>Total deductions</dt><dd>−{money(deductions)}</dd></div><div><dt>Reimbursements</dt><dd>+{money(reimbursements)}</dd></div><div className="summary-total"><dt>Estimated net pay</dt><dd>{money(net)}</dd></div></dl><p className="summary-note"><Icon name="shield" size={18}/><span>Still a draft. Nothing moves forward without an explicit approval.</span></p></aside>;
}
function ContractorTable({ contractors }: {
    contractors: Contractor[];
}) {
    return <div className="table-scroll"><table><caption className="sr-only">Illustrative contractor settlements for October 5–18, 2026, in US dollars</caption><thead><tr><th scope="col">Contractor</th><th scope="col">Gross revenue</th><th scope="col">Rate</th><th scope="col">Estimated net</th><th scope="col">Status</th></tr></thead><tbody>{contractors.map((person) => <tr key={person.reference}><th scope="row"><span className="person-cell"><span className="person-avatar">{person.initials}</span><span>{person.name}<small>{person.reference}</small></span></span></th><td>{money(person.gross)}</td><td>{person.rate}%</td><td className="net-cell">{money(person.settlement.netPay)}</td><td><span className="draft-chip"><span />Draft</span></td></tr>)}</tbody></table></div>;
}
