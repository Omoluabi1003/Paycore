export type ScanReviewState = "VERIFIED" | "NEEDS_REVIEW" | "UNREADABLE";
export type ScanSourceType = "PDF" | "SCANNED_PDF" | "IMAGE" | "CSV" | "XLSX" | "TMS" | "ACCOUNTING";
export type ScanFieldKind = "CONTRACTOR" | "LOAD_REFERENCE" | "DATE" | "MONEY" | "MILES" | "CATEGORY" | "TEXT";

export interface SourceRegion {
  page?: number;
  sheet?: string;
  row?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ScanDocument {
  id: string;
  companyId: string;
  fileName: string;
  sourceType: ScanSourceType;
  sha256: string;
  pageCount?: number;
  receivedAt: string;
  receivedBy: string;
}

export interface ExtractedField {
  id: string;
  documentId: string;
  kind: ScanFieldKind;
  rawText: string;
  normalizedValue: string | number | null;
  confidence: number;
  state: ScanReviewState;
  region: SourceRegion;
  extractor: string;
  reasons: string[];
}

export interface ScanCandidateRecord {
  id: string;
  documentId: string;
  contractorId?: string;
  reference?: string;
  transactionDate?: string;
  category?: string;
  amountCents?: number;
  miles?: number;
  sourceFieldIds: string[];
  state: ScanReviewState;
  issues: string[];
  possibleDuplicateOf?: string;
}

export interface ReconciliationResult {
  sourceTotalCents?: number;
  extractedTotalCents: number;
  differenceCents?: number;
  reconciled: boolean;
  blockingReasons: string[];
}

export interface ScanReviewSummary {
  total: number;
  verified: number;
  needsReview: number;
  unreadable: number;
  canApprove: boolean;
}

export function classifyConfidence(confidence: number): ScanReviewState {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return "UNREADABLE";
  if (confidence >= 0.985) return "VERIFIED";
  if (confidence >= 0.7) return "NEEDS_REVIEW";
  return "UNREADABLE";
}

export function reconcileScan(records: readonly ScanCandidateRecord[], sourceTotalCents?: number): ReconciliationResult {
  const blockingReasons: string[] = [];
  let extractedTotalCents = 0;

  for (const record of records) {
    if (record.state !== "VERIFIED") blockingReasons.push(`Record ${record.id} requires review.`);
    if (record.possibleDuplicateOf) blockingReasons.push(`Record ${record.id} may duplicate ${record.possibleDuplicateOf}.`);
    if (record.amountCents !== undefined) {
      if (!Number.isSafeInteger(record.amountCents)) blockingReasons.push(`Record ${record.id} has an unsafe amount.`);
      else extractedTotalCents += record.amountCents;
    }
  }

  if (!Number.isSafeInteger(extractedTotalCents)) blockingReasons.push("Extracted total exceeds the safe integer-cent range.");
  const differenceCents = sourceTotalCents === undefined ? undefined : sourceTotalCents - extractedTotalCents;
  if (differenceCents !== undefined && differenceCents !== 0) blockingReasons.push(`Source and extracted totals differ by ${differenceCents} cents.`);

  return {
    sourceTotalCents,
    extractedTotalCents,
    differenceCents,
    reconciled: sourceTotalCents !== undefined && differenceCents === 0 && blockingReasons.length === 0,
    blockingReasons: [...new Set(blockingReasons)]
  };
}

export function summarizeScan(records: readonly ScanCandidateRecord[], reconciliation: ReconciliationResult): ScanReviewSummary {
  const verified = records.filter((record) => record.state === "VERIFIED").length;
  const needsReview = records.filter((record) => record.state === "NEEDS_REVIEW").length;
  const unreadable = records.filter((record) => record.state === "UNREADABLE").length;
  return {
    total: records.length,
    verified,
    needsReview,
    unreadable,
    canApprove: records.length > 0 && needsReview === 0 && unreadable === 0 && reconciliation.reconciled
  };
}

export function assertScanReadyForCommit(summary: ScanReviewSummary): void {
  if (!summary.canApprove) throw new Error("Scan cannot be committed until every record is verified and the source reconciles.");
}
