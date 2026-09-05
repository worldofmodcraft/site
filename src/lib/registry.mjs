// Reads registry data (data input #1 of the two the build is allowed -- see docs/build.md) from
// REGISTRY_DIR (src/lib/config.mjs), validating every file against the vendored schemas.
import fs from "node:fs";
import path from "node:path";
import { REGISTRY_DIR } from "./config.mjs";
import { validateOrThrow } from "./validate.mjs";

/**
 * @typedef {{ns: string, name: string, id: string, entry: object, page: object, dir: string}} ModRecord
 */

/** @returns {ModRecord[]} every mod found under REGISTRY_DIR/mods, entry+page validated */
export function loadMods() {
  const modsDir = path.join(REGISTRY_DIR, "mods");
  if (!fs.existsSync(modsDir)) {
    throw new Error(`No mods directory at ${modsDir}. Check REGISTRY_DIR (src/lib/config.mjs).`);
  }
  const dirNames = fs.readdirSync(modsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  if (dirNames.length === 0) {
    throw new Error(`${modsDir} contains no mod directories -- nothing to build.`);
  }

  const mods = dirNames.map((d) => {
    const dir = path.join(modsDir, d.name);
    const entryPath = path.join(dir, "entry.json");
    const pagePath = path.join(dir, "page.json");
    const entry = JSON.parse(fs.readFileSync(entryPath, "utf8"));
    const page = JSON.parse(fs.readFileSync(pagePath, "utf8"));
    validateOrThrow("entry", entry, entryPath);
    validateOrThrow("page", page, pagePath);

    const [ns, name] = entry.id.split(":");
    if (`${ns}.${name}` !== d.name) {
      throw new Error(
        `${entryPath}: id "${entry.id}" does not match its directory name "${d.name}" ` +
          `(expected directory "${ns}.${name}").`,
      );
    }
    return { ns, name, id: entry.id, entry, page, dir };
  });

  // entry.schema.json's `id` pattern already guarantees namespace/name shape; this only checks
  // for two mods claiming the same id via different directories, which would be a fixture bug.
  const seen = new Set();
  for (const m of mods) {
    if (seen.has(m.id)) throw new Error(`Duplicate mod id "${m.id}" across registry directories.`);
    seen.add(m.id);
  }

  return mods;
}
