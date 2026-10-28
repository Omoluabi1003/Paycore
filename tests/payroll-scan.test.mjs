import assert from "node:assert/strict";
import test from "node:test";
import { classifyConfidence, reconcileScan, summarizeScan, assertScanReadyForCommit } from "../lib/payroll-scan.ts";

const verified = (id, amountCents, extra = {}) => ({
  id,
  documentId: "doc-1",
  amountCents,
  sourceFieldIds: [`field-${id}`],
  state: "VERIFIED",
  issues: [],
  ...extra
});

test("confidence is translated into operator review states", () => {
  assert.equal(classifyConfidence(0.999), "VERIFIED");
  assert.equal(classifyConfidence(0.9), "NEEDS_REVIEW");
  assert.equal(classifyConfidence(0.4), "UNREADABLE");
  assert.equal(classifyConfidence(2), "UNREADABLE");
});

test("a fully verified scan reconciles to an explicit source total", () => {
  const records = [verified("load-1", 245000), verified("load-2", 187500), verified("fuel", -42500)];
  const reconciliation = reconcileScan(records, 390000);
  assert.equal(reconciliation.extractedTotalCents, 390000);
  assert.equal(reconciliation.reconciled, true);
  const summary = summarizeScan(records, reconciliation);
  assert.equal(summary.canApprove, true);
  assert.doesNotThrow(() => assertScanReadyForCommit(summary));
});

test("a source-total mismatch blocks scan approval", () => {
  const records = [verified("load-1", 245000), verified("load-2", 187500)];
  const reconciliation = reconcileScan(records, 450000);
  assert.equal(reconciliation.differenceCents, 17500);
  assert.equal(reconciliation.reconciled, false);
  const summary = summarizeScan(records, reconciliation);
  assert.equal(summary.canApprove, false);
  assert.throws(() => assertScanReadyForCommit(summary));
});

test("uncertain or duplicate candidates cannot silently pass", () => {
  const records = [
    verified("load-1", 245000),
    { ...verified("fuel", -42500), state: "NEEDS_REVIEW" },
    verified("load-2", 187500, { possibleDuplicateOf: "existing-load-10591" })
  ];
  const reconciliation = reconcileScan(records, 390000);
  assert.equal(reconciliation.reconciled, false);
  assert.ok(reconciliation.blockingReasons.some((reason) => reason.includes("requires review")));
  assert.ok(reconciliation.blockingReasons.some((reason) => reason.includes("duplicate")));
});

test("absence of a trustworthy source total is not called reconciled", () => {
  const records = [verified("load-1", 245000)];
  const reconciliation = reconcileScan(records);
  assert.equal(reconciliation.extractedTotalCents, 245000);
  assert.equal(reconciliation.reconciled, false);
  assert.equal(summarizeScan(records, reconciliation).canApprove, false);
});
