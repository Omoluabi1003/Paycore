import { StatementHeaderSchema } from "./statement-header.ts";
import { statementBoldFont, statementBoldFontBase64 } from "./pdf-fonts/century-gothic-bold-italic.ts";
import { statementFont, statementFontBase64 } from "./pdf-fonts/tr-century-gothic-italic.ts";
import type { DemoApproval } from "./demo-payroll.ts";
import type { ApprovedSettlement } from "./settlements.ts";
import { safeCents, yearToDate } from "./settlements.ts";
import { workbookStatement } from "./workbook-statement.ts";

type Cell = string;
type Column = { label: string; width: number; right?: boolean };
type ReportRow = { cells: Cell[]; total?: boolean };
const clean = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?");
const escape = (value: string) => clean(value).replace(/[\\()]/g, "\\$&");
// Measure the actual embedded font, with space for italic overhang.
const width = (value: string, size: number, bold = false) => {
  const font = bold ? statementBoldFont : statementFont;
  return [...clean(value)].reduce((total, char) => total + (font.widths[char as keyof typeof font.widths] ?? 600) * size / 1000, 0);
};
function wrap(value: string, limit: number, size: number, bold = false): string[] {
  const lines: string[] = []; let line = "";
  for (const word of clean(value).split(/\s+/)) {
    if (line && width(`${line} ${word}`, size, bold) > limit) { lines.push(`${line} `); line = ""; }
    for (const char of `${line ? " " : ""}${word}`) { if (width(line + char, size, bold) > limit) { lines.push(line); line = ""; } line += char; }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}
const sum = (values: number[]) => safeCents(values.reduce((total, value) => total + BigInt(value), BigInt(0)));
/** All report amounts come from the frozen settlement and approved history. */
export function statementReport(state: DemoApproval, snapshot: ApprovedSettlement) {
  const history = [...(state.history ?? []), snapshot].filter(item => item.status === "APPROVED" && item.companyId === snapshot.companyId && item.contractorId === snapshot.contractorId && item.end.slice(0, 4) === snapshot.end.slice(0, 4) && item.end <= snapshot.end);
  const view = workbookStatement(snapshot);
  const historicalViews = history.map(item => workbookStatement(item));
  return {
    view, ytd: yearToDate(history, snapshot.companyId, snapshot.contractorId, snapshot.end),
    deductions: view.groups.map(group => ({ ...group, ytdCents: sum(historicalViews.map(item => item.groups.find(previous => previous.label === group.label)?.amountCents ?? 0)) })),
    earnings: [...new Set(history.flatMap(item => item.lines.filter(line => line.kind === "EARNING").map(line => line.category)))].map(category => ({ category, current: sum(snapshot.lines.filter(line => line.kind === "EARNING" && line.category === category).map(line => line.amountCents)), ytd: sum(history.flatMap(item => item.lines.filter(line => line.kind === "EARNING" && line.category === category).map(line => line.amountCents))) })),
  };
}

/** Excel-style Letter statement with the supplied TR Century Gothic Italic embedded. */
export function renderDemoPdf(state: DemoApproval, dollars: (cents: number) => string, contractorIds?: readonly string[]): Uint8Array {
  const header = StatementHeaderSchema.parse(state.statementHeader ?? {});
  const pages: string[][] = [];
  const text = (x: number, y: number, size: number, value: string, bold = false) => `q BT /${bold ? "F2" : "F1"} ${size} Tf 0 Tr ${x} ${y} Td (${escape(value)}) Tj ET Q`;
  const money = (value: number) => `$ ${dollars(value)}`;
  for (const [index, snapshot] of state.snapshots.entries()) {
    if(contractorIds&&!contractorIds.includes(snapshot.contractorId))continue;
    const { view, ytd, deductions, earnings } = statementReport(state, snapshot);
    const frozen = snapshot.calculationSnapshot, contractor = frozen.contractor;
    let content: string[] = [], y = 0;
    const rect = (x: number, top: number, w: number, height: number, color?: string) => {
      if (color) content.push(`${color} rg ${x} ${top - height} ${w} ${height} re f`);
      content.push(`0.18 0.22 0.25 RG 0.4 w ${x} ${top - height} ${w} ${height} re S 0 0 0 rg`);
    };
    function newPage() {
      content = []; pages.push(content);
      const companyLines = wrap(state.companyName, 160, 10, true);
      const companyInfo = [header.address, header.cityStateZip, header.email ? `Email: ${header.email}` : "", header.phone ? `Phone: ${header.phone}` : "", [header.mcNumber ? `MC ${header.mcNumber}` : "",header.usdotNumber ? `USDOT ${header.usdotNumber}` : ""].filter(Boolean).join(" | ")].filter(Boolean).flatMap(value=>wrap(value,160,6.5));
      const bannerHeight = Math.max(48, companyLines.length * 12 + companyInfo.length * 8 + 12);
      const identityLines = wrap(`CONTRACTOR: ${contractor.displayName} | ${contractor.contractorNumber}`, 540, 8, true);
      const identityTop = 760 - bannerHeight, identityHeight = identityLines.length * 10 + 7;
      rect(28, 760, 556, bannerHeight, "0.78 0.93 0.98");
      rect(28, 760, 176, bannerHeight, "0.86 0.95 0.82");
      companyLines.forEach((line, i) => content.push(text(36, 744 - i * 12, 10, line, true)));
      companyInfo.forEach((line,i)=>content.push(text(36,744-companyLines.length*12-i*8,6.5,line)));
      content.push(text(216, 738, 14, "CONTRACTOR PAYROLL", true));
      // Existing PayCore vector mark; never reuse the private logo from the reference.
      content.push("q 0.4 0 0 -0.4 488 752 cm", "0.086 0.349 0.306 rg 19 0 m 45 0 l 55.49 0 64 8.51 64 19 c 64 45 l 64 55.49 55.49 64 45 64 c 19 64 l 8.51 64 0 55.49 0 45 c 0 19 l 0 8.51 8.51 0 19 0 c f", "0.965 0.973 0.941 rg 20 16 m 35 16 l 44 16 50 21.7 50 30 c 50 38.3 44 44 35 44 c 29 44 l 29 53 l 20 53 l h 29 25 m 29 35 l 35 35 l 38.9 35 41 33.2 41 30 c 41 26.8 38.9 25 35 25 c h f*", "0.706 0.831 0.639 rg 50 49 m 50 51.761 47.761 54 45 54 c 42.239 54 40 51.761 40 49 c 40 46.239 42.239 44 45 44 c 47.761 44 50 46.239 50 49 c f Q");
      content.push("0.086 0.349 0.306 rg", text(520, 733, 11, "PayCore", true), "0 0 0 rg");
      rect(28, identityTop, 556, identityHeight, "0.91 0.93 0.95");
      identityLines.forEach((line, i) => content.push(text(35, identityTop - 11 - i * 10, 8, line, true)));
      y = identityTop - identityHeight;
      const contactRows = [[`ID number: ${contractor.contractorNumber}`,`Pay begin date: ${snapshot.start}`],[`Address: ${contractor.address || "Not entered"}`,`Pay end date: ${snapshot.end}`],[`City, state: ${contractor.cityStateZip || "Not entered"}`,`Payroll #: ${header.payrollNumber || "Not entered"}`],[`Phone: ${contractor.phone || "Not entered"}`,`Invoice pay date: ${header.invoicePayDate || "Not entered"}`]];
      for (const [rowIndex,row] of contactRows.entries()) {
        const cells=row.map(value=>wrap(value,266,7)),height=Math.max(...cells.map(cell=>cell.length))*9+4;
        rect(28,y,556,height,rowIndex%2===0?"0.86 0.95 0.98":undefined);
        cells.forEach((lines,column)=>lines.forEach((line,i)=>content.push(text(33+column*278,y-9-i*9,7,line))));y-=height;
      }
      y-=4;
      for (const value of [`Pay period: ${snapshot.start} to ${snapshot.end}`, `Statement DEMO-${state.payrollRunId}-${index + 1}`, `DEMO ${state.status} | ${state.paidAt ? "Marked paid in demo; no funds moved" : "Not marked paid"}`]) {
        for (const line of wrap(value,550,6.5)) {content.push(text(28,y-7,6.5,line));y-=9;}
      }
      y -= 7;
    }
    function ensure(height: number) { if (y - height < 58) newPage(); }
    function note(value: string, bold = false) {
      const lines = wrap(value, 544, 7, bold);
      for (const line of lines) { ensure(11); content.push(text(32, y - 8, 7, line, bold)); y -= 11; }
    }
    function table(title: string, columns: Column[], rows: ReportRow[], x = 28) {
      const w = columns.reduce((total, column) => total + column.width, 0);
      const header = (continued = false) => {
        rect(x, y, w, 13, "0.91 0.93 0.95"); content.push(text(x + 5, y - 10, 7, `${title}${continued ? " (continued)" : ""}`, true)); y -= 13;
        rect(x, y, w, 13, "0.91 0.93 0.95"); let left = x;
        columns.forEach(column => { content.push(text(left + 5, y - 10, 6.6, column.label, true)); left += column.width; }); y -= 13;
      };
      ensure(56); header();
      for (const row of rows) {
        const lines = row.cells.map((cell, i) => wrap(cell, columns[i].width - 12, 7, row.total));
        const count = Math.max(1, ...lines.map(item => item.length));
        let offset = 0;
        while (offset < count) {
          if (y < 78) { newPage(); header(true); }
          const available = Math.max(1, Math.floor((y - 64) / 9));
          const chunk = Math.min(count - offset, available), height = Math.max(12, chunk * 9 + 3);
          rect(x, y, w, height, row.total ? "0.91 0.93 0.95" : undefined);
          let left = x;
          columns.forEach((column, i) => {
            lines[i].slice(offset, offset + chunk).forEach((line, lineIndex) => {
              const tx = column.right ? left + column.width - 6 - width(line, 7, row.total) : left + 5;
              content.push(text(tx, y - 9 - lineIndex * 9, 7, line, row.total));
            });
            left += column.width;
          }); y -= height; offset += chunk;
        }
      }
      y -= 8;
    }
    newPage();
    const terms = snapshot.compensationRateBasisPoints === undefined ? snapshot.compensationMethod.replaceAll("_", " ") : `${snapshot.compensationRateBasisPoints / 100}% of eligible revenue`;
    table("HOURS AND EARNINGS", [{ label: "Description / agreed compensation", width: 324 }, { label: "Current", width: 116, right: true }, { label: "YTD", width: 116, right: true }], [
      ...earnings.map(item => ({ cells: [item.category.replaceAll("_", " "), money(item.current), money(item.ytd)] })),
      { cells: ["TOTAL OF ALL EARNINGS", money(snapshot.grossEarningsCents), money(ytd.earningsCents)], total: true },
    ]);
    note(`Agreed pay terms: ${terms}. Eligible revenue: ${money(snapshot.grossEligibleRevenueCents)}.`);
    table("DEDUCTIONS BY CATEGORY", [{ label: "Description", width: 324 }, { label: "Current", width: 116, right: true }, { label: "YTD", width: 116, right: true }], [
      ...deductions.map(group => ({ cells: [group.label, money(group.amountCents), money(group.ytdCents)] })),
      { cells: ["TOTAL DEDUCTIONS", money(view.totalDeductionsCents), money(ytd.deductionsCents)], total: true },
    ]);
    note("Category totals summarize the detailed entries below; they are not additional charges.");
    table("TOTALS", [{ label: "Period", width: 74 }, { label: "Total earnings", width: 120, right: true }, { label: "Deductions", width: 120, right: true }, { label: "Reimb. / adjustments", width: 122, right: true }, { label: "Net pay", width: 120, right: true }], [
      { cells: ["Current", money(snapshot.grossEarningsCents), money(view.totalDeductionsCents), money(sum([snapshot.reimbursementsCents, snapshot.adjustmentsCents])), money(snapshot.netSettlementCents)], total: true },
      { cells: ["YTD", money(ytd.earningsCents), money(ytd.deductionsCents), "Included in YTD net", money(ytd.netCents)] },
    ]);
    note(`NET SETTLEMENT: USD ${dollars(snapshot.netSettlementCents)}`, true);
    note(`Demo YTD (approved exhibit history): earnings ${dollars(ytd.earningsCents)} / deductions ${dollars(ytd.deductionsCents)} / net ${dollars(ytd.netCents)}`);
    const details: ReportRow[] = [
      ...view.deductionDetails.map(line => ({ cells: [line.date ?? "Configured", line.reference ? `Reference: ${line.reference}` : "Agreement", `${line.description}${line.explanation ? ` | ${line.explanation.replaceAll(" · ", " | ")}` : ""}`, "Deduction", money(line.amountCents)] })),
      ...snapshot.lines.filter(line => line.kind === "REIMBURSEMENT" || line.kind === "ADJUSTMENT").map(line => { const tx = frozen.transactions.find(tx => line.sourceId === `transaction:${tx.id}`); return { cells: [tx?.transactionDate ?? snapshot.end, tx?.referenceNumber ?? "-", line.description, line.kind === "ADJUSTMENT" ? "Adjustment" : "Reimbursement", money(line.amountCents)] }; }),
    ];
    table("ADVANCES, DEDUCTIONS AND REIMBURSEMENT DETAILS", [{ label: "Date", width: 58 }, { label: "Document / reference", width: 100 }, { label: "Description", width: 230 }, { label: "Type", width: 78 }, { label: "Amount", width: 90, right: true }], details.length ? details : [{ cells: ["-", "-", "No deductions, reimbursements or adjustments.", "-", "-"] }]);
    if (view.expectedFuelCents !== undefined) note(`Fuel source check: entered ${money(view.fuelDetailCents)} | expected ${money(view.expectedFuelCents)} | ${view.fuelMatches ? "Matched" : "Mismatch"}. Fuel is deducted once.`);
    const loadRows: ReportRow[] = frozen.loads.map(load => {
      const earning = snapshot.lines.filter(line => line.kind === "EARNING" && line.sourceId === `load:${load.id}`);
      const eligible = load.status === "ELIGIBLE";
      return { cells: [load.date, `${load.loadNumber}${load.proNumber !== load.loadNumber ? ` / ${load.proNumber}` : ""}`, `${load.origin} to ${load.destination}${eligible ? "" : " (Excluded)"}`, String(load.loadedMiles), String(load.emptyMiles), money(load.grossRevenueCents), eligible && earning.length ? money(sum(earning.map(line => line.amountCents))) : eligible ? "See earnings" : "Excluded"] };
    });
    for (const tx of frozen.transactions.filter(tx => tx.transactionType === "LOAD_REVENUE")) {
      const earning = snapshot.lines.filter(line => line.kind === "EARNING" && line.sourceId === `transaction:${tx.id}`);
      loadRows.push({ cells: [tx.transactionDate, tx.referenceNumber, `${tx.description} | Entered miles: ${tx.miles}`, "-", "-", money(tx.amountCents), earning.length ? money(sum(earning.map(line => line.amountCents))) : "See earnings"] });
    }
    if (loadRows.length) {
      const attributedEarnings = snapshot.lines.filter(line => line.kind === "EARNING" && line.sourceId && (frozen.loads.some(load => line.sourceId === `load:${load.id}`) || frozen.transactions.some(tx => tx.transactionType === "LOAD_REVENUE" && line.sourceId === `transaction:${tx.id}`)));
      loadRows.push({ cells: ["TOTALS", "", "Listed entries", String(sum(frozen.loads.map(load => load.loadedMiles))), String(sum(frozen.loads.map(load => load.emptyMiles))), money(sum([...frozen.loads.map(load => load.grossRevenueCents), ...frozen.transactions.filter(tx => tx.transactionType === "LOAD_REVENUE").map(tx => tx.amountCents)])), attributedEarnings.length ? money(sum(attributedEarnings.map(line => line.amountCents))) : "See earnings"], total: true });
    }
    table("LOAD DETAIL - LOADS AND ELIGIBLE REVENUE", [{ label: "Date", width: 58 }, { label: "Load / pro no.", width: 91 }, { label: "Route / description", width: 175 }, { label: "Loaded", width: 42, right: true }, { label: "Empty", width: 42, right: true }, { label: "Gross", width: 74, right: true }, { label: "Earnings", width: 74, right: true }], loadRows.length ? loadRows : [{ cells: ["-", "-", "No loads in this period.", "-", "-", "-", "-"] }]);
    note("Load gross includes excluded rows when labeled; eligible revenue and settlement use the configured eligibility. Period-based earnings appear in earnings, not assigned to a load.");
    for (const rule of frozen.deductionRules.filter(rule => rule.remainingBalanceCents !== undefined)) {
      const deducted = sum(snapshot.lines.filter(line => line.kind === "DEDUCTION" && line.ruleId === rule.id).map(line => line.amountCents));
      note(`${rule.description}: Opening USD ${dollars(rule.remainingBalanceCents!)} | Deducted USD ${dollars(deducted)} | Remaining USD ${dollars(safeCents(BigInt(rule.remainingBalanceCents!) - BigInt(deducted)))}`);
    }

  }
  const fontObject = (font: typeof statementFont, descriptorId: number) => `<< /Type /Font /Subtype /TrueType /BaseFont /${font.postscriptName} /FirstChar 32 /LastChar 126 /Widths [${Array.from({ length: 95 }, (_, i) => font.widths[String.fromCharCode(i + 32) as keyof typeof font.widths]).join(" ")}] /Encoding /WinAnsiEncoding /FontDescriptor ${descriptorId} 0 R >>`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] >>`, fontObject(statementFont, 5 + pages.length * 2), fontObject(statementBoldFont, 7 + pages.length * 2)];
  for (const [index, content] of pages.entries()) {
    wrap(`Approved in demo by ${state.actorName} at ${state.approvedAt}`,450,6).forEach((line,i)=>content.push(text(28,51-i*7,6,line)));
    content.push("0 0 0 rg", text(28, 34, 7, "Developed by ETL GIS Consulting LLC", true), text(493,34,7,"PayCore",true), text(28, 23, 6.5, "SIMULATION ONLY - no live payroll approval or real payment."), text(493, 23, 6.5, `Page ${index + 1} of ${pages.length}`));
    const stream = content.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  for (const [font, base64] of [[statementFont, statementFontBase64], [statementBoldFont, statementBoldFontBase64]] as const) {
    const fontHex = [...atob(base64)].map(char => char.charCodeAt(0).toString(16).padStart(2, "0")).join("") + ">";
    objects.push(`<< /Type /FontDescriptor /FontName /${font.postscriptName} /Flags 96 /FontBBox [${font.bbox.join(" ")}] /ItalicAngle ${font.italicAngle} /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV 80 /FontFile2 ${objects.length + 2} 0 R >>`, `<< /Length ${fontHex.length} /Length1 ${font.byteLength} /Filter /ASCIIHexDecode >>\nstream\n${fontHex}\nendstream`);
  }
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
