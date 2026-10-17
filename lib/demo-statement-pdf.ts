import type { DemoApproval } from "./demo-payroll.ts";
import { safeCents, yearToDate } from "./settlements.ts";
import { workbookStatement } from "./workbook-statement.ts";
type Row = { label: string; value?: string; style?: "title" | "section" | "note" | "net" };
const ascii = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?");
const escape = (value: string) => ascii(value).replace(/[\\()]/g, "\\$&");
// Conservative built-in Helvetica widths keep long references inside their columns.
const width = (value: string, size: number) => [...value].reduce((sum, char) => sum + (/[MW@%mw]/.test(char) ? 1 : /[A-Z]/.test(char) ? .78 : /[ilI.,' :;!|]/.test(char) ? .34 : .65) * size, 0);
function wrap(value: string, limit: number, size: number): string[] {
  const lines: string[] = []; let line = "";
  for (const word of ascii(value).split(/\s+/)) {
    if (line && width(`${line} ${word}`, size) > limit) { lines.push(`${line} `); line = ""; }
    for (const char of `${line ? " " : ""}${word}`) { if (width(line + char, size) > limit) { lines.push(line); line = ""; } line += char; }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}
export function renderDemoPdf(state: DemoApproval, dollars: (cents: number) => string): Uint8Array {
  const pages: { rows: { row: Row; lines: string[]; y: number }[]; contractor: string; period: string }[] = [];
  for (const [index, snapshot] of state.snapshots.entries()) {
    const contractor = snapshot.calculationSnapshot.contractor, view = workbookStatement(snapshot);
    const ytd = yearToDate([...(state.history ?? []), snapshot], snapshot.companyId, snapshot.contractorId, snapshot.end);
    const money = (cents: number) => `USD ${dollars(cents)}`;
    const rows: Row[] = [
      { label: state.companyName, style: "title" },
      { label: `Contractor: ${contractor.displayName} | ${contractor.contractorNumber}` },
      { label: `Statement DEMO-${state.payrollRunId}-${index + 1}`, style: "note" },
      { label: `Pay period: ${snapshot.start} to ${snapshot.end}` },
      { label: `Status: DEMO ${state.status} | ${state.paidAt ? "Marked paid in demo; no funds moved" : "Not marked paid"}`, style: "note" },
      { label: `Approved in demo by ${state.actorName} at ${state.approvedAt}`, style: "note" },
      { label: `NET SETTLEMENT: ${money(snapshot.netSettlementCents)}`, style: "net" },
      { label: "LOADS AND ELIGIBLE REVENUE", style: "section" },
      ...snapshot.calculationSnapshot.loads.flatMap(load => [
        { label: `${load.loadNumber} | ${load.date} | ${load.status}`, value: money(load.grossRevenueCents) },
        { label: `${load.origin} to ${load.destination} | Loaded / empty miles: ${load.loadedMiles} / ${load.emptyMiles}`, style: "note" as const },
      ]),
      ...snapshot.calculationSnapshot.transactions.filter(tx => tx.transactionType === "LOAD_REVENUE").map(tx => ({ label: `${tx.description} | ${tx.transactionDate} | ${tx.referenceNumber}`, value: money(tx.amountCents) })),
      { label: "Gross eligible revenue", value: money(snapshot.grossEligibleRevenueCents) },
      { label: "EARNINGS AND COMPENSATION", style: "section" },
      { label: `Compensation: ${snapshot.compensationMethod.replaceAll("_", " ")}`, style: "note" },
      ...snapshot.lines.filter(line => line.kind === "EARNING").map(line => ({ label: line.description, value: money(line.amountCents) })),
      { label: "DEDUCTIONS AND DESCRIPTIONS", style: "section" },
      ...view.deductionDetails.flatMap(line => [
        { label: `${line.origin === "AUTOMATIC" ? "Automatic" : "Entered"}: ${line.description}`, value: money(line.amountCents) },
        ...(line.date ? [{ label: `${line.date} | Reference: ${line.reference}`, style: "note" as const }] : []),
        ...(line.explanation ? [{ label: line.explanation.replaceAll(" · ", " | "), style: "note" as const }] : []),
      ]),
      ...(!view.deductionDetails.length ? [{ label: "No deductions in this settlement.", style: "note" as const }] : []),
      { label: "DEDUCTIONS BY CATEGORY", style: "section" },
      { label: "Summary of the deductions above; these are not additional charges.", style: "note" },
      ...view.groups.filter(group => group.amountCents !== 0).map(group => ({ label: `${group.label}: ${money(group.amountCents)}` })),
      { label: "REIMBURSEMENTS AND ADJUSTMENTS", style: "section" },
      ...snapshot.lines.filter(line => line.kind === "REIMBURSEMENT" || line.kind === "ADJUSTMENT").map(line => ({ label: `${line.kind}: ${line.description}`, value: money(line.amountCents) })),
      ...(!snapshot.lines.some(line => line.kind === "REIMBURSEMENT" || line.kind === "ADJUSTMENT") ? [{ label: "No reimbursements or adjustments.", style: "note" as const }] : []),
      { label: "SETTLEMENT SUMMARY", style: "section" },
      { label: "Earnings", value: money(snapshot.grossEarningsCents) },
      { label: "Automatic deductions", value: money(snapshot.automaticDeductionsCents) },
      { label: "Entered deductions", value: money(snapshot.manualDeductionsCents) },
      { label: "Reimbursements", value: money(snapshot.reimbursementsCents) },
      { label: "Adjustments", value: money(snapshot.adjustmentsCents) },
      { label: "Net settlement", value: money(snapshot.netSettlementCents) },
      { label: "ADVANCE BALANCES", style: "section" },
      ...snapshot.calculationSnapshot.deductionRules.filter(rule => rule.remainingBalanceCents !== undefined).flatMap(rule => {
        const deducted = safeCents(snapshot.lines.filter(line => line.kind === "DEDUCTION" && line.ruleId === rule.id).reduce((total, line) => total + BigInt(line.amountCents), BigInt(0)));
        const remaining = safeCents(BigInt(rule.remainingBalanceCents!) - BigInt(deducted));
        return [{ label: rule.description }, { label: `Opening ${money(rule.remainingBalanceCents!)} | Deducted ${money(deducted)} | Remaining ${money(remaining)}${remaining === 0 ? " | Paid off in exhibit" : ""}`, style: "note" as const }];
      }),
      ...(!snapshot.calculationSnapshot.deductionRules.some(rule => rule.remainingBalanceCents !== undefined) ? [{ label: "No advance plan configured.", style: "note" as const }] : []),
      ...(view.expectedFuelCents !== undefined ? [{ label: "FUEL SOURCE CHECK", style: "section" as const }, { label: `Entered fuel ${money(view.fuelDetailCents)} | Expected ${money(view.expectedFuelCents)} | ${view.fuelMatches ? "Matched" : "Mismatch"}` }] : []),
      { label: "APPROVED EXHIBIT HISTORY - YEAR TO DATE", style: "section" },
      { label: `Demo YTD (approved exhibit history): earnings ${dollars(ytd.earningsCents)} / deductions ${dollars(ytd.deductionsCents)} / net ${dollars(ytd.netCents)}` },
      { label: "SIMULATION ONLY. No payroll approved or payment executed in a live system.", style: "note" },
    ];
    let page: typeof pages[number] = { rows: [], contractor: `${contractor.contractorNumber} | ${contractor.displayName}`, period: `${snapshot.start} to ${snapshot.end}` }, y = 650;
    pages.push(page);
    for (const row of rows) {
      const size = row.style === "title" ? 15 : row.style === "net" ? 14 : row.style === "note" ? 9 : 10;
      const lines = wrap(row.label, row.value ? 360 : 504, size), lineHeight = size + 5;
      // Split long descriptions safely across pages; every continuation repeats identity.
      for (let offset = 0; offset < lines.length;) {
        if (y < 112 || (row.style === "section" && offset === 0 && y < 180)) { page = { rows: [], contractor: `${contractor.contractorNumber} | ${contractor.displayName}`, period: `${snapshot.start} to ${snapshot.end}` }; pages.push(page); y = 650; }
        const count = Math.min(lines.length - offset, Math.max(1, Math.floor((y - 92) / lineHeight)));
        const chunk = lines.slice(offset, offset + count), continuation = offset > 0;
        const chunkRow = { ...row, value: continuation ? undefined : row.value };
        page.rows.push({ row: chunkRow, lines: chunk, y }); y -= chunk.length * lineHeight + (row.style === "section" || row.style === "net" ? 18 : 8); offset += count;
      }
    }
  }
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  const text = (x: number, y: number, size: number, value: string, bold = false) => `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escape(value)}) Tj ET`;
  for (const [index, page] of pages.entries()) {
    const content = [
      "0.06 0.17 0.24 rg 0 704 612 88 re f", "q 0.6875 0 0 -0.6875 42 772 cm", "0.086 0.349 0.306 rg 19 0 m 45 0 l 55.49 0 64 8.51 64 19 c 64 45 l 64 55.49 55.49 64 45 64 c 19 64 l 8.51 64 0 55.49 0 45 c 0 19 l 0 8.51 8.51 0 19 0 c f", "0.965 0.973 0.941 rg 20 16 m 35 16 l 44 16 50 21.7 50 30 c 50 38.3 44 44 35 44 c 29 44 l 29 53 l 20 53 l h 29 25 m 29 35 l 35 35 l 38.9 35 41 33.2 41 30 c 41 26.8 38.9 25 35 25 c h f*", "0.706 0.831 0.639 rg 50 49 m 50 51.761 47.761 54 45 54 c 42.239 54 40 51.761 40 49 c 40 46.239 42.239 44 45 44 c 47.761 44 50 46.239 50 49 c f Q", "1 1 1 rg", text(102, 749, 25, "PayCore", true), "1 1 1 rg", text(102, 729, 10, "CONTRACTOR SETTLEMENT - DEMO / NO REAL PAYMENT"),
      "0.12 0.28 0.31 rg", text(42, 690, 9, wrap(page.contractor, 520, 9)[0]), text(42, 676, 9, `Pay period: ${page.period}`),
    ];
    for (const { row, lines, y } of page.rows) {
      const size = row.style === "title" ? 15 : row.style === "net" ? 14 : row.style === "note" ? 9 : 10;
      if (row.style === "section") content.push(`0.90 0.95 0.92 rg 36 ${y - lines.length * (size + 5) + 2} 540 ${lines.length * (size + 5) + 14} re f`);
      if (row.style === "net") content.push(`0.06 0.17 0.24 rg 36 ${y - lines.length * (size + 5) + 2} 540 ${lines.length * (size + 5) + 16} re f`);
      content.push(row.style === "net" ? "0.95 0.84 0.59 rg" : row.style === "note" ? "0.30 0.40 0.44 rg" : "0.08 0.18 0.24 rg");
      lines.forEach((line, i) => content.push(text(42, y - i * (size + 5), size, line, row.style === "section" || row.style === "title" || row.style === "net")));
      if (row.value) content.push(text(570 - [...row.value].reduce((sum, char) => sum + (/[0-9]/.test(char) ? .556 : char === "U" || char === "D" ? .722 : char === "S" ? .667 : char === "-" ? .333 : .278) * 10, 0), y, 10, row.value, true));
    }
    content.push("0.08 0.18 0.24 rg", text(42, 50, 10, "Developed by ETL GIS Consulting LLC", true), text(42, 32, 9, `Demo page ${index + 1} of ${pages.length} | Simulation only - no real payment`));
    const stream = content.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
