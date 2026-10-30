"use client";
import { useState } from "react";
import { validateSchedule } from "../lib/pay-periods";
import type { PaySchedule } from "../lib/pay-periods";
export default function PayPeriodSetup({ onSave }: { onSave: (schedule: PaySchedule) => void }) {
  const [error, setError] = useState("");
  return <section className="panel activity-entry period-setup"><h1>Set your pay period once.</h1><p>Enter the first period, including its start and end dates. PayCore will open exactly these dates and calculate following periods automatically. You choose when to open the next period.</p><form className="activity-form" onSubmit={event => {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    try { onSave(validateSchedule({ version: 1, start: values.get("start"), end: values.get("end"), timeZone: values.get("timeZone") })); }
    catch (error) { setError(error instanceof Error ? error.message : "Check the pay period."); }
  }}><label>First period starts<input type="date" name="start" required /></label><label>First period ends<input type="date" name="end" required /></label><label>Payroll time zone<select name="timeZone" defaultValue="America/New_York"><option value="America/New_York">Eastern time</option><option value="America/Chicago">Central time</option><option value="America/Denver">Mountain time</option><option value="America/Los_Angeles">Pacific time</option><option value="UTC">UTC</option></select></label><p>For example: October 5–18 repeats every 14 days; the next period is October 19–November 1. This supports fixed-day cycles such as weekly and biweekly, rather than calendar-month schedules.</p>{error && <p role="alert">{error}</p>}<button className="button button-primary" type="submit">Save schedule and open payroll</button></form><p className="guide-rail-note">The schedule is remembered in this browser. Save a local draft in the workspace before refreshing to recover entries in this tab.</p></section>;
}
