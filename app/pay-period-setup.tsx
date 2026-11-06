"use client";
import { useState } from "react";
import { validateSchedule } from "../lib/pay-periods";
import type { PaySchedule } from "../lib/pay-periods";
import UiIcon from "./ui-icon";
export default function PayPeriodSetup({ onSave }: { onSave: (schedule: PaySchedule) => void }) {
  const [error, setError] = useState("");
  return <section className="panel activity-entry period-setup">
    <div className="period-setup-intro"><span className="setup-step-marker"><UiIcon name="clock" size={22} /></span><p className="eyebrow">START WITH THE DATES</p><h1>Set your pay period once.</h1><p>Choose the first period. PayCore calculates the following cycles; you decide when to open the next one.</p></div>
    <form className="activity-form" aria-describedby="schedule-help" onSubmit={event => {
      event.preventDefault(); const values = new FormData(event.currentTarget);
      try { onSave(validateSchedule({ version: 1, start: values.get("start"), end: values.get("end"), timeZone: values.get("timeZone") })); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "Check the pay period."); }
    }}>
      <label>First period starts<input type="date" name="start" required /></label>
      <label>First period ends<input type="date" name="end" required /></label>
      <label className="schedule-timezone">Payroll time zone<select name="timeZone" defaultValue="America/New_York"><option value="America/New_York">Eastern time</option><option value="America/Chicago">Central time</option><option value="America/Denver">Mountain time</option><option value="America/Los_Angeles">Pacific time</option><option value="UTC">UTC</option></select></label>
      <div id="schedule-help" className="schedule-help"><UiIcon name="document" size={19} /><p>Weekly and biweekly periods repeat by day count. For example, October 5–18 is a 14-day cycle, followed by October 19–November 1. Calendar-month schedules are not supported.</p></div>
      {error && <p role="alert">{error}</p>}
      <button className="button button-primary" type="submit">Save schedule and open payroll <UiIcon name="arrow" size={17} /></button>
    </form><p className="guide-rail-note">The schedule stays in this browser. Save a local draft to recover entries after a refresh.</p>
  </section>;
}
