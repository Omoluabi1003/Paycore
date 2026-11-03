import { readdir, readFile, lstat, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
async function manifests(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await manifests(path)));
    else if (entry.name.endsWith(".nft.json")) found.push(path);
  }
  return found;
}
const files = await manifests(process.argv[2] ?? ".next/server");
if (!files.length) throw Error("No server trace manifests were generated.");
const conflicts = [];
for (const manifest of files) {
  const traced = JSON.parse(await readFile(manifest, "utf8")).files;
  const names = new Set(traced.map((name) => resolve(dirname(manifest), name)));
  for (const name of names) {
    if (
      !(await lstat(name)).isSymbolicLink() ||
      !(await stat(name)).isDirectory()
    )
      continue;
    const nested = [...names].find((other) => other.startsWith(name + "/"));
    if (nested)
      conflicts.push(`${manifest}: ${name} contains traced file ${nested}`);
  }
}
if (conflicts.length)
  throw Error(
    "Invalid serverless package: files are traced underneath directory symlinks. Trace physical package paths instead.\n" +
      conflicts.join("\n"),
  );
console.log(
  `Validated ${files.length} server traces: no files nested beneath directory symlinks.`,
);
