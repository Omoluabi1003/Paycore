import type { ExtractedField, ScanDocument, ScanSourceType } from "./payroll-scan";

export interface ScanExtractionRequest {
  document: ScanDocument;
  objectKey: string;
  mimeType: string;
}

export interface ScanExtractionResult {
  extractor: string;
  fields: ExtractedField[];
  sourceTotalCents?: number;
  warnings: string[];
}

export interface ScanExtractor {
  readonly name: string;
  readonly supportedSources: readonly ScanSourceType[];
  extract(request: ScanExtractionRequest): Promise<ScanExtractionResult>;
}

export function selectExtractor(extractors: readonly ScanExtractor[], sourceType: ScanSourceType): ScanExtractor {
  const extractor = extractors.find((candidate) => candidate.supportedSources.includes(sourceType));
  if (!extractor) throw new Error(`No scan extractor is configured for ${sourceType}.`);
  return extractor;
}

// Production adapters must live behind this contract. Provider output is evidence,
// never authority: extracted fields still pass reconciliation and specialist review.
