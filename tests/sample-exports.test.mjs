import assert from "node:assert/strict";
import test from "node:test";
import { samplePdf, sampleCsv } from "../lib/sample-exports.ts";
import { calculateSettlement } from "../lib/payroll.ts";
const person = { name: "Fictional Person", reference: "PC-SAMPLE", gross: 100.50, rate: 57, settlement: calculateSettlement({ grossRevenue: 100.50, contractorRatePercent: 57 }) };
test("CSV exports the calculated cents and unmistakable sample status", () => {
  const csv = sampleCsv([person]);
  assert.ok(csv.includes('"SAMPLE - NOT APPROVED"'));
  assert.ok(csv.includes('"57.29"'));
  assert.equal(csv.split("\r\n").length, 3);
});
test("PDF contains each statement and a valid object offset table", () => {
  const pdf = Buffer.from(samplePdf([person, { ...person, reference: "PC-SECOND" }])).toString("ascii");
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.ok(pdf.includes("/Count 2"));
  assert.ok(pdf.includes("SAMPLE PAY STATEMENT - NOT APPROVED"));
  assert.ok(pdf.includes("57.29"));
  const start = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(start, start + 4), "xref");
  const offsets = [...pdf.matchAll(/(\d{10}) 00000 n /g)].map((match) => Number(match[1]));
  offsets.forEach((offset, index) => assert.ok(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)));
});
