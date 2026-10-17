import type { PayrollRun } from "./settlements.ts";
export type PaySchedule = { version: 1; start: string; end: string; timeZone: string };
const dayMs = 86400000;
function day(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid date.");
  const result = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(result) || new Date(result).toISOString().slice(0, 10) !== value) throw new Error("Enter a valid date.");
  return result / dayMs;
}
const date = (value: number) => new Date(value * dayMs).toISOString().slice(0, 10);
export function validateSchedule(raw: unknown): PaySchedule {
  if (!raw || typeof raw !== "object") throw new Error("Enter the first pay period.");
  const value = raw as PaySchedule;
  if (value.version !== 1 || typeof value.start !== "string" || typeof value.end !== "string" || typeof value.timeZone !== "string") throw new Error("Enter the first pay period.");
  const length = day(value.end) - day(value.start) + 1;
  if (length < 1 || length > 31) throw new Error("Choose a fixed pay cycle of 1–31 days, including both dates.");
  try { new Intl.DateTimeFormat("en-US", { timeZone: value.timeZone }).format(); } catch { throw new Error("Choose a valid payroll time zone."); }
  return { version: 1, start: value.start, end: value.end, timeZone: value.timeZone };
}
export function dateInZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function periodForDate(schedule: PaySchedule, on: string): PayrollRun {
  const valid = validateSchedule(schedule);
  const start = day(valid.start), length = day(valid.end) - start + 1;
  // Before the first scheduled day, show the upcoming first period.
  const index = Math.max(0, Math.floor((day(on) - start) / length));
  const from = date(start + index * length), to = date(start + (index + 1) * length - 1);
  const id = `period-${from}-${to}`;
  return { id: `preview-${id}`, companyId: "sample-northstar", payPeriodId: id, start: from, end: to, status: "DRAFT" };
}
export function formatPeriod(run: Pick<PayrollRun, "start" | "end">): string {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  return `${formatter.format(new Date(`${run.start}T00:00:00Z`))} – ${formatter.format(new Date(`${run.end}T00:00:00Z`))}`;
}

// The working period is a deliberate selection, independent of today's cycle.
export function workingPeriod(schedule: PaySchedule, start = schedule.start): PayrollRun {
  const run = periodForDate(schedule, start);
  if (run.start !== start) throw new Error("Choose a period from your pay schedule.");
  return run;
}
export function nextPayPeriod(schedule: PaySchedule, run: PayrollRun): PayrollRun {
  return periodForDate(schedule, date(day(run.end) + 1));
}
