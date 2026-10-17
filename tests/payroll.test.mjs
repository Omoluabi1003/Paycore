import assert from "node:assert/strict";
import test from "node:test";
import { calculateSettlement } from "../lib/payroll.ts";

test("contractor half-cent rounds up without binary underpayment", () => {
  assert.equal(calculateSettlement({ grossRevenue: 100.50, contractorRatePercent: 57 }).netPay, 57.29);
});

test("factoring half-cent rounds up independently", () => {
  const result = calculateSettlement({ grossRevenue: 100.50, contractorRatePercent: 100, factoringRatePercent: 57 });
  assert.equal(result.factoringCharge, 57.29);
  assert.equal(result.netPay, 43.21);
});

test("fractional percentage rates retain decimal precision", () => {
  assert.equal(calculateSettlement({ grossRevenue: 100, contractorRatePercent: 12.345 }).netPay, 12.35);
});

test("currency inputs round half-up before settlement", () => {
  const result = calculateSettlement({ grossRevenue: 1.005, contractorRatePercent: 100,
    deductions: [{ label: "Fee", amount: 0.105 }], reimbursements: [{ label: "Refund", amount: 0.205 }] });
  assert.equal(result.grossRevenue, 1.01);
  assert.equal(result.totalDeductions, 0.11);
  assert.equal(result.totalReimbursements, 0.21);
  assert.equal(result.netPay, 1.11);
});

test("negative settlements keep their review warning", () => {
  const result = calculateSettlement({ grossRevenue: 10, contractorRatePercent: 50,
    deductions: [{ label: "Advance", amount: 6 }] });
  assert.equal(result.netPay, -1);
  assert.equal(result.warnings.length, 1);
});

test("zero revenue and omitted optional amounts are supported", () => {
  const result = calculateSettlement({ grossRevenue: 0, contractorRatePercent: 0 });
  assert.equal(result.netPay, 0);
  assert.deepEqual(result.warnings, []);
});

test("invalid monetary values and rates fail validation", () => {
  for (const grossRevenue of [-1, NaN, Infinity]) {
    assert.throws(() => calculateSettlement({ grossRevenue, contractorRatePercent: 50 }));
  }
  for (const contractorRatePercent of [-1, 101, NaN, Infinity]) {
    assert.throws(() => calculateSettlement({ grossRevenue: 100, contractorRatePercent }));
  }
});

test("amounts beyond exact integer cents fail closed", () => {
  assert.throws(() => calculateSettlement({ grossRevenue: Number.MAX_SAFE_INTEGER, contractorRatePercent: 100 }), RangeError);
});
