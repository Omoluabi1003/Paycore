"use client";
import { useEffect, useState } from "react";
import { decodeDraft, draftKey, encodeDraft } from "../lib/demo-draft";
import type { DemoDraft } from "../lib/demo-draft";
import type { PayrollRun } from "../lib/settlements";
export default function DraftRecovery({ scope, run, draft, frozen, onRestore }: { scope: string; run: PayrollRun; draft: DemoDraft; frozen: boolean; onRestore: (draft: DemoDraft) => void }) {
  const [checkpoint, setCheckpoint] = useState<{ key: string; value: string } | null>(null), [message, setMessage] = useState("");
  const key = draftKey(scope, run);
  const saved = checkpoint?.key === key ? checkpoint.value : null;
  useEffect(() => { setMessage(""); try { const value = sessionStorage.getItem(key); if (value) { decodeDraft(value, scope, run); setCheckpoint({ key, value }); } else setCheckpoint(null); } catch { setCheckpoint(null); setMessage("Saved draft could not be read. Current entries are unchanged."); } }, [key, scope, run]);
  function act(action: "save" | "restore" | "forget") {
    try {
      if (action === "save") { const value = encodeDraft(draft, scope, run, new Date().toISOString()); sessionStorage.setItem(key, value); setCheckpoint({ key, value }); setMessage("Demo draft saved in this tab. Save again after further changes."); }
      if (action === "restore" && saved) { const value = decodeDraft(saved, scope, run); onRestore({ inputs: value.inputs, rows: value.rows, corrections: value.corrections }); setMessage("Draft restored. Recheck earnings and deductions before approval."); }
      if (action === "forget") { sessionStorage.removeItem(key); setCheckpoint(null); setMessage("Saved copy removed. Current entries are unchanged."); }
    } catch { setMessage("Draft recovery unavailable. Current entries are unchanged; browser storage may be full or blocked."); }
  }
  return <section className="panel draft-recovery" aria-label="Demo draft recovery"><div><strong>Pick up where you left off</strong><p>Save fictional entries before refreshing. Reopen the same profile and company in this tab to restore. Restoring replaces current entries and requires another review. This is not a secure payroll backup.</p>{saved && <small>Saved {new Date(decodeDraft(saved, scope, run).savedAt).toLocaleString()}</small>}</div><div className="activity-actions"><button className="button button-secondary" disabled={frozen || !draft.rows.length} onClick={() => act("save")}>Save demo draft</button><button className="button button-secondary" disabled={frozen || !saved} onClick={() => act("restore")}>Restore saved draft</button><button className="text-link" disabled={!saved} onClick={() => act("forget")}>Forget saved copy</button></div>{frozen && <p>Approved exhibit is frozen. Draft recovery cannot replace it.</p>}{message && <p role="status">{message}</p>}</section>;
}
