import test from 'node:test';
import assert from 'node:assert/strict';
import { samplePdf } from '../lib/sample-exports.ts';
import { reportPdf } from '../lib/report-pdf.ts';
import { brandPdfImageObject, brandPdfMaskObject } from '../lib/brand-pdf-image.ts';

function checkBrand(bytes, pages) {
  const pdf = new TextDecoder().decode(bytes);
  assert.equal((pdf.match(/\/Subtype \/Image/g) ?? []).length, 2, 'Reuse one approved image and its transparency mask across pages');
  const references = [...pdf.matchAll(/\/PayCoreMark (\d+) 0 R/g)];
  assert.equal(references.length, pages);
  for (const reference of references) assert.ok(pdf.includes(`${reference[1]} 0 obj\n${brandPdfImageObject(Number(reference[1])+1)}`), 'Resource resolves to the approved image');
  assert.ok(pdf.includes(brandPdfMaskObject()), 'Use the approved transparency mask');
  assert.equal((pdf.match(/\/PayCoreMark Do/g) ?? []).length, pages);
  const offsets = [...pdf.matchAll(/(\d{10}) 00000 n /g)].map(match => Number(match[1]));
  offsets.forEach((offset, index) => assert.ok(pdf.slice(offset).startsWith(`${index + 1} 0 obj`), 'Image keeps object offsets valid'));
}
test('sample statement pages share the approved sculptural logo without corrupting PDF offsets', () => {
  const person = { name: 'Synthetic Person', reference: 'SYN-1', gross: 100, rate: 70, settlement: { contractorEarnings: 70, factoringCharge: 0, totalDeductions: 0, totalReimbursements: 0, netPay: 70 } };
  checkBrand(samplePdf([person, { ...person, reference: 'SYN-2' }]), 2);
});
test('report documents embed the same approved brand mark', () => {
  checkBrand(reportPdf({ companyName: 'Synthetic Company', title: 'Synthetic report', filterLabel: 'Fictional records', columns: ['Contractor', 'Net'], rows: [['Synthetic Person', '$70.00']], totals: [['Net', '$70.00']] }), 1);
});
