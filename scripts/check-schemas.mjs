// Compare the site's vendored schemas with a registry checkout, by SHA-256 of the raw bytes.
//
//   node scripts/check-schemas.mjs <registry-checkout-dir>
//
// Exit codes (distinct, by design):
//   0  all three files are byte-identical; prints "compared=3 differ=0"
//   1  at least one file differs; EVERY differing file is named (not just the first)
//   2  usage error or a missing input: no argument, registry dir missing, or any of the three
//      files missing on either side (a missing file is not "no differences"), or nothing compared
//
// Raw bytes only: parsed-JSON equality would hide whitespace and key-order drift; the contract
// is the file. No network: the caller (workflow or human) provides the checkout directory.
// The file list is the three names of depgraph edge E10 (task 041 assumption A).
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILES = ["entry", "page", "manifest"].map((n) => `${n}.schema.json`);
const siteDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "schemas");

const sha = (p) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");

const arg = process.argv[2];
if (!arg || process.argv.length !== 3) {
  console.error("usage: node scripts/check-schemas.mjs <registry-checkout-dir>");
  process.exit(2);
}
const contracts = path.join(arg, "contracts");
if (!fs.existsSync(contracts) || !fs.statSync(contracts).isDirectory()) {
  console.error(`check-schemas: no contracts/ directory in ${arg}`);
  process.exit(2);
}

const missing = [];
const differ = [];
let compared = 0;
for (const f of FILES) {
  const a = path.join(siteDir, f);
  const b = path.join(contracts, f);
  let bad = false;
  if (!fs.existsSync(a)) { missing.push(`site copy ${a}`); bad = true; }
  if (!fs.existsSync(b)) { missing.push(`registry file ${b}`); bad = true; }
  if (bad) continue;
  compared++;
  const sa = sha(a), sb = sha(b);
  if (sa !== sb) differ.push(`${f} site=${sa} registry=${sb}`);
}
if (missing.length) {
  for (const m of missing) console.error(`check-schemas: MISSING ${m}`);
  process.exit(2);
}
if (compared === 0) {
  console.error("check-schemas: nothing was compared (empty file list) -- refusing to report success");
  process.exit(2);
}
if (differ.length) {
  for (const d of differ) console.error(`check-schemas: DIFFERS ${d}`);
  console.error(`compared=${compared} differ=${differ.length}`);
  process.exit(1);
}
console.log(`compared=${compared} differ=0`);
