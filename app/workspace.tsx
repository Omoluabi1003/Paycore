"use client";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "./brand";
import { profileInitials } from "../lib/preview-profile";
import ActivityEntry from "./activity-entry";
import PayrollGrid from "./payroll-grid";
import type { CalculationInput, PayrollRun } from "../lib/settlements";
import PayPeriodSetup from "./pay-period-setup";
import { dateInZone, formatPeriod, periodForDate, validateSchedule } from "../lib/pay-periods";
import type { PaySchedule } from "../lib/pay-periods";
import type { GridRow } from "../lib/payroll-grid";
import { sampleContractor } from "../lib/sample-payroll";
type View = "overview" | "prepare" | "review";
type Contractor = ReturnType<typeof sampleContractor>;
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
const preparation = [
    { title: "Your pay period is selected.", label: "Pay period", next: "Check earnings", confirm: "The pay period is correct.", help: "Your saved schedule determines the period. PayCore keeps work and deductions within the selected dates." },
    { title: "Do the earnings and rates look right?", label: "Earnings", next: "Check deductions", confirm: "I have checked the sample earnings and rates.", help: "Compare each contractor’s earnings and agreed rate with your source records. Check every contractor before moving on." },
    { title: "Are the deductions accounted for?", label: "Deductions", next: "Review payroll", confirm: "I have checked the sample deductions and reimbursements.", help: "Review charges, advances, and reimbursements together. You’ll see their effect on each statement in the next step." },
];
type PeriodDraft = { inputs: CalculationInput[]; rows: GridRow[]; valid: boolean };
const scheduleKey = "paycore-preview-pay-schedule-v1";
export default function Workspace({ displayName, companyName }: { displayName: string; companyName: string }) {
    const [schedule, setSchedule] = useState<PaySchedule | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [now, setNow] = useState<Date | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
    const [storageNotice, setStorageNotice] = useState("");
    const drafts = useRef(new Map<string, { run: PayrollRun; draft: PeriodDraft }>());
    useEffect(() => {
        try { const saved = localStorage.getItem(scheduleKey); if (saved) setSchedule(validateSchedule(JSON.parse(saved))); }
        catch { setStorageNotice("Set the schedule again; the saved schedule could not be read."); }
        setLoaded(true); setNow(new Date());
        const refresh = () => setNow(new Date());
        const timer = window.setInterval(refresh, 30000);
        document.addEventListener("visibilitychange", refresh);
        return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
    }, []);
    const current = schedule && now ? periodForDate(schedule, dateInZone(now, schedule.timeZone)) : null;
    useEffect(() => { setSelectedPeriod(null); }, [current?.payPeriodId]);
    if (!loaded) return <p role="status">Loading your pay schedule…</p>;
    if (!schedule || !current) return <div className="period-setup-shell">{storageNotice && <p role="status">{storageNotice}</p>}<PayPeriodSetup onSave={next => {
        try { localStorage.setItem(scheduleKey, JSON.stringify(next)); setStorageNotice(""); }
        catch { setStorageNotice("Browser storage is unavailable. This schedule will reset on refresh."); }
        setSchedule(next); setNow(new Date());
    }} /></div>;
    const stored = selectedPeriod ? drafts.current.get(selectedPeriod) : undefined;
    const run = stored?.run ?? current;
    const initial = drafts.current.get(run.payPeriodId)?.draft ?? { inputs: [], rows: [], valid: false };
    return <><section className="period-banner" aria-label="Automatic pay schedule"><strong>{dateInZone(now!, schedule.timeZone) < current.start ? "Upcoming period" : "Current period"}: {formatPeriod(current)}</strong><span>Selected by date · {schedule.timeZone} · Repeats every {Math.round((Date.parse(schedule.end) - Date.parse(schedule.start)) / 86400000) + 1} days</span>{storageNotice && <p role="status">{storageNotice}</p>}
      <label>Payroll period<select value={run.payPeriodId} onChange={event => setSelectedPeriod(event.target.value === current.payPeriodId ? null : event.target.value)}><option value={current.payPeriodId}>{formatPeriod(current)} · current</option>{Array.from(drafts.current.values()).filter(item => item.run.payPeriodId !== current.payPeriodId).map(item => <option key={item.run.payPeriodId} value={item.run.payPeriodId}>{formatPeriod(item.run)} · earlier draft</option>)}</select></label>
      {run.payPeriodId !== current.payPeriodId && <p role="status">You’re viewing an earlier draft. Its entries stay in their original period.</p>}
    </section><PeriodWorkspace key={run.payPeriodId} displayName={displayName} companyName={companyName} run={run} initial={initial} onSnapshot={draft => drafts.current.set(run.payPeriodId, { run, draft })} /></>;
}
function PeriodWorkspace({ displayName, companyName, run, initial, onSnapshot }: { displayName: string; companyName: string; run: PayrollRun; initial: PeriodDraft; onSnapshot: (draft: PeriodDraft) => void }) {
    const period = formatPeriod(run);
    const [rows, setRows] = useState<GridRow[]>(initial.rows);
    const workspaceName = companyName || `${displayName}’s workspace`;
    const [inputs, setInputs] = useState<CalculationInput[]>(initial.inputs);
    const contractors = inputs.map(sampleContractor);
    const [view, setView] = useState<View>("overview");
    const [step, setStep] = useState(0);
    const [checked, setChecked] = useState([true, false, false]);
    const [acknowledged, setAcknowledged] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const [gridValid, setGridValid] = useState(initial.valid);
    useEffect(() => { onSnapshot({ inputs, rows, valid: gridValid }); }, [inputs, rows, gridValid, onSnapshot]);
    const hasContractors = inputs.length > 0 && gridValid;
    function updateInputs(next: CalculationInput[]) { setInputs(next); setChecked([true, false, false]); setAcknowledged(false); }
    const completed = checked.filter(Boolean).length;
    const firstIncomplete = checked.findIndex((value) => !value);
    const nextStep = firstIncomplete < 0 ? 2 : firstIncomplete;
    const total = (key: keyof Contractor["settlement"]) => contractors.reduce((sum, p) => sum + Math.round(p.settlement[key] * 100), 0) / 100;
    const gross = contractors.reduce((sum, p) => sum + Math.round(p.gross * 100), 0) / 100;
    function focusHeading() { requestAnimationFrame(() => heading.current?.focus()); }
    function navigate(next: View) { setView(next); focusHeading(); }
    function begin(at = nextStep) { setStep(at); navigate("prepare"); }
    function updateCheck(value: boolean) {
        setChecked((previous) => previous.map((old, index) => index < step ? old : index === step ? value : false));
        setAcknowledged(false);
    }
    function continuePayroll() {
        if (!hasContractors || !checked[step])
            return;
        if (step === 2)
            navigate("review");
        else {
            setStep(step + 1);
            focusHeading();
        }
    }
    const nextAction = completed === 3 ? "Review the contractor statements" : ["View the automatic pay period", "Check contractor earnings", "Check deductions & reimbursements"][nextStep];
    const summary = <PayrollSummary period={period} count={contractors.length} gross={gross} earnings={total("contractorEarnings")} deductions={total("totalDeductions")} reimbursements={total("totalReimbursements")} net={total("netPay")}/>;
    return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="sidebar" aria-label="Workspace navigation">
      <a className="brand" href="/" aria-label="PayCore home"><BrandLogo /></a>
      <div className="workspace-label"><span className="company-avatar" aria-hidden="true">{profileInitials(companyName || displayName)}</span><div>{workspaceName}<small>Demo workspace</small></div></div>
      <p className="nav-caption">YOUR WORKSPACE</p>
      <nav>
        <button className={`nav-item ${view === "overview" ? "active" : ""}`} aria-current={view === "overview" ? "page" : undefined} onClick={() => navigate("overview")}><Icon name="grid"/>Home</button>
        <button className={`nav-item ${view === "prepare" ? "active" : ""}`} aria-current={view === "prepare" ? "page" : undefined} onClick={() => begin()}><Icon name="layers"/>Run payroll</button>
        <button className={`nav-item ${view === "review" ? "active" : ""}`} aria-current={view === "review" ? "page" : undefined} onClick={() => navigate("review")}><Icon name="shield"/>Statements</button>
      </nav>
      <div className="sidebar-bottom"><div className="guide-card"><span className="guide-symbol"><Icon name="help"/></span><strong>One question.<br />One clear next step.</strong><p>Follow the guide from pay period to final review.</p><button className="guide-link" onClick={() => begin()}>Open payroll guide <Icon name="arrow" size={16}/></button></div><div className="profile"><span className="profile-avatar" aria-hidden="true">{profileInitials(displayName)}</span><div>{displayName}<small>Demo profile</small></div></div></div>
    </aside>
    <div className="workspace-main">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span><strong>{view === "overview" ? "Home" : view === "prepare" ? "Run payroll" : "Statements & review"}</strong></div><span className="demo-tag"><span />Interactive demo</span></header>
      <main id="main-content" className="content">
        <div className="page-heading"><div><p className="eyebrow">PAYROLL OPERATIONS</p><h1 ref={heading} tabIndex={-1}>{view === "overview" ? "Your payroll. A clear next step." : view === "prepare" ? preparation[step].title : "Review your payroll."}</h1><p className="page-description">{view === "overview" ? "Choose a task. We’ll guide you through the rest." : view === "prepare" ? `Step ${step + 1} of 4 · Check the sample information, then continue.` : "Check each statement before acknowledging the sample review."}</p></div><span className="period-label"><Icon name="clock" size={16}/>{period}</span></div>

        <PayrollGrid run={run} rows={rows} onRowsChange={setRows} inputs={inputs} onChange={updateInputs} onValidityChange={(valid) => { setGridValid(valid); setChecked([true, false, false]); setAcknowledged(false); }} />
        {hasContractors && <details className="detailed-activity"><summary>Add detailed loads, charges, or adjustments</summary><ActivityEntry inputs={inputs} onChange={updateInputs} /></details>}
        <div aria-live="polite">{contractors.map(person => <div key={person.reference}>{person.detail.blockers.map((issue, i) => <p className="review-warning" key={`block-${i}`}>{person.name} · Blocking issue: {issue.message}</p>)}{person.detail.warnings.map((issue, i) => <p className="review-warning" key={`warn-${i}`}>{person.name} · Review required: {issue.message}</p>)}</div>)}</div>
        {view === "overview" ? <>
          <section className="task-section" aria-labelledby="task-title"><div className="section-heading"><h2 id="task-title">What would you like to do?</h2><span className="task-hint">Start here</span></div><div className="task-grid">
            <button className="task-tile task-payroll" onClick={() => completed === 3 ? navigate("review") : begin()}><span className="task-icon"><Icon name="layers" size={24}/></span><strong>Run payroll</strong><span>Prepare this period, one step at a time.</span><span className="tile-action">{completed === 0 ? "Get started" : "Continue payroll"}<Icon name="arrow" size={18}/></span></button>
            <button className="task-tile task-statements" onClick={() => navigate("review")}><span className="task-icon"><Icon name="shield" size={24}/></span><strong>View statements</strong><span>See the earnings and charges behind each total.</span><span className="tile-action">Open statements<Icon name="arrow" size={18}/></span></button>
            <button className="task-tile task-help" aria-expanded={showHelp} aria-controls="payroll-help" onClick={() => setShowHelp((value) => !value)}><span className="task-icon"><Icon name="help" size={24}/></span><strong>How does this work?</strong><span>Get plain-language help before you begin.</span><span className="tile-action">{showHelp ? "Close guide" : "Read the guide"}<Icon name="arrow" size={18}/></span></button>
          </div></section>
          {showHelp ? <section className="panel help-panel" id="payroll-help"><h2>Your payroll, in four steps.</h2><div className="help-grid"><p><strong>1. Pay period</strong>PayCore selects the dates from your saved schedule.</p><p><strong>2. Earnings</strong>Check each contractor’s gross earnings and rate.</p><p><strong>3. Deductions</strong>Check charges and amounts being reimbursed.</p><p><strong>4. Review</strong>Open the statements and check the final totals.</p></div><p className="help-demo">This demo uses sample records. It cannot approve payroll or send payments.</p></section> : null}
          <section className="portal-welcome" aria-labelledby="welcome-title"><div><span className="welcome-label">YOUR PAYROLL DESK</span><h2 id="welcome-title">Let’s get payroll moving.</h2><p>A short guided path, with the right details at each step. You always know where you are and what comes next.</p><span className="welcome-caption"><Icon name="shield" size={16}/>Every payroll ends with a human review.</span></div><div className="welcome-art" aria-hidden="true"><div className="art-path"/><span className="art-stop stop-one"><Icon name="clock"/>Period</span><span className="art-stop stop-two"><Icon name="layers"/>Earnings</span><span className="art-stop stop-three"><Icon name="check"/>Review</span><span className="art-dot dot-one"/><span className="art-dot dot-two"/></div></section>
          <div className="home-work-grid"><section className="panel run-record"><div className="record-header"><div><p className="eyebrow">CURRENT PAYROLL</p><h2>{period}</h2><span className="record-reference">Draft · {run.start}</span></div><span className="draft-chip">Draft</span></div><div className="record-figures"><div><span>Estimated contractor pay</span><strong>{money(total("netPay"))}</strong></div><div><span>Contractors</span><strong>{contractors.length}</strong></div><div><span>Gross revenue</span><strong>{money(gross)}</strong></div></div><div className="record-status"><span><strong>{completed} of 3</strong> preparation steps complete</span><span>{completed === 3 ? "Ready for sample review" : `${3 - completed} checks remaining`}</span></div><div className="progress-track"><span style={{ width: `${completed / 3 * 100}%` }}/></div><ol className="record-steps">{["Pay period", "Earnings", "Deductions", "Review"].map((label, index) => <li key={label} className={index < 3 && checked[index] ? "complete" : ""}><span>{index < 3 && checked[index] ? <Icon name="check" size={13}/> : index + 1}</span>{label}</li>)}</ol><button className="button button-primary" onClick={() => completed === 3 ? navigate("review") : begin()}>{completed === 0 ? "Start this payroll" : completed === 3 ? "Review this payroll" : "Continue this payroll"}<Icon name="arrow" size={18}/></button></section>
          <aside className="next-action"><span className="next-kicker">UP NEXT</span><span className="next-number">{completed === 3 ? "04" : `0${nextStep + 1}`}</span><h2>{nextAction}</h2><p>{completed === 3 ? "Your preparation checks are complete. Open the statements and make sure the totals are right." : preparation[nextStep].help}</p><button className="text-link" onClick={() => completed === 3 ? navigate("review") : begin()}>Take me there<Icon name="arrow" size={17}/></button><div className="next-bottom"><Icon name="shield" size={17}/>Nothing is approved automatically.</div></aside></div>
        </> : null}

        {view === "prepare" ? <>
          <WorkflowProgress current={step} checked={checked} onSelect={(index) => { if (index === 3)
            navigate("review");
        else
            begin(index); }}/>
          <div className="guided-layout"><section className="panel question-card"><div className="question-heading"><span className="question-number">0{step + 1}</span><div><p className="eyebrow">{preparation[step].label.toUpperCase()}</p><h2>{["Automatically selected dates", "Check the people and amounts", "Check what comes out and goes back in"][step]}</h2></div><span className="subtle-chip">Sample data</span></div>
            {step === 0 ? <><div className="period-choice"><Icon name="clock" size={24}/><div><span>Selected pay period</span><strong>{period}</strong><small>{contractors.length} contractors · USD</small></div><span className="selected-label"><Icon name="check" size={14}/>Selected</span></div><div className="inline-tip"><Icon name="help" size={19}/><p>PayCore selected these dates from your saved schedule. Activity must fall within this period.</p></div></> : null}
            {step === 1 ? <><p className="question-intro">These earnings use the pay terms and activity you entered. Every contractor listed below is included.</p><ContractorTable contractors={contractors}/><div className="inline-tip"><Icon name="help" size={19}/><p>Each contractor uses their own effective pay agreement: a percentage, per-mile amount, or fixed period amount.</p></div></> : null}
            {step === 2 ? <><p className="question-intro">Check each contractor’s agreed recurring deductions, entered charges, and reimbursements. PayCore calculates the totals for you.</p><div className="table-scroll"><table><caption className="sr-only">Sample deductions and reimbursements in US dollars</caption><thead><tr><th scope="col">Contractor</th><th scope="col">Deductions</th><th scope="col">Reimbursements</th></tr></thead><tbody>{contractors.map((person) => <tr key={person.reference}><th scope="row">{person.name}</th><td>−{money(person.settlement.totalDeductions)}</td><td>+{money(person.settlement.totalReimbursements)}</td></tr>)}</tbody></table></div><div className="deduction-totals"><div><span>Total deductions</span><strong>−{money(total("totalDeductions"))}</strong></div><div><span>Total reimbursements</span><strong>+{money(total("totalReimbursements"))}</strong></div></div></> : null}
            {step !== 0 && <label className={`step-confirm ${checked[step] ? "checked" : ""}`}><input type="checkbox" disabled={!hasContractors} checked={checked[step]} onChange={(event) => updateCheck(event.target.checked)}/><span>{preparation[step].confirm}</span></label>}
            <div className="wizard-actions"><button className="text-link" onClick={() => { if (step === 0)
            navigate("overview");
        else {
            setStep(step - 1);
            focusHeading();
        } }}><span aria-hidden="true">←</span>{step === 0 ? "Back to home" : "Previous step"}</button><button className="button button-primary" disabled={!hasContractors || !checked[step]} onClick={continuePayroll}>{preparation[step].next}<Icon name="arrow" size={17}/></button></div>
          </section><aside className="guide-rail"><div className="step-guidance"><span className="section-icon"><Icon name="help" size={22}/></span><p className="eyebrow">WHY THIS STEP MATTERS</p><h2>{["The right work. The right dates.", "Make every earning count.", "Keep every charge in view."][step]}</h2><p>{preparation[step].help}</p><span className="rail-status">{completed} of 3 checks complete</span></div><details className="summary-disclosure"><summary>View payroll totals <Icon name="chevron" size={16}/></summary>{summary}</details><p className="guide-rail-note">You’re working with sample data. Checks stay in this page and reset on refresh.</p></aside></div>
        </> : null}

        {view === "review" ? <>
          <WorkflowProgress current={3} checked={checked} onSelect={(index) => { if (index < 3)
            begin(index); }}/>
          {completed !== 3 ? <div className="review-warning" role="status"><Icon name="help"/><div><strong>{3 - completed} preparation checks still need your attention.</strong><p>You can preview statements now. Complete the guide before acknowledging your review.</p></div><button className="button button-secondary" onClick={() => begin()}>Continue preparation<Icon name="arrow" size={16}/></button></div> : <div className="review-ready" role="status"><Icon name="check"/>Preparation complete. Review each statement below.</div>}
          <div className="guided-layout"><div><section className="panel review-panel"><div className="section-heading"><div><p className="eyebrow">CONTRACTOR STATEMENTS</p><h2>Here’s what each person receives.</h2></div><span className="draft-chip">Draft</span></div><p className="question-intro">Select a contractor to see the full breakdown.</p><div className="statement-list">{contractors.map((person) => <details className="statement-detail" key={person.reference}><summary><span className="person-avatar">{person.initials}</span><span className="person-name">{person.name}<small>{person.reference} · {person.methodLabel}</small></span><strong>{money(person.settlement.netPay)}</strong><Icon name="chevron" size={16}/></summary><dl className="statement-breakdown"><div><dt>Gross revenue</dt><dd>{money(person.gross)}</dd></div><div><dt>Agreed pay terms</dt><dd>{person.methodLabel}</dd></div>{person.detail.lines.map(line => <div key={line.id}><dt>{line.description}<small className="line-origin">{line.origin === "AUTOMATIC" ? `Automatic · rule ${line.ruleId}` : "Entered activity"}</small></dt><dd>{line.kind === "DEDUCTION" ? "−" : ""}{money(line.amountCents / 100)}</dd></div>)}<div><dt>Calculated contractor earnings</dt><dd>{money(person.detail.grossEarningsCents / 100)}</dd></div><div><dt>Automatic deductions</dt><dd>−{money(person.detail.automaticDeductionsCents / 100)}</dd></div><div><dt>Entered deductions</dt><dd>−{money(person.detail.manualDeductionsCents / 100)}</dd></div><div><dt>Reimbursements</dt><dd>+{money(person.detail.reimbursementsCents / 100)}</dd></div><div><dt>Adjustments</dt><dd>{money(person.detail.adjustmentsCents / 100)}</dd></div><div><dt>YTD earnings / deductions / net</dt><dd>{money(person.ytd.earningsCents / 100)} / {money(person.ytd.deductionsCents / 100)} / {money(person.ytd.netCents / 100)}<small className="line-origin">No approved history in this fictional workspace. Draft excluded.</small></dd></div><div className="breakdown-total"><dt>Estimated net pay</dt><dd>{money(person.settlement.netPay)}</dd></div></dl></details>)}</div></section><section className="panel approval-panel"><span className="section-icon"><Icon name="shield"/></span><div><h2>Finish with your review.</h2><p>Check the statements and totals. Approval is always a separate, deliberate action.</p><label className="acknowledgement"><input type="checkbox" checked={acknowledged} disabled={!hasContractors || completed !== 3 || contractors.some(p => p.detail.blockers.length > 0)} onChange={(event) => setAcknowledged(event.target.checked)}/><span>I have reviewed these sample statements and totals.</span></label><p className="demo-explanation" role="status">{acknowledged ? "Sample review acknowledged. No payroll has been approved or paid." : "Demo only. Live approval and payments are unavailable. Finish your review to see the sample download options."}</p><div className="approval-actions"><button className="text-link" onClick={() => begin()}>Back to preparation</button><button className="button button-primary" disabled>Approval unavailable in demo</button></div></div></section></div>{summary}</div>
          {acknowledged && hasContractors && completed === 3 && !contractors.some(person => person.detail.blockers.length > 0) && <section className="panel final-downloads" aria-labelledby="final-downloads-title"><h2 id="final-downloads-title">Downloads and email</h2><p>Your demo review is complete. These downloads are fixed fictional examples; they do not include the figures you entered.</p><div className="walkthrough-toolbar"><div><a href="/sample-payroll.pdf" download>Download sample PDF</a><a href="/sample-payroll.csv" download>Download sample CSV</a><a href="mailto:?subject=PayCore%20sample%20payroll%20statements&amp;body=These%20are%20fixed%20fictional%20sample%20statements%20for%20demonstration%20only%20and%20do%20not%20include%20entered%20payroll%20figures.%0A%0AAttach%20the%20downloaded%20sample%20PDF%20before%20sending.">Prepare sample email</a></div><small>Email opens your mail app. Attach the downloaded sample PDF before sending.</small></div></section>}
        </> : null}
        <footer className="workspace-footer"><a className="developer-credit" href="/welcome">Developed by <strong>ETL GIS Consulting LLC</strong></a><p>Interactive demo · Sample data only · No payroll is processed · Progress resets on refresh.</p><details><summary>About this demo</summary><p>Production authentication, authorization, saved audit history, and payment controls remain required before processing live payroll.</p></details></footer>
      </main>
    </div>
  </div>;
}
function WorkflowProgress({ current, checked, onSelect }: {
    current: number;
    checked: boolean[];
    onSelect: (index: number) => void;
}) {
    const first = checked.findIndex((value) => !value);
    const limit = first < 0 ? 3 : first;
    return <nav className="workflow-progress" aria-label="Payroll steps"><ol>{["Pay period", "Earnings", "Deductions", "Review"].map((label, index) => <li key={label} className={index === current ? "current" : index < 3 && checked[index] ? "complete" : ""}><button aria-current={index === current ? "step" : undefined} disabled={index > limit} onClick={() => onSelect(index)}><span>{index < 3 && checked[index] ? <Icon name="check" size={15}/> : index + 1}</span><strong>{label}</strong><small>{index === current ? "You are here" : index < 3 && checked[index] ? "Checked" : "Up next"}</small></button></li>)}</ol></nav>;
}
function PayrollSummary({ period, count, gross, earnings, deductions, reimbursements, net }: {
    period: string;
    count: number;
    gross: number;
    earnings: number;
    deductions: number;
    reimbursements: number;
    net: number;
}) {
    return <aside className="panel payroll-summary" aria-label="Sample payroll summary"><p className="eyebrow">PAYROLL TOTALS</p><h2>Your sample payroll.</h2><span className="summary-period">{period} · {count} contractors</span><dl><div><dt>Gross revenue</dt><dd>{money(gross)}</dd></div><div><dt>Contractor earnings</dt><dd>{money(earnings)}</dd></div><div><dt>Total deductions</dt><dd>−{money(deductions)}</dd></div><div><dt>Reimbursements</dt><dd>+{money(reimbursements)}</dd></div><div className="summary-total"><dt>Estimated net pay</dt><dd>{money(net)}</dd></div></dl><p className="summary-note"><Icon name="shield" size={18}/><span>Still a draft. Nothing is approved automatically.</span></p></aside>;
}
function ContractorTable({ contractors }: {
    contractors: Contractor[];
}) {
    return <div className="table-scroll"><table><caption className="sr-only">Contractor earnings in US dollars for the selected pay period</caption><thead><tr><th scope="col">Contractor</th><th scope="col">Gross revenue</th><th scope="col">Pay agreement</th><th scope="col">Contractor earnings</th></tr></thead><tbody>{contractors.map((person) => <tr key={person.reference}><th scope="row"><span className="person-cell"><span className="person-avatar">{person.initials}</span><span>{person.name}<small>{person.reference}</small></span></span></th><td>{money(person.gross)}</td><td>{person.methodLabel}</td><td className="net-cell">{money(person.settlement.contractorEarnings)}</td></tr>)}</tbody></table></div>;
}

