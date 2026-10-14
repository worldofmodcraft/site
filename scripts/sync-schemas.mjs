// Re-copy the three vendored schemas from a registry checkout, byte for byte.
//
//   node scripts/sync-schemas.mjs <registry-checkout-dir>
//
// Exit codes: 0 copied all three; 2 usage error or any of the three registry files missing
// (nothing is copied in that case -- never a subset). No network: takes a directory.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILES = ["entry", "page", "manifest"].map((n) => `${n}.schema.json`);
const siteDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "schemas");

const arg = process.argv[2];
if (!arg || process.argv.length !== 3) {
  console.error("usage: node scripts/sync-schemas.mjs <registry-checkout-dir>");
  process.exit(2);
}
const absent = FILES.map((f) => path.join(arg, "contracts", f)).filter((p) => !fs.existsSync(p));
if (absent.length) {
  for (const p of absent) console.error(`sync-schemas: MISSING ${p}`);
  console.error("sync-schemas: copied nothing");
  process.exit(2);
}
for (const f of FILES) fs.copyFileSync(path.join(arg, "contracts", f), path.join(siteDir, f));
console.log(`copied=${FILES.length}`);
