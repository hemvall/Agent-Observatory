import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const ignored = new Set([
  "node_modules",
  ".git",
  ".sites-runtime",
  ".wrangler",
  "dist",
  ".next",
  ".vinext",
  ".agents",
  ".codex",
  "outputs",
  "work",
  "coverage",
]);
function collect(directory = "") {
  return readdirSync(path.join(root, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (
      ignored.has(entry.name) ||
      relative === "public/source.tar.gz" ||
      entry.name.endsWith(".tsbuildinfo") ||
      entry.name.endsWith(".pem") ||
      (entry.name.startsWith(".env") && entry.name !== ".env.example") ||
      entry.name.startsWith(".dev.vars")
    )
      return [];
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory()
      ? collect(relative)
      : entry.isFile()
        ? [relative]
        : [];
  });
}
const result = spawnSync(
  "tar",
  [
    "-czf",
    path.join(root, "public/source.tar.gz"),
    "--null",
    "--verbatim-files-from",
    "-C",
    root,
    "-T",
    "-",
  ],
  { input: collect().join("\0") + "\0", encoding: "utf8" },
);
if (result.status !== 0)
  throw new Error(result.stderr || "Source archive creation failed");
console.log("Corresponding source archive ready at public/source.tar.gz");
