import { ocrImage } from "./ocr.ts";
import {
  extractDocumentCsv,
  extractDocumentFields,
  documentIssues,
  emptyDocumentFields,
} from "../../document-import.ts";
import type { DocumentFields } from "../../document-import.ts";
export type MailSource = {
  sourceUrl?:string;
  name: string;
  mime: string;
  bytes: Uint8Array;
  receivedAt: string;
  subject: string;
  sender: string;
};
export type ExtractedBilling = {
  fields: DocumentFields;
  issues: string[];
  relevant: boolean;
};
export function htmlText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?(?:br|p|div|tr|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');
}
export const billingMarker = (value: string) =>
  /\b(invoices?|receipts?|billing|tax invoice|payment confirmation)\b/i.test(
    value.replaceAll("_", " "),
  );
export async function pdfText(bytes: Uint8Array) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  try {
    const document = await task.promise;
    if (document.numPages > 30) throw Error("PDF exceeds 30 pages.");
    let text = "";
    for (let n = 1; n <= document.numPages; n++) {
      const content = await (await document.getPage(n)).getTextContent();
      let y: number | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        if (y !== undefined && Math.abs(y - item.transform[5]) > 3)
          text += "\n";
        text += item.str + (item.hasEOL ? "\n" : " ");
        y = item.transform[5];
      }
      text += "\n";
      if (text.length > 100000)
        throw Error("PDF text exceeds the extraction limit.");
    }
    if (!text.trim()) {
      if (document.numPages > 5)
        throw Error("Scanned PDF exceeds five OCR pages.");
      const { createCanvas } = await import("@napi-rs/canvas");
      const deadline = Date.now() + 90000;
      for (let n = 1; n <= document.numPages; n++) {
        const page = await document.getPage(n),
          viewport = page.getViewport({ scale: 2 });
        if (
          viewport.width * viewport.height > 16000000 ||
          Date.now() > deadline
        )
          throw Error("Scanned PDF exceeds OCR limits.");
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        await page.render({
          canvas: canvas as any,
          canvasContext: canvas.getContext("2d") as any,
          viewport,
        }).promise;
        text +=
          (await ocrImage(
            canvas.toBuffer("image/png"),
            Math.min(45000, Math.max(1, deadline - Date.now())),
          )) + "\n";
      }
    }
    return text;
  } finally {
    await task.destroy();
  }
}
export async function extractBilling(
  source: MailSource,
  readPdf = pdfText,
): Promise<ExtractedBilling> {
  const relevant = billingMarker(`${source.subject} ${source.name}`);
  if (source.bytes.byteLength > 10 * 1024 * 1024)
    return {
      fields: emptyDocumentFields(),
      issues: ["Document exceeds the 10 MB automatic extraction limit."],
      relevant,
    };
  try {
    let text = "";
    const mime = source.mime.toLowerCase();
    if (
      mime === "application/pdf" ||
      source.name.toLowerCase().endsWith(".pdf")
    ) {
      if (Buffer.from(source.bytes.slice(0, 5)).toString() !== "%PDF-")
        throw Error("Invalid PDF.");
      text = await readPdf(source.bytes);
    } else if (
      mime === "text/csv" ||
      source.name.toLowerCase().endsWith(".csv")
    )
      text = Buffer.from(source.bytes).toString("utf8");
    else if (mime === "text/plain" || mime === "text/html")
      text = Buffer.from(source.bytes).toString("utf8");
    else if (mime.startsWith("image/")) text = await ocrImage(source.bytes);
    else
      return {
        fields: emptyDocumentFields(),
        issues: ["This document needs OCR or an unsupported-file extractor."],
        relevant,
      };
    if (mime === "text/html") text = htmlText(text);
    if (text.length > 100000)
      throw Error("Document text exceeds the extraction limit.");
    const result =
      mime === "text/csv" || source.name.toLowerCase().endsWith(".csv")
        ? extractDocumentCsv(text)
        : extractDocumentFields(text);
    if (
      /^(?:dear|hello|hi\b|thank you|thanks|statement\b)/i.test(
        result.fields.vendor,
      )
    )
      result.fields.vendor = "";
    if (
      !result.fields.vendor &&
      ["text/plain", "text/html"].includes(mime) &&
      source.name === "Email body"
    ) {
      const display = /^\s*"?([^<"]+)"?\s*</.exec(source.sender)?.[1]?.trim();
      if (display && display.length <= 240) result.fields.vendor = display;
    }
    const issues = [...result.warnings, ...documentIssues(result.fields)];
    if (!text.trim()) issues.push("No readable text. OCR is required.");
    return {
      fields: result.fields,
      issues: [...new Set(issues)],
      relevant: relevant || billingMarker(text),
    };
  } catch {
    return {
      fields: emptyDocumentFields(),
      issues: [
        "The document could not be read automatically. The original remains available.",
      ],
      relevant,
    };
  }
}
export type GmailPart = {
  filename?: string;
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};
export function messageParts(payload: GmailPart) {
  const files: GmailPart[] = [],
    bodies: GmailPart[] = [];
  function visit(part: GmailPart) {
    if (
      part.filename &&
      part.body &&
      (part.body.attachmentId || part.body.data)
    ) {
      const disposition =
        part.headers?.find(
          (header) => header.name.toLowerCase() === "content-disposition",
        )?.value ?? "";
      if (!/^inline/i.test(disposition) || billingMarker(part.filename))
        files.push(part);
    } else if (
      ["text/plain", "text/html"].includes(part.mimeType ?? "") &&
      (part.body?.data || part.body?.attachmentId)
    )
      bodies.push(part);
    for (const child of part.parts ?? []) visit(child);
  }
  visit(payload);
  return { files, bodies };
}
