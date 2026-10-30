import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Fixed local assets only; no user input or remote requests enter image generation.
export async function brandImageData(name: "hero" | "symbol") {
  const bytes = await readFile(join(process.cwd(), "public", "brand", `paycore-${name}-3d.png`));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}
