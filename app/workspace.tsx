"use client";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "./brand";
import { profileInitials } from "../lib/preview-profile";
import { GuidedWalkthrough } from "./guided-walkthrough";
import { PresentationGuide, ExhibitReset } from "./exhibit-controls";
import { demoDraftKeys } from "../lib/exhibit-controls";
import ExhibitOnboarding from "./exhibit-onboarding";
import ExhibitStatement from "./exhibit-statement";
import { continueExhibit } from "../lib/exhibit-journey";
import DraftRecovery from "./draft-recovery";
import type { DraftCorrection } from "../lib/activity-register";
import { calculateGridRow } from "../lib/payroll-grid";
import ActivityEntry from "./activity-entry";
import PayrollGrid from "./payroll-grid";
import DemoCompletion from "./demo-completion";
import DemoAdvance from "./demo-advance";
import FactoringPlan from "./factoring-plan";
import WorkbookPayroll, { FuelCheck } from "./workbook-payroll";
import type { DemoApproval } from "../lib/demo-payroll";
import { yearToDate } from "../lib/settlements";
import type { CalculationInput, PayrollRun } from "../lib/settlements";
import PayPeriodSetup from "./pay-period-setup";
import { dateInZone, formatPeriod, periodForDate, validateSchedule, workingPeriod, nextPayPeriod } from "../lib/pay-periods";
import type { PaySchedule } from "../lib/pay-periods";
import { emptyGridRow } from "../lib/payroll-grid";
import OperationsCenter from "./operations-center";
import type { OperationsView } from "./operations-center";
import type { GridRow } from "../lib/payroll-grid";
import { sampleContractor } from "../lib/sample-payroll";
type View = OperationsView | "prepare" | "review";
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
    { title: "Your pay period is selected.", label: "Pay period", next: "Check earnings", confirm: "The pay period is correct.", help: "Your chosen period stays selected. PayCore calculates the next dates from your saved schedule." },
    { title: "Do the earnings and rates look right?", label: "Earnings", next: "Check deductions", confirm: "I have checked the sample earnings and rates.", help: "Compare each contractor’s earnings and agreed rate with your source records. Check every contractor before moving on." },
    { title: "Are the deductions accounted for?", label: "Deductions", next: "Review payroll", confirm: "I have checked the sample deductions and reimbursements.", help: "Review charges, advances, and reimbursements together. You’ll see their effect on each statement in the next step." },
];
type PeriodDraft = { inputs: CalculationInput[]; rows: GridRow[]; valid: boolean; corrections?: DraftCorrection[]; demo?: DemoApproval | null };
const scheduleKey = "paycore-preview-pay-schedule-v1";
export default function Workspace({ displayName, companyName }: { displayName: string; companyName: string }) {
    const [presenting, setPresenting] = useState(false), [tourStage, setTourStage] = useState(0), [resetEpoch, setResetEpoch] = useState(0);
    const [schedule, setSchedule] = useState<PaySchedule | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [now, setNow] = useState<Date | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<PayrollRun | null>(null);
    const [storageNotice, setStorageNotice] = useState("");
    const [journeyNotice, setJourneyNotice] = useState("");
    const drafts = useRef(new Map<string, { run: PayrollRun; draft: PeriodDraft }>());
    useEffect(() => {
        try {
            const saved = localStorage.getItem(scheduleKey);
            if (saved) {
                const raw = JSON.parse(saved), restored = validateSchedule(raw);
                setSchedule(restored);
                try { setSelectedPeriod(workingPeriod(restored, raw.workingStart ?? restored.start)); }
                catch { setSelectedPeriod(workingPeriod(restored)); }
            }
        }
        catch { setStorageNotice("Set the schedule again; the saved schedule could not be read."); }
        setLoaded(true); setNow(new Date());
        const refresh = () => setNow(new Date());
        const timer = window.setInterval(refresh, 30000);
        document.addEventListener("visibilitychange", refresh);
        return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
    }, []);
    function resetExhibit(keepSchedule: boolean) {
        try {
            const keys = demoDraftKeys(Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)!).filter(Boolean), JSON.stringify([displayName, companyName]));
            for (const key of keys) sessionStorage.removeItem(key);
            if (!keepSchedule) localStorage.removeItem(scheduleKey);
            else if (schedule) localStorage.setItem(scheduleKey, JSON.stringify({ ...schedule, workingStart: schedule.start }));
        } catch { setStorageNotice("Reset could not finish. Current entries were kept, but some saved copies may have been removed."); return; }
        drafts.current.clear(); setResetEpoch(value => value + 1); setPresenting(false); setTourStage(0); setJourneyNotice("Demo exhibit restarted. No production records were changed."); setStorageNotice("");
        if (!keepSchedule) { setSchedule(null); setSelectedPeriod(null); } else if (schedule) setSelectedPeriod(workingPeriod(schedule));
    }
    const current = schedule && now ? periodForDate(schedule, dateInZone(now, schedule.timeZone)) : null;
    if (!loaded) return <p role="status">Loading your pay schedule…</p>;
    if (!schedule || !current) return <div className="period-setup-shell">{storageNotice && <p role="status">{storageNotice}</p>}<PayPeriodSetup onSave={next => {
        try { localStorage.setItem(scheduleKey, JSON.stringify({ ...next, workingStart: next.start })); setStorageNotice(""); }
        catch { setStorageNotice("Browser storage is unavailable. This schedule will reset on refresh."); }
        setSchedule(next); setSelectedPeriod(workingPeriod(next)); setNow(new Date());
    }} /></div>;
    const run = selectedPeriod ?? workingPeriod(schedule);
    const next = nextPayPeriod(schedule, run);
    const initial = drafts.current.get(run.payPeriodId)?.draft ?? { inputs: [], rows: [], valid: false };
    const options = new Map([workingPeriod(schedule), current, next, ...Array.from(drafts.current.values()).map(item => item.run), run].map(period => [period.payPeriodId, period]));
    function selectPeriod(period: PayrollRun) {
        const previous = drafts.current.get(run.payPeriodId)?.draft;
        const destination = drafts.current.get(period.payPeriodId)?.draft;
        if (period.payPeriodId === next.payPeriodId && previous?.demo && !destination?.rows.length && !destination?.demo) {
            try { const carried = continueExhibit(previous.inputs, previous.rows, previous.demo, period); drafts.current.set(period.payPeriodId, { run: period, draft: carried }); setJourneyNotice("New period opened: agreements and remaining advances retained. Loads, fuel checks and one-time entries start blank. Select factoring loads again for this period."); }
            catch (error) { setJourneyNotice(error instanceof Error ? error.message : "Check the exhibit before continuing."); return; }
        } else setJourneyNotice("");
        setSelectedPeriod(period);
        try { localStorage.setItem(scheduleKey, JSON.stringify({ ...schedule, workingStart: period.start })); setStorageNotice(""); }
        catch { setStorageNotice("Browser storage is unavailable. Your selected period will reset on refresh."); }
    }
    return <><section className="period-banner" aria-label="Pay schedule"><strong>Working period: {formatPeriod(run)}</strong><span>{schedule.timeZone} · Repeats every {Math.round((Date.parse(schedule.end) - Date.parse(schedule.start)) / 86400000) + 1} days</span>{storageNotice && <p role="status">{storageNotice}</p>}
      <label>Payroll period<select aria-label="Payroll period" value={run.payPeriodId} onChange={event => { const chosen = options.get(event.target.value); if (chosen) selectPeriod(chosen); }}>{Array.from(options.values()).sort((a, b) => a.start.localeCompare(b.start)).map(period => <option key={period.payPeriodId} value={period.payPeriodId}>{formatPeriod(period)}{period.payPeriodId === run.payPeriodId ? " · working" : period.payPeriodId === current.payPeriodId ? " · current by date" : ""}</option>)}</select></label>
      <button type="button" className="button button-secondary" onClick={() => selectPeriod(next)}>Open next period</button>
      <ExhibitReset onReset={resetExhibit} />
      <details className="period-schedule-details"><summary>Schedule details</summary><p>Next period: {formatPeriod(next)}. Your working period stays selected until you change it.</p>{run.payPeriodId !== current.payPeriodId && <p>Current period by date: {formatPeriod(current)}. Your entries remain in the working period above.</p>}</details>
    </section>{journeyNotice && <p className="exhibit-continuity" role="status">{journeyNotice}</p>}<PeriodWorkspace key={`${run.payPeriodId}:${resetEpoch}`} presenting={presenting} tourStage={tourStage} onPresent={setPresenting} onTourStage={setTourStage} onNextExhibit={() => { selectPeriod(next); setTourStage(1); }} displayName={displayName} companyName={companyName} run={run} initial={initial} onSnapshot={draft => drafts.current.set(run.payPeriodId, { run, draft })} /></>;
}
function PeriodWorkspace({ displayName, companyName, run, initial, onSnapshot, presenting, tourStage, onPresent, onTourStage, onNextExhibit }: { presenting: boolean; tourStage: number; onPresent: (value: boolean) => void; onTourStage: (value: number) => void; onNextExhibit: () => void; displayName: string; companyName: string; run: PayrollRun; initial: PeriodDraft; onSnapshot: (draft: PeriodDraft) => void }) {
    const period = formatPeriod(run);
    const [rows, setRows] = useState<GridRow[]>(initial.rows);
    const [walkthrough, setWalkthrough] = useState<number | null>(null);
    const [portalRequest, setPortalRequest] = useState(0);
    const [showSetup, setShowSetup] = useState(false);
    const [corrections, setCorrections] = useState<DraftCorrection[]>(initial.corrections ?? []);
    const workspaceName = companyName || `${displayName}’s workspace`;
    const [inputs, setInputs] = useState<CalculationInput[]>(initial.inputs);
    const [demo, setDemo] = useState<DemoApproval | null>(initial.demo ?? null);
    const contractors = inputs.map(input => {
        const person = sampleContractor(input), snapshot = demo?.snapshots.find(item => item.contractorId === input.contractor.id);
        return snapshot ? { ...person, detail: snapshot, ytd: yearToDate([...(input.history ?? []), ...demo!.snapshots], run.companyId, input.contractor.id, run.end), settlement: { ...person.settlement, contractorEarnings: snapshot.grossEarningsCents / 100, totalDeductions: (snapshot.automaticDeductionsCents + snapshot.manualDeductionsCents) / 100, totalReimbursements: snapshot.reimbursementsCents / 100, netPay: snapshot.netSettlementCents / 100 } } : person;
    });
    const [view, setView] = useState<View>(initial.demo ? "review" : "overview");
    const [step, setStep] = useState(0);
    const [checked, setChecked] = useState(initial.demo ? [true, true, true] : [true, false, false]);
    const [acknowledged, setAcknowledged] = useState(Boolean(initial.demo));
    const [activityRequest, setActivityRequest] = useState<{ action: "Load" | "Deduction"; serial: number } | null>(null);
    const activityDetails = useRef<HTMLDetailsElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const [gridValid, setGridValid] = useState(initial.valid);
    useEffect(() => { onSnapshot({ inputs, rows, valid: gridValid, demo, corrections }); }, [inputs, rows, gridValid, demo, corrections, onSnapshot]);
    const hasContractors = inputs.length > 0 && gridValid;
    function updateInputs(next: CalculationInput[]) { if (demo) return; setInputs(next); setChecked([true, false, false]); setAcknowledged(false); }
    const completed = checked.filter(Boolean).length;
    const firstIncomplete = checked.findIndex((value) => !value);
    const nextStep = firstIncomplete < 0 ? 2 : firstIncomplete;
    const total = (key: keyof Contractor["settlement"]) => contractors.reduce((sum, p) => sum + Math.round(p.settlement[key] * 100), 0) / 100;
    const gross = contractors.reduce((sum, p) => sum + Math.round(p.gross * 100), 0) / 100;
    function focusHeading() { requestAnimationFrame(() => heading.current?.focus()); }
    function navigate(next: View) { setView(next); focusHeading(); }
    function begin(at = nextStep) { setStep(at); navigate("prepare"); }
    function editContractor(id: string) {
        setStep(1); navigate("prepare");
        requestAnimationFrame(() => { const index = rows.findIndex(row => row.id === id); const cell = document.querySelector<HTMLElement>(`[data-cell="${Math.max(0, index)}-0"]`); cell?.scrollIntoView({ block: "center", behavior: "smooth" }); cell?.focus(); });
    }
    function addContractor() {
        if (demo) return;
        const id = crypto.randomUUID(); setRows(previous => [...previous, emptyGridRow(id)]); setGridValid(false); setChecked([true, false, false]); setAcknowledged(false);
        setStep(1); navigate("prepare");
        requestAnimationFrame(() => { const cell = document.querySelector<HTMLElement>(`[data-cell="${rows.length}-0"]`); cell?.scrollIntoView({ block: "center" }); cell?.focus(); });
    }
    function openActivity(action: "Load" | "Deduction") {
        if (demo || !hasContractors) return;
        setStep(1); navigate("prepare"); setActivityRequest({ action, serial: Date.now() });
        requestAnimationFrame(() => { if (activityDetails.current) { activityDetails.current.open = true; activityDetails.current.scrollIntoView({ block: "start", behavior: "smooth" }); } });
    }
    function updateCheck(value: boolean) {
        if (demo) return;
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
    const summary = <PayrollSummary demoStatus={demo?.status} period={period} count={contractors.length} gross={gross} earnings={total("contractorEarnings")} deductions={total("totalDeductions")} reimbursements={total("totalReimbursements")} net={total("netPay")}/>;
    function revealPresentation(selector: string) {
        requestAnimationFrame(() => {
            const section = document.querySelector<HTMLElement>(selector);
            const target = section?.querySelector<HTMLElement>("h2") ?? section;
            if (target) { target.tabIndex = -1; target.scrollIntoView({ block: "center", behavior: "instant" }); target.focus({ preventScroll: true }); }
        });
    }
    function guideStage(stage: number) {
        onPresent(false); setWalkthrough(stage);
        if (stage === 0) { if (!demo) setShowSetup(true); }
        else { setShowSetup(false); if (stage === 1) begin(1); else navigate(stage === 2 ? "exceptions" : "review"); }
    }
    function presentStage(stage: number) {
        if (stage === 0) { if (!demo) setShowSetup(true); }
        else if (stage === 1) begin(1);
        else if (stage === 2) navigate("exceptions");
        else if (stage === 3) navigate("review");
        else if (stage === 4) navigate("review");
        else if (stage === 5) { navigate("review"); setPortalRequest(value => value + 1); }
        else if (stage === 6 && demo) onNextExhibit();
        const targets = [".exhibit-onboarding", ".payroll-sheet", ".exception-workbench", ".exhibit-statement", ".demo-completion", ".exhibit-statement", ".presentation-guide"];
        revealPresentation(targets[stage]);
    }
    return <div className={`app-shell ${presenting ? "presentation-mode" : ""}`}>
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
      <nav aria-label="Payroll records">
        {(["contractors", "activity", "exceptions"] as const).map(item => <button key={item} className={`nav-item ${view === item ? "active" : ""}`} aria-current={view === item ? "page" : undefined} onClick={() => navigate(item)}><Icon name={item === "contractors" ? "grid" : item === "activity" ? "layers" : "help"}/>{item === "contractors" ? "Contractors" : item === "activity" ? "Activity register" : "Exceptions"}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="guide-card"><span className="guide-symbol"><Icon name="help"/></span><strong>One question.<br />One clear next step.</strong><p>Follow the guide from pay period to final review.</p><button className="guide-link" onClick={() => begin()}>Open payroll guide <Icon name="arrow" size={16}/></button></div><div className="profile"><span className="profile-avatar" aria-hidden="true">{profileInitials(displayName)}</span><div>{displayName}<small>Demo profile</small></div></div></div>
    </aside>
    <div className="workspace-main">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span><strong>{view === "overview" ? "Home" : view === "prepare" ? "Run payroll" : view === "review" ? "Statements & review" : view === "contractors" ? "Contractors" : view === "activity" ? "Activity register" : "Exceptions"}</strong></div><span className="demo-tag"><span />Interactive demo</span></header>
      <main id="main-content" className={`content ${walkthrough !== null ? "walkthrough-active" : ""}`}>
        <div className="page-heading"><div><p className="eyebrow">PAYROLL OPERATIONS</p><h1 ref={heading} tabIndex={-1}>{view === "overview" ? "Payroll command center." : view === "prepare" ? preparation[step].title : view === "review" ? "Review your payroll." : view === "contractors" ? "Contractor 360." : view === "activity" ? "Activity register." : "Exception center."}</h1><p className="page-description">{view === "overview" ? "See what is ready, what needs attention, and what to do next." : view === "prepare" ? `Step ${step + 1} of 4 · Check the sample information, then continue.` : view === "review" ? "Check each statement before acknowledging the sample review." : "Your people, source records, and calculations in one workspace."}</p></div><span className="period-label"><Icon name="clock" size={16}/>{period}</span></div>

        <div className="walkthrough-launch"><button className="button button-secondary" onClick={() => guideStage(0)}>Take a guided walkthrough</button><button className="text-link" onClick={() => guideStage(view === "exceptions" ? 2 : view === "review" ? 3 : view === "prepare" || view === "activity" ? 1 : 0)}>Help me here</button></div>
        {walkthrough !== null && <GuidedWalkthrough stage={walkthrough} onStage={guideStage} onExit={() => setWalkthrough(null)} />}
        {presenting && <button className="button button-secondary presentation-return" onClick={() => revealPresentation(".presentation-guide")}>Return to walkthrough</button>}
        {presenting && <PresentationGuide stage={tourStage} approved={Boolean(demo)} onStage={onTourStage} onAction={presentStage} onExit={() => onPresent(false)} />}
        <section className="panel exhibit-journey" aria-label="Client exhibit journey"><div><p className="eyebrow">FROM AGREEMENT TO NEXT PAYDAY</p><h2>Enter it once. See PayCore remember.</h2><p>Set up a fictional contractor, enter their work, explain the settlement, and simulate approval. Then open the next period above.</p></div><div className="activity-actions">{!presenting && <button className="button button-secondary" onClick={() => { setWalkthrough(null); onTourStage(0); onPresent(true); revealPresentation(".presentation-guide"); }}>Start presentation</button>}<button className="button button-primary" disabled={Boolean(demo)} onClick={() => setShowSetup(true)}>Set up contractor</button><button className="button button-secondary" onClick={() => begin(1)}>Enter payroll activity</button><button className="button button-secondary" onClick={() => navigate("review")}>Explain settlement</button></div></section>
        {showSetup && !demo && <ExhibitOnboarding inputs={inputs} run={run} onCancel={() => setShowSetup(false)} onActivate={(row, input) => { const nextRows = [...rows, row], nextInputs = [...inputs, input]; setRows(nextRows); updateInputs(nextInputs); setGridValid(nextRows.every(item => { try { calculateGridRow(item, nextInputs, new Date().toISOString(), run); return true; } catch { return false; } })); setShowSetup(false); begin(1); if (walkthrough === 0) setWalkthrough(1); }} />}
        <DraftRecovery scope={JSON.stringify([displayName, companyName])} run={run} draft={{inputs, rows, corrections}} frozen={Boolean(demo)} onRestore={draft => { if (demo) return; setRows(draft.rows); setInputs(draft.inputs); setCorrections(draft.corrections ?? []); setGridValid(draft.rows.length > 0 && draft.rows.every(row => { try { calculateGridRow(row, draft.inputs, new Date().toISOString(), run); return true; } catch { return false; } })); setChecked([true, false, false]); setAcknowledged(false); navigate("overview"); }} />
        {demo && <p className="review-ready" role="status">Demo {demo.status} · Figures are frozen for this exhibit. Open another period to enter new activity.</p>}
        {(["overview", "contractors", "activity", "exceptions"] as View[]).includes(view) && <OperationsCenter key={view} view={view as OperationsView} inputs={inputs} rows={rows} run={run} demo={demo} onAdd={addContractor} corrections={corrections} onCorrect={(next, correction) => { if (demo) return; updateInputs(next); setCorrections(previous => [...previous, correction]); }} onEntry={openActivity} onFuelCheck={() => { if (demo) return; setStep(1); navigate("prepare"); requestAnimationFrame(() => { if (activityDetails.current) activityDetails.current.open = true; const target = document.getElementById("fuel-source-check") as HTMLDetailsElement | null; if (target) { target.open = true; target.scrollIntoView({ block: "center" }); target.querySelector("summary")?.focus(); } }); }} onReview={() => completed === 3 || demo ? navigate("review") : begin()} onEdit={editContractor} onView={navigate} />}
        {view === "prepare" && <fieldset className="demo-entry-fields" disabled={Boolean(demo)}><legend className="sr-only">Demo payroll entry</legend><PayrollGrid run={run} rows={rows} onRowsChange={next => { if (!demo) setRows(next); }} inputs={inputs} onChange={updateInputs} onValidityChange={(valid) => { if (demo) return; setGridValid(valid); setChecked([true, false, false]); setAcknowledged(false); }} />
        {inputs.length > 0 && <details ref={activityDetails} className="detailed-activity"><summary>Add detailed loads, charges, or adjustments</summary><ActivityEntry requestedAction={activityRequest} inputs={inputs} onChange={updateInputs} /><DemoAdvance inputs={inputs} onChange={updateInputs} /><FuelCheck inputs={inputs} onChange={updateInputs} /><FactoringPlan inputs={inputs} onChange={updateInputs} /></details>}</fieldset>}
        {(view === "prepare" || view === "review") && <div aria-live="polite">{contractors.map(person => <div key={person.reference}>{person.detail.blockers.map((issue, i) => <p className="review-warning" key={`block-${i}`}>{person.name} · Blocking issue: {issue.message}</p>)}{person.detail.warnings.map((issue, i) => <p className="review-warning" key={`warn-${i}`}>{person.name} · {demo ? "Reviewed in demo" : "Review required"}: {issue.message}</p>)}</div>)}</div>}
        {view === "prepare" ? <>
          <WorkflowProgress current={step} checked={checked} onSelect={(index) => { if (index === 3)
            navigate("review");
        else
            begin(index); }}/>
          <div className="guided-layout"><section className="panel question-card"><div className="question-heading"><span className="question-number">0{step + 1}</span><div><p className="eyebrow">{preparation[step].label.toUpperCase()}</p><h2>{["Automatically selected dates", "Check the people and amounts", "Check what comes out and goes back in"][step]}</h2></div><span className="subtle-chip">Sample data</span></div>
            {step === 0 ? <><div className="period-choice"><Icon name="clock" size={24}/><div><span>Selected pay period</span><strong>{period}</strong><small>{contractors.length} contractors · USD</small></div><span className="selected-label"><Icon name="check" size={14}/>Selected</span></div><div className="inline-tip"><Icon name="help" size={19}/><p>These are your selected working dates. PayCore will not move unfinished payroll to another period. Activity must fall within these dates.</p></div></> : null}
            {step === 1 ? <><p className="question-intro">These earnings use the pay terms and activity you entered. Every contractor listed below is included.</p><ContractorTable contractors={contractors}/><div className="inline-tip"><Icon name="help" size={19}/><p>Each contractor uses their own effective pay agreement: a percentage, per-mile amount, or fixed period amount.</p></div></> : null}
            {step === 2 ? <><p className="question-intro">Check each contractor’s agreed recurring deductions, entered charges, and reimbursements. PayCore calculates the totals for you.</p><div className="table-scroll"><table><caption className="sr-only">Sample deductions and reimbursements in US dollars</caption><thead><tr><th scope="col">Contractor</th><th scope="col">Deductions</th><th scope="col">Reimbursements</th></tr></thead><tbody>{contractors.map((person) => <tr key={person.reference}><th scope="row">{person.name}</th><td>−{money(person.settlement.totalDeductions)}</td><td>+{money(person.settlement.totalReimbursements)}</td></tr>)}</tbody></table></div><div className="deduction-totals"><div><span>Total deductions</span><strong>−{money(total("totalDeductions"))}</strong></div><div><span>Total reimbursements</span><strong>+{money(total("totalReimbursements"))}</strong></div></div></> : null}
            {step !== 0 && <label className={`step-confirm ${checked[step] ? "checked" : ""}`}><input type="checkbox" disabled={Boolean(demo) || !hasContractors} checked={checked[step]} onChange={(event) => updateCheck(event.target.checked)}/><span>{preparation[step].confirm}</span></label>}
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
          <ExhibitStatement inputs={inputs} approval={demo} portalRequest={portalRequest} />
          {hasContractors && <details className="review-reference"><summary>Open spreadsheet-style settlement<span>Loads, described deductions and fuel reconciliation</span></summary><WorkbookPayroll inputs={inputs} snapshots={demo?.snapshots} /></details>}
          <div className="guided-layout"><div><section className="panel review-panel"><div className="section-heading"><div><p className="eyebrow">CONTRACTOR STATEMENTS</p><h2>Here’s what each person receives.</h2></div><span className="draft-chip">{demo ? `Demo ${demo.status}` : "Draft"}</span></div><p className="question-intro">Select a contractor to see the full breakdown.</p><div className="statement-list">{contractors.map((person) => <details className="statement-detail" key={person.reference}><summary><span className="person-avatar">{person.initials}</span><span className="person-name">{person.name}<small>{person.reference} · {person.methodLabel}</small></span><strong>{money(person.settlement.netPay)}</strong><Icon name="chevron" size={16}/></summary><dl className="statement-breakdown"><div><dt>Gross revenue</dt><dd>{money(person.gross)}</dd></div><div><dt>Agreed pay terms</dt><dd>{person.methodLabel}</dd></div>{person.detail.lines.map(line => <div key={line.id}><dt>{line.description}<small className="line-origin">{line.origin === "AUTOMATIC" ? `Automatic · rule ${line.ruleId}` : "Entered activity"}</small></dt><dd>{line.kind === "DEDUCTION" ? "−" : ""}{money(line.amountCents / 100)}</dd></div>)}<div><dt>Calculated contractor earnings</dt><dd>{money(person.detail.grossEarningsCents / 100)}</dd></div><div><dt>Automatic deductions</dt><dd>−{money(person.detail.automaticDeductionsCents / 100)}</dd></div><div><dt>Entered deductions</dt><dd>−{money(person.detail.manualDeductionsCents / 100)}</dd></div><div><dt>Reimbursements</dt><dd>+{money(person.detail.reimbursementsCents / 100)}</dd></div><div><dt>Adjustments</dt><dd>{money(person.detail.adjustmentsCents / 100)}</dd></div><div><dt>YTD earnings / deductions / net</dt><dd>{money(person.ytd.earningsCents / 100)} / {money(person.ytd.deductionsCents / 100)} / {money(person.ytd.netCents / 100)}<small className="line-origin">{demo ? "Demo approved-history YTD; no official production history." : "Draft excluded from demo YTD."}</small></dd></div><div className="breakdown-total"><dt>Estimated net pay</dt><dd>{money(person.settlement.netPay)}</dd></div></dl></details>)}</div></section><section className="panel approval-panel"><span className="section-icon"><Icon name="shield"/></span><div><h2>Finish with your review.</h2><p>Check the statements and totals. Approval is always a separate, deliberate action.</p><label className="acknowledgement"><input type="checkbox" checked={acknowledged} disabled={Boolean(demo) || !hasContractors || completed !== 3 || contractors.some(p => p.detail.blockers.length > 0)} onChange={(event) => setAcknowledged(event.target.checked)}/><span>I have reviewed these sample statements and totals.</span></label><p className="demo-explanation" role="status">{demo ? "Demo financial snapshot is frozen. Continue with downloads or simulated payment status below." : acknowledged ? "Review acknowledged. Continue below to simulate approval." : "Complete your review to enable the demo approval step below."}</p><div className="approval-actions"><button className="text-link" onClick={() => begin()}>Back to preparation</button></div></div></section></div>{summary}</div>
          <DemoCompletion inputs={inputs} ready={acknowledged && hasContractors && completed === 3 && !contractors.some(person => person.detail.blockers.length > 0)} actor={displayName} companyName={workspaceName} approval={demo} onApprove={setDemo} />
        </> : null}
        <footer className="workspace-footer"><a className="developer-credit" href="/welcome">Developed by <strong>ETL GIS Consulting LLC</strong></a><p>Demo mode · No real payments · Use fictional details · Save a demo draft before refreshing.</p><details><summary>About this demo</summary><p>Production authentication, authorization, saved audit history, and payment controls remain required before processing live payroll.</p></details></footer>
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
function PayrollSummary({ demoStatus, period, count, gross, earnings, deductions, reimbursements, net }: {
    demoStatus?: string;
    period: string;
    count: number;
    gross: number;
    earnings: number;
    deductions: number;
    reimbursements: number;
    net: number;
}) {
    return <aside className="panel payroll-summary" aria-label="Sample payroll summary"><p className="eyebrow">PAYROLL TOTALS</p><h2>Your demo payroll.</h2><span className="summary-period">{period} · {count} contractors</span><dl><div><dt>Gross revenue</dt><dd>{money(gross)}</dd></div><div><dt>Contractor earnings</dt><dd>{money(earnings)}</dd></div><div><dt>Total deductions</dt><dd>−{money(deductions)}</dd></div><div><dt>Reimbursements</dt><dd>+{money(reimbursements)}</dd></div><div className="summary-total"><dt>Estimated net pay</dt><dd>{money(net)}</dd></div></dl><p className="summary-note"><Icon name="shield" size={18}/><span>{demoStatus ? "Demo snapshot frozen. No real payments." : "Still a draft. Nothing is approved automatically."}</span></p></aside>;
}
function ContractorTable({ contractors }: {
    contractors: Contractor[];
}) {
    return <div className="table-scroll"><table><caption className="sr-only">Contractor earnings in US dollars for the selected pay period</caption><thead><tr><th scope="col">Contractor</th><th scope="col">Gross revenue</th><th scope="col">Pay agreement</th><th scope="col">Contractor earnings</th></tr></thead><tbody>{contractors.map((person) => <tr key={person.reference}><th scope="row"><span className="person-cell"><span className="person-avatar">{person.initials}</span><span>{person.name}<small>{person.reference}</small></span></span></th><td>{money(person.gross)}</td><td>{person.methodLabel}</td><td className="net-cell">{money(person.settlement.contractorEarnings)}</td></tr>)}</tbody></table></div>;
}

