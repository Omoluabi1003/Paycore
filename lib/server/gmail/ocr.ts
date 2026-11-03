import { createRequire } from "node:module";
import { createWorker } from "tesseract.js";
import { imageSize } from "image-size";
const require = createRequire(import.meta.url);
export async function ocrImage(bytes: Uint8Array, timeout = 45000) {
  const dimensions = imageSize(bytes);
  if (
    !dimensions.width ||
    !dimensions.height ||
    dimensions.width * dimensions.height > 16000000
  )
    throw Error("Image exceeds the OCR pixel limit.");
  const language = require("@tesseract.js-data/eng") as {
    langPath: string;
    gzip: boolean;
  };
  const worker = await createWorker("eng", 1, {
    langPath: language.langPath,
    gzip: language.gzip,
    cacheMethod: "none",
    workerPath: require.resolve("tesseract.js/src/worker-script/node/index.js"),
    errorHandler: () => {},
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      worker.recognize(Buffer.from(bytes)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(Error("OCR time limit exceeded.")),
          timeout,
        );
      }),
    ]);
    if (result.data.confidence < 75) throw Error("OCR text is uncertain.");
    return result.data.text;
  } finally {
    if (timer) clearTimeout(timer);
    await worker.terminate();
  }
}
