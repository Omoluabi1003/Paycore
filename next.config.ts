import type { NextConfig } from "next";
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
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@tesseract.js-data/eng/4.0.0/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
};
export default nextConfig;
