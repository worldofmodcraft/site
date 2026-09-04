#!/usr/bin/env node
// Runs before `astro build` (and `astro dev`). Reads the two allowed data sources -- registry
// data and archived source tarballs (see docs/build.md) -- and produces everything Astro's own
// pages need as plain files, so no page ever touches the filesystem/tar/markdown machinery
// itself. This keeps "where the data comes from" in exactly one place, and keeps `src/pages/**`
// boring: they read one JSON file.
//
// RECONCILED against contracts/archive-layout.md (E11): a missing README, a missing
// page.json-declared screenshot, or a whole malformed archive must DEGRADE that mod's page
// (render without the missing piece) rather than fail the build -- this file used to `throw` for
// all three, which E11 explicitly forbids ("must not fail the build ... solely because this one
// file is missing"). manifest.json itself is NOT covered by E11 (it never mentions it -- see
// docs/build.md), but the same degrade-not-fail spirit is extended to it here for consistency: a
// mod whose archive can't supply a manifest still gets a page, with license/type/display name
// shown as unavailable rather than invented (MANAGER.md SS5: never invent facts) and a loud,
// specifically-worded warning logged with the archive's identity, exactly as E11 asks for a
// malformed archive.
//
// Outputs (both gitignored -- see .gitignore -- derived, never hand-edited, never committed):
//   - CONTENT_DATA_FILE (.cache/site-content.json): one record per mod, ready for pages to render.
//   - GENERATED_PUBLIC_DIR (public/_generated/): copied screenshot files Astro serves statically.
import fs from "node:fs";
import path from "node:path";
import { loadMods } from "../src/lib/registry.mjs";
import { highestPublished } from "../src/lib/semver.mjs";
import { localArchivePathFor, extractArchive, MalformedArchiveError } from "../src/lib/archive.mjs";
import { renderReadme } from "../src/lib/markdown.mjs";
import { validateOrThrow } from "../src/lib/validate.mjs";
import { GENERATED_PUBLIC_DIR, CONTENT_DATA_FILE } from "../src/lib/config.mjs";

/** "campfire-tales" -> "Campfire Tales" -- fallback display name when manifest.json is unavailable. */
function titleCaseFromSlug(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

console.log("== prepare-content: reading registry data ==");
const mods = loadMods();
console.log(`Found ${mods.length} mod(s) in the registry checkout: ${mods.map((m) => m.id).join(", ")}`);

fs.rmSync(GENERATED_PUBLIC_DIR, { recursive: true, force: true });

const contentRecords = [];
let degradedCount = 0;

for (const mod of mods) {
  console.log(`\n-- ${mod.id} --`);
  const current = highestPublished(mod.entry.versions);
  if (!current) {
    throw new Error(
      `${mod.id}: no version has status "published" -- a mod page needs a current version to ` +
        `render README/screenshots from. (All ${mod.entry.versions.length} version(s) are removed.)`,
    );
  }
  console.log(`Current (highest published) version: ${current.version}`);

  // ---- Archive provenance (acceptance criterion 3 demands this be demonstrable in the log) ----
  const tarballPath = localArchivePathFor(current.source_archive);
  console.log(`Archive path for current version, resolved from source_archive (never fetched over`);
  console.log(`the network -- see src/lib/archive.mjs): ${tarballPath}`);

  let extractedDir = null;
  try {
    extractedDir = extractArchive(tarballPath, { ns: mod.ns, name: mod.name, version: current.version });
    console.log(`Extracted to: ${extractedDir}`);
  } catch (err) {
    if (!(err instanceof MalformedArchiveError)) throw err;
    // E11: "the version's page is built without README or screenshots for that version ... the
    // failure is logged with the archive's identity (the source_archive URL)".
    console.warn(`WARNING -- malformed archive, degrading ${mod.id}@${current.version}: ${err.message}`);
    console.warn(`WARNING -- source_archive: ${current.source_archive}`);
    degradedCount++;
  }

  // ---- manifest.json (version-bound fields with no home in entry.json/page.json) ----
  // Not covered by E11 -- see this file's header comment for why the same degrade treatment
  // is extended to it rather than failing the whole build over one mod's missing manifest.
  let manifest = null;
  if (extractedDir) {
    const manifestPath = path.join(extractedDir, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      validateOrThrow("manifest", parsed, manifestPath);
      if (parsed.id !== mod.id) {
        throw new Error(`${manifestPath}: manifest id "${parsed.id}" does not match registry id "${mod.id}".`);
      }
      manifest = parsed;
      console.log(`manifest.json read from archive: license=${manifest.license} type=${manifest.type}`);
    } else {
      console.warn(`WARNING -- no manifest.json at archive root for ${mod.id}@${current.version}; ` +
        `licence/type/display name will show as unavailable rather than invented.`);
      console.warn(`WARNING -- source_archive: ${current.source_archive}`);
    }
  }

  // ---- README, rendered from the archive, never from a live repo. E11: absence is not an error ----
  // ---- for either side -- a mod need not carry a README.                                       ----
  let readmeHtml = null;
  if (extractedDir) {
    const readmePath = path.join(extractedDir, "README.md");
    if (fs.existsSync(readmePath)) {
      const readmeSource = fs.readFileSync(readmePath, "utf8");
      readmeHtml = renderReadme(readmeSource);
      console.log(`README rendered from archive file: ${readmePath} (${readmeSource.length} bytes source)`);
    } else {
      console.log(`No README.md at archive root for ${mod.id}@${current.version} -- rendering no README (not an error, E11).`);
    }
  }

  // ---- Screenshot gallery: page.json's screenshots[] (current, editable -- ADR-0059 SS2/SS3), ----
  // ---- each path resolved and copied out of the SAME current-version archive. A single missing ----
  // ---- file omits that slot and logs it (E11); it must not take down the whole gallery/build.  ----
  const galleryUrls = [];
  if (extractedDir) {
    for (const relPath of mod.page.screenshots) {
      const abs = path.join(extractedDir, relPath);
      if (!fs.existsSync(abs)) {
        console.warn(
          `WARNING -- ${mod.id}: page.json screenshot "${relPath}" not found in archive ${tarballPath} ` +
            `(looked at ${abs}) -- omitting this gallery slot rather than failing the build (E11).`,
        );
        continue;
      }
      const destRelUrl = `/_generated/mods/${mod.ns}/${mod.name}/screenshots/${path.basename(relPath)}`;
      const destAbs = path.join(GENERATED_PUBLIC_DIR, "mods", mod.ns, mod.name, "screenshots", path.basename(relPath));
      fs.mkdirSync(path.dirname(destAbs), { recursive: true });
      fs.copyFileSync(abs, destAbs);
      galleryUrls.push(destRelUrl);
      console.log(`Screenshot copied from archive: ${abs} -> ${destRelUrl}`);
    }
  }

  // ---- Version list for display: every version in the entry, newest first ----
  const versionsForDisplay = [...mod.entry.versions].sort((a, b) => {
    // Not a semver-precedence sort on purpose -- published_at reflects actual publish order,
    // which is what a human expects a version HISTORY list to read top-to-bottom as.
    return new Date(b.published_at) - new Date(a.published_at);
  });

  contentRecords.push({
    ns: mod.ns,
    name: mod.name,
    id: mod.id,
    displayName: manifest?.name ?? titleCaseFromSlug(mod.name),
    description: mod.page.description,
    tags: mod.page.tags,
    links: mod.page.links,
    deprecated: mod.page.deprecated,
    license: manifest?.license ?? null,
    type: manifest?.type ?? null,
    aiAssisted: manifest?.ai_assisted ?? null,
    currentVersion: current.version,
    readmeHtml,
    screenshots: galleryUrls,
    versions: versionsForDisplay,
    updatedAt: current.published_at,
  });
}

fs.mkdirSync(path.dirname(CONTENT_DATA_FILE), { recursive: true });
fs.writeFileSync(CONTENT_DATA_FILE, JSON.stringify(contentRecords, null, 2));
console.log(`\nWrote ${contentRecords.length} mod record(s) to ${CONTENT_DATA_FILE}.`);
if (degradedCount > 0) {
  console.warn(`${degradedCount} mod(s) rendered with a degraded (malformed-archive) page -- see WARNING lines above.`);
}
