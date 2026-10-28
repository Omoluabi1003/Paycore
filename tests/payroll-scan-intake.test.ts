import assert from "node:assert/strict";
import test from "node:test";
import { documentFingerprint, MAX_SCAN_FILE_BYTES, normalizeScanFileName, validateScanUpload } from "../lib/payroll-scan-intake";

const SHA = "a".repeat(64);

test("accepts a supported PDF with a valid fingerprint", () => {
  const result = validateScanUpload({ fileName: "Weekly Settlement.pdf", mimeType: "application/pdf", sizeBytes: 1024, sha256: SHA });
  assert.equal(result.accepted, true);
  assert.equal(result.sourceType, "PDF");
  assert.deepEqual(result.blockingReasons, []);
});

test("fails closed when extension and content type disagree", () => {
  const result = validateScanUpload({ fileName: "payroll.xlsx", mimeType: "application/pdf", sizeBytes: 1024, sha256: SHA });
  assert.equal(result.accepted, false);
  assert.match(result.blockingReasons.join(" "), /does not match/);
});

test("rejects unsupported executable content", () => {
  const result = validateScanUpload({ fileName: "payroll.exe", mimeType: "application/x-msdownload", sizeBytes: 1024, sha256: SHA });
  assert.equal(result.accepted, false);
  assert.equal(result.sourceType, undefined);
});

test("rejects oversized documents before extraction", () => {
  const result = validateScanUpload({ fileName: "large.pdf", mimeType: "application/pdf", sizeBytes: MAX_SCAN_FILE_BYTES + 1, sha256: SHA });
  assert.equal(result.accepted, false);
  assert.match(result.blockingReasons.join(" "), /25 MB/);
});

test("requires a valid SHA-256 fingerprint", () => {
  const result = validateScanUpload({ fileName: "payroll.csv", mimeType: "text/csv", sizeBytes: 100, sha256: "not-a-hash" });
  assert.equal(result.accepted, false);
  assert.match(result.blockingReasons.join(" "), /SHA-256/);
});

test("normalizes path-like file names", () => {
  assert.equal(normalizeScanFileName("  folder\\Weekly   Payroll.pdf "), "folder_Weekly Payroll.pdf");
});

test("document fingerprint is tenant scoped", () => {
  assert.equal(documentFingerprint("company-1", SHA), `company-1:${SHA}`);
  assert.notEqual(documentFingerprint("company-1", SHA), documentFingerprint("company-2", SHA));
});
