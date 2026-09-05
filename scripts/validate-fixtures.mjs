#!/usr/bin/env node
// Standalone demonstration for acceptance criterion: "Fixtures must validate against the
// registry's schemas. Demonstrate that they do, rather than asserting it." Run via
// `npm run validate-fixtures`. Exits non-zero (and prints why) on the first invalid fixture --
// no partial-pass reporting that could be misread as a green result.
import fs from "node:fs";
import path from "node:path";
import { REGISTRY_DIR } from "../src/lib/config.mjs";
import { validateOrThrow } from "../src/lib/validate.mjs";

let checked = 0;

const modsDir = path.join(REGISTRY_DIR, "mods");
for (const d of fs.readdirSync(modsDir, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const dir = path.join(modsDir, d.name);

  const entryPath = path.join(dir, "entry.json");
  const entry = JSON.parse(fs.readFileSync(entryPath, "utf8"));
  validateOrThrow("entry", entry, entryPath);
  console.log(`OK  entry.schema.json  <-  ${entryPath}`);
  checked++;

  const pagePath = path.join(dir, "page.json");
  const page = JSON.parse(fs.readFileSync(pagePath, "utf8"));
  validateOrThrow("page", page, pagePath);
  console.log(`OK  page.schema.json   <-  ${pagePath}`);
  checked++;
}

// manifest.json fixtures live inside fixtures/archives-src (the pre-tar source trees), one per
// mod version, per the same "manifest.json at tarball root" assumption src/lib/archive.mjs
// documents.
const archivesSrcDir = path.resolve(REGISTRY_DIR, "..", "archives-src");
function walkManifests(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkManifests(p);
    else if (entry.name === "manifest.json") {
      const manifest = JSON.parse(fs.readFileSync(p, "utf8"));
      validateOrThrow("manifest", manifest, p);
      console.log(`OK  manifest.schema.json  <-  ${p}`);
      checked++;
    }
  }
}
walkManifests(archivesSrcDir);

if (checked === 0) {
  console.error("No fixture files were found to validate -- this would be a false pass.");
  process.exit(1);
}
console.log(`\n${checked} fixture file(s) validated against schemas/*.schema.json. All valid.`);
