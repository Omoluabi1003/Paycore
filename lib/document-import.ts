import { z } from "zod";
const short = z.string().trim().max(240);
export const DocumentFieldsSchema = z.object({
  kind: z.enum(["INVOICE", "RECEIPT"]),
  vendor: short,
  reference: short,
  date: z.string().max(10),
  amount: z.string().max(30),
  currency: z.enum(["USD"]),
  address: z.string().trim().max(1000),
  phone: short,
  category: z.enum(["BUSINESS_EXPENSE", "FUEL", "LOAD_DOCUMENT"]),
  loadReference: short,
  assignment: short,
});
export type DocumentFields = z.infer<typeof DocumentFieldsSchema>;
export const emptyDocumentFields = (): DocumentFields => ({
  kind: "INVOICE",
  vendor: "",
  reference: "",
  date: "",
  amount: "",
  currency: "USD",
  address: "",
  phone: "",
  category: "BUSINESS_EXPENSE",
  loadReference: "",
  assignment: "",
});
export function documentAmountCents(value: string) {
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(value))
    throw Error("Enter a positive USD amount with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (cents <= BigInt(0) || cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw Error("Check the document amount.");
  return Number(cents);
}
export function documentIssues(fields: DocumentFields) {
  const issues: string[] = [];
  if (!fields.vendor.trim()) issues.push("Vendor is required.");
  if (!fields.reference.trim())
    issues.push("Invoice or receipt number is required.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fields.date) ||
    Number.isNaN(Date.parse(fields.date + "T00:00:00Z")) ||
    new Date(fields.date + "T00:00:00Z").toISOString().slice(0, 10) !==
      fields.date
  )
    issues.push("A valid document date is required.");
  try {
    documentAmountCents(fields.amount);
  } catch (e) {
    issues.push((e as Error).message);
  }
  return issues;
}
export function extractDocumentFields(text: string): {
  fields: DocumentFields;
  warnings: string[];
} {
  const fields = emptyDocumentFields(),
    warnings: string[] = [];
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const capture = (pattern: RegExp) =>
    lines.map((line) => pattern.exec(line)?.[1]?.trim()).find(Boolean) ?? "";
  fields.kind =
    /\breceipt\b/i.test(text) && !/\binvoice\b/i.test(text)
      ? "RECEIPT"
      : "INVOICE";
  fields.vendor = capture(/^(?:vendor|supplier|sold by|merchant)\s*:\s*(.+)$/i);
  if (!fields.vendor) {
    const first = lines[0] ?? "";
    if (
      first.length <= 160 &&
      !/invoice|receipt|date|total|bill to|^(?:vendor|supplier|merchant|address|phone|currency)\s*:/i.test(
        first,
      )
    )
      fields.vendor = first;
  }
  fields.reference = capture(
    /^(?:invoice|receipt)\s*(?:(?:number|no\.?|#)\s*[:#-]?\s*|[:#-]\s*)([A-Z0-9][A-Z0-9_./-]*)\s*$/i,
  );
  const rawDate = capture(
    /^(?:(?:invoice|receipt)\s+)?date\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/i,
  );
  if (rawDate) {
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(rawDate);
    fields.date = us
      ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`
      : rawDate;
  }
  const totals = lines.flatMap((line) => {
    const match =
      /^(?:grand total|invoice total|total amount|total cost|total)\s*:?\s*(?:USD\s*)?\$?\s*([\d,]+\.\d{2})(?:\s*USD)?$/i.exec(
        line,
      );
    return match ? [match[1].replaceAll(",", "")] : [];
  });
  if (new Set(totals).size === 1) fields.amount = totals[0];
  else if (totals.length)
    warnings.push("Multiple totals found. Check the source total.");
  if (
    /(?:\bEUR\b|\bGBP\b|\bCAD\b|\bAUD\b|\bJPY\b|€|£)/.test(text) ||
    lines.some(
      (line) =>
        /^currency\s*:/i.test(line) && !/^currency\s*:\s*USD$/i.test(line),
    )
  ) {
    fields.amount = "";
    warnings.push("Possible non-USD currency. Only USD records are supported.");
  }
  fields.address = capture(
    /^(?:vendor address|supplier address|merchant address|address)\s*:\s*(.+)$/i,
  );
  fields.phone = capture(/^(?:vendor phone|phone|telephone|tel)\s*:\s*(.+)$/i);
  fields.loadReference = capture(
    /^(?:load|load number|load #|load reference)\s*:\s*(.+)$/i,
  );
  if (/\bfuel\b|\bdiesel\b/i.test(text)) fields.category = "FUEL";
  if (!text.trim())
    warnings.push(
      "No readable text found. Enter the fields while checking the original document.",
    );
  return { fields: DocumentFieldsSchema.parse(fields), warnings };
}

// One billing document per CSV. Quoted commas/newlines remain part of a field.
export function extractDocumentCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === "," || char === "\n")) {
      row.push(cell.trim());
      cell = "";
      if (char === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (char !== "\r") cell += char;
  }
  if (quoted) throw Error("The CSV contains an unfinished quoted field.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length !== 2)
    throw Error(
      "Import a CSV with one header row and one invoice or receipt row. Split multiple documents into separate files.",
    );
  const headers = rows[0].map((value) =>
    value
      .replace(/^\uFEFF/, "")
      .toLowerCase()
      .replace(/[ _-]+/g, ""),
  );
  if (new Set(headers).size !== headers.length)
    throw Error("CSV column names must be unique.");
  if (rows[0].length !== rows[1].length)
    throw Error("CSV headers and values must have the same number of columns.");
  const get = (...names: string[]) => {
    const index = headers.findIndex((value) => names.includes(value));
    return index < 0 ? "" : rows[1][index];
  };
  const fields = emptyDocumentFields();
  fields.vendor = get("vendor", "supplier", "merchant");
  fields.reference = get("reference", "invoicenumber", "receiptnumber");
  fields.date = get("date", "invoicedate", "receiptdate");
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(fields.date);
  if (us)
    fields.date = `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  fields.amount = get("total", "amount")
    .replace(/^[\s$]+/, "")
    .replaceAll(",", "");
  fields.address = get("address", "vendoraddress");
  fields.phone = get("phone", "vendorphone");
  fields.loadReference = get("loadreference");
  if (get("kind", "type").toUpperCase() === "RECEIPT") fields.kind = "RECEIPT";
  const warnings: string[] = [];
  const currency = get("currency") || "USD";
  if (currency.toUpperCase() !== "USD") {
    fields.amount = "";
    warnings.push("Possible non-USD currency. Only USD records are supported.");
  }
  return { fields: DocumentFieldsSchema.parse(fields), warnings };
}
