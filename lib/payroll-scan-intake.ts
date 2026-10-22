import type { ScanSourceType } from "./payroll-scan";

export const MAX_SCAN_FILE_BYTES = 25 * 1024 * 1024;

export interface ScanUploadInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export interface ScanIntakeResult {
  accepted: boolean;
  sourceType?: ScanSourceType;
  normalizedFileName: string;
  blockingReasons: string[];
}

const MIME_SOURCE_TYPES: Readonly<Record<string, ScanSourceType>> = {
  "application/pdf": "PDF",
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "text/csv": "CSV",
  "application/vnd.ms-excel": "XLSX",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};

const EXTENSION_SOURCE_TYPES: Readonly<Record<string, ScanSourceType>> = {
  pdf: "PDF",
  jpg: "IMAGE",
  jpeg: "IMAGE",
  png: "IMAGE",
  webp: "IMAGE",
  csv: "CSV",
  xls: "XLSX",
  xlsx: "XLSX",
};

function extensionOf(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName.trim().toLowerCase());
  return match?.[1] ?? "";
}

export function normalizeScanFileName(fileName: string): string {
  return fileName.trim().replace(/[\\/]+/g, "_").replace(/\s+/g, " ").slice(0, 180);
}

export function validateScanUpload(input: ScanUploadInput): ScanIntakeResult {
  const blockingReasons: string[] = [];
  const normalizedFileName = normalizeScanFileName(input.fileName);
  const extension = extensionOf(normalizedFileName);
  const mimeType = input.mimeType.trim().toLowerCase();
  const sourceFromMime = MIME_SOURCE_TYPES[mimeType];
  const sourceFromExtension = EXTENSION_SOURCE_TYPES[extension];

  if (!normalizedFileName) blockingReasons.push("File name is required.");
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) blockingReasons.push("File size is invalid.");
  else if (input.sizeBytes > MAX_SCAN_FILE_BYTES) blockingReasons.push("File exceeds the 25 MB scan limit.");

  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) blockingReasons.push("A valid SHA-256 document fingerprint is required.");
  if (!sourceFromMime) blockingReasons.push(`Unsupported file type: ${mimeType || "unknown"}.`);
  if (!sourceFromExtension) blockingReasons.push(`Unsupported file extension: ${extension || "none"}.`);
  if (sourceFromMime && sourceFromExtension && sourceFromMime !== sourceFromExtension) {
    blockingReasons.push("File extension does not match the declared content type.");
  }

  return {
    accepted: blockingReasons.length === 0,
    sourceType: blockingReasons.length === 0 ? sourceFromMime : undefined,
    normalizedFileName,
    blockingReasons: [...new Set(blockingReasons)],
  };
}

export function documentFingerprint(companyId: string, sha256: string): string {
  if (!companyId.trim()) throw new Error("Company is required for scan fingerprinting.");
  if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new Error("A valid SHA-256 document fingerprint is required.");
  return `${companyId.trim()}:${sha256.toLowerCase()}`;
}
