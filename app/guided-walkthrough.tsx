"use client";
import { useEffect, useRef, useState } from "react";

export const walkthroughSteps = [
  { title: "Start with the agreement", target: ".exhibit-onboarding", text: "Enter identity, agreed compensation and described deductions. Activate the contractor yourself; PayCore supplies no names or rates." },
  { title: "Enter what happened", target: ".payroll-sheet", text: "Enter revenue or miles here. Expand detailed activity for individual loads and receipts. Give each deduction a description, date and reference." },
  { title: "Check what needs attention", target: ".exception-workbench", text: "Read each exception and inspect its source. Correct errors with a reason. An empty queue means there are no detected exceptions, not that payroll is approved." },
  { title: "Understand every amount", target: ".exhibit-statement", text: "Follow the agreement, earnings, described deductions and reimbursements to the net settlement. Compare prior approved periods when available." },
  { title: "Make the human decision", target: ".demo-completion", text: "Complete preparation checks and acknowledge your statement review. Only you can choose Record local approval. Downloads appear after that decision. No real payment occurs." },
] as const;

/** Nonmodal coaching: highlighted controls remain usable; no financial actions are triggered. */
export function GuidedWalkthrough({ stage, onStage, onExit }: { stage: number; onStage: (stage: number) => void; onExit: () => void }) {
  const card = useRef<HTMLElement>(null);
  const [located, setLocated] = useState(false);
  const step = walkthroughSteps[stage];
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    card.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    let highlighted: HTMLElement | null = null;
    let scrolled = false;
    const locate = () => {
      const target = document.querySelector<HTMLElement>(step.target);
      if (highlighted !== target) { highlighted?.classList.remove("walkthrough-target"); highlighted = target; }
      setLocated(Boolean(target));
      if (target) {
        target.classList.add("walkthrough-target");
        if (!scrolled) { target.scrollIntoView({ block: "start", behavior: "instant" }); scrolled = true; }
      }
    };
    const observer = new MutationObserver(locate);
    observer.observe(document.getElementById("main-content") ?? document.body, { childList: true, subtree: true });
    locate();
    return () => { observer.disconnect(); highlighted?.classList.remove("walkthrough-target"); };
  }, [step]);
  useEffect(() => {
    const exit = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onExit(); } };
    document.addEventListener("keydown", exit);
    return () => document.removeEventListener("keydown", exit);
  }, [onExit]);
  return <aside ref={card} tabIndex={-1} role="region" aria-labelledby="walkthrough-title" className="guided-walkthrough">
    <div className="section-heading"><p className="eyebrow">PAYCORE WALKTHROUGH · {stage + 1} OF {walkthroughSteps.length}</p><button className="text-link" onClick={onExit} aria-label="Exit walkthrough">Exit</button></div>
    <div aria-live="polite" aria-atomic="true"><h2 id="walkthrough-title">{step.title}</h2><p>{step.text}</p>{!located && <p className="walkthrough-hint">{stage === 0 ? "Setup is closed or this period is approved. Reopen the walkthrough to set up an agreement, or skip ahead to inspect the payroll." : "Add a contractor first to see this section. You can go back or skip ahead."}</p>}</div>
    <div className="activity-actions"><button className="button button-secondary" disabled={stage === 0} onClick={() => onStage(stage - 1)}>Back</button><button className="button button-primary" onClick={() => stage === walkthroughSteps.length - 1 ? onExit() : onStage(stage + 1)}>{stage === walkthroughSteps.length - 1 ? "Finish walkthrough" : "Next"}</button>{stage < walkthroughSteps.length - 1 && <button className="text-link" onClick={() => onStage(stage + 1)}>Skip step</button>}</div>
    <small>Use the highlighted screen at your own pace. Escape exits. Nothing is entered or approved for you.</small>
  </aside>;
}
