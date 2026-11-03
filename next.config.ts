import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { dirname, relative } from "node:path";
const require = createRequire(import.meta.url);
// Trace physical package files, not children of pnpm's directory symlinks.
// Listing both a symlink and files under it produces an invalid Vercel package.
function packageFiles(name: string, pattern: string) {
  const directory = realpathSync(
    dirname(require.resolve(`${name}/package.json`)),
  );
  return `./${relative(process.cwd(), directory).replaceAll("\\", "/")}/${pattern}`;
}
const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "pg",
    "tesseract.js",
    "tesseract.js-core",
    "@tesseract.js-data/eng",
    "image-size",
  ],
  outputFileTracingIncludes: {
    "/api/cron/gmail-sync": [
      packageFiles("pdfjs-dist", "legacy/build/pdf.worker.mjs"),
      packageFiles("tesseract.js", "src/**/*"),
      packageFiles("tesseract.js-core", "**/*"),
      packageFiles("@tesseract.js-data/eng", "4.0.0/*"),
      packageFiles("@napi-rs/canvas", "**/*"),
    ],
  },
};
export default nextConfig;
