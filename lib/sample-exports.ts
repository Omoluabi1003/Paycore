import type { Settlement } from "./settlements";

export type Statement = {
  methodLabel?: string; detail?: Settlement;
  name: string; reference: string; gross: number; rate: number;
  settlement: { contractorEarnings: number; factoringCharge: number; totalDeductions: number; totalReimbursements: number; netPay: number };
};
const amount = (value: number) => value.toFixed(2);
const escapePdf = (value: string) => value.replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, "\\$&");

// Minimal fixed-layout, public sample statements. No user-supplied data or fonts.
export function samplePdf(people: Statement[]): Uint8Array {
  const objects: string[] = [];
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Count ${people.length} /Kids [${people.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] >>`;
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  people.forEach((person, index) => {
    const text = (x: number, y: number, size: number, value: string) => `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`;
    const rows: [string, number][] = person.detail ? [["Gross eligible revenue", person.gross], ...person.detail.lines.map((line): [string, number] => [`${line.origin === "AUTOMATIC" ? "Auto" : "Entered"}: ${line.category.replaceAll("_", " ")} ${line.ruleId ? `[${line.ruleId}]` : ""}`, (line.kind === "DEDUCTION" ? -line.amountCents : line.amountCents) / 100])] : [["Gross revenue", person.gross], [`Contractor earnings (${person.rate}%)`, person.settlement.contractorEarnings], ["Configured factoring charge", -person.settlement.factoringCharge], ["Other deductions", -(person.settlement.totalDeductions - person.settlement.factoringCharge)], ["Reimbursements", person.settlement.totalReimbursements]];
    const content = ["0.06 0.17 0.24 rg 0 664 612 128 re f", "1 1 1 rg", text(48, 733, 30, "PayCore"), text(48, 704, 12, "SAMPLE PAY STATEMENT - NOT APPROVED"), "0.09 0.20 0.28 rg", text(48, 620, 22, person.name), text(48, 594, 11, `${person.reference} | October 5-18, 2026 | USD`), text(48, 570, 11, person.methodLabel ?? `${person.rate}% of eligible revenue`), ...rows.flatMap(([label, value], i) => [text(48, 530 - i * 30, 12, label), text(430, 530 - i * 30, 12, amount(value))]), "0.85 0.93 0.90 rg 40 250 532 62 re f", "0.09 0.20 0.28 rg", text(48, 274, 16, "Estimated net pay (USD)"), text(430, 274, 16, amount(person.settlement.netPay)), text(48, 200, 11, "Fictional presentation data. No payroll has been approved or paid."), text(48, 180, 11, "Sample rates only; not a production payroll policy."), text(48, 64, 11, "Developed by ETL GIS Consulting LLC"), text(48, 44, 10, `Sample statement ${index + 1} of ${people.length}`)].join("\n");
    objects[3 + index * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`;
    objects[4 + index * 2] = `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`;
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "ascii")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Uint8Array.from(Buffer.from(pdf, "ascii"));
}

export function sampleCsv(people: Statement[]): string {
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const rows = [["Status", "Period", "Contractor", "Reference", "Currency", "Gross revenue", "Rate percent", "Earnings", "Factoring charge", "Total deductions", "Reimbursements", "Estimated net pay", "Pay agreement", "Settlement lines (cents)"], ...people.map((p) => ["SAMPLE - NOT APPROVED", "2026-10-05 to 2026-10-18", p.name, p.reference, "USD", amount(p.gross), p.detail && p.detail.compensationMethod !== "PERCENT_OF_ELIGIBLE_REVENUE" ? "" : p.rate, amount(p.settlement.contractorEarnings), amount(p.settlement.factoringCharge), amount(p.settlement.totalDeductions), amount(p.settlement.totalReimbursements), amount(p.settlement.netPay), p.methodLabel ?? `${p.rate}%`, p.detail ? JSON.stringify(p.detail.lines) : "Legacy sample summary"])];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
