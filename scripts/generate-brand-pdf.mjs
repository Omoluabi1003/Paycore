import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
const fromNext = createRequire(import.meta.resolve("next/package.json"));
const sharp = fromNext("sharp");
// Delivery encoding only: retain the approved artwork and transparency at print
// resolution. PDF RGB + soft-mask streams avoid a box behind the sculpted mark.
const source = await readFile(new URL("../public/brand/paycore-symbol-3d.png", import.meta.url));
const pixels = await sharp(source).resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
const rgb = Buffer.alloc(192 * 192 * 3), alpha = Buffer.alloc(192 * 192);
for (let i = 0; i < alpha.length; i++) {
  pixels.copy(rgb, i * 3, i * 4, i * 4 + 3);
  alpha[i] = pixels[i * 4 + 3];
}
const content = `// Generated from the approved symbol by scripts/generate-brand-pdf.mjs.
const rgb = ${JSON.stringify(deflateSync(rgb).toString("base64"))};
const alpha = ${JSON.stringify(deflateSync(alpha).toString("base64"))};
function imageObject(data: string, colorSpace: string, mask = "") {
  const hex = [...atob(data)].map(char => char.charCodeAt(0).toString(16).padStart(2, "0")).join("") + ">";
  return \`<< /Type /XObject /Subtype /Image /Width 192 /Height 192 /ColorSpace /\${colorSpace} /BitsPerComponent 8 \${mask} /Filter [/ASCIIHexDecode /FlateDecode] /Length \${hex.length} >>\\nstream\\n\${hex}\\nendstream\`;
}
export const brandPdfImageObject = (maskObject: number) => imageObject(rgb, "DeviceRGB", \`/SMask \${maskObject} 0 R\`);
export const brandPdfMaskObject = () => imageObject(alpha, "DeviceGray");
export const drawBrandMark = (x: number, y: number, size: number) => \`q \${size} 0 0 \${size} \${x} \${y} cm /PayCoreMark Do Q\`;
`;
await writeFile(new URL("../lib/brand-pdf-image.ts", import.meta.url), content);
// Keep the legacy public URL compatible, displaying the approved mark.
await writeFile(new URL("../public/paycore-mark.svg", import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254"><image width="1254" height="1254" href="data:image/png;base64,${source.toString("base64")}"/></svg>\n`);
console.log("Generated transparent PDF encoding and compatible public mark.");
