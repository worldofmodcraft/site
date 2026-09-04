#!/usr/bin/env node
// Builds the fixture "archived source tarballs" (standing in for depgraph N6's artifact-store)
// from fixtures/archives-src/, and writes each tarball's real sha256 back into the matching
// version object in fixtures/registry/mods/*/entry.json (fields whose PLACEHOLDER_REPLACE_AFTER_TAR
// value marks them as needing it -- every other version's source_sha256 is deliberately left as an
// illustrative placeholder, see the _fixture_note in each entry.json for why).
//
// This is a fixture-authoring convenience script, not part of `npm run build` -- the site build
// (scripts/prepare-content.mjs) only ever READS fixtures/archives/, never writes it.
//
// RECONCILED against contracts/archive-layout.md (E11): a valid archive under that contract has
// exactly ONE top-level directory wrapping every entry, with a name a reader must determine by
// inspection rather than assume. This script wraps each version's fixture source tree in such a
// directory before taring -- named `<name>-<version>` here (an arbitrary, "boring" choice, no
// different in spirit from `git archive`'s own default naming) purely so the fixtures exercise
// the same shape a real archive has; src/lib/archive.mjs's reader never hard-codes this name back.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import * as tar from "tar";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcRoot = path.join(root, "fixtures/archives-src");
const outRoot = path.join(root, "fixtures/archives");
const registryModsDir = path.join(root, "fixtures/registry/mods");

// Every immediate child of a namespace dir under archives-src that is itself a directory named
// like a semver version is one tarball: fixtures/archives-src/<ns>/<name>/<version>/ -> tar.gz.
const built = []; // {ns, name, version, sha256}

for (const ns of fs.readdirSync(srcRoot)) {
  const nsDir = path.join(srcRoot, ns);
  if (!fs.statSync(nsDir).isDirectory()) continue;
  for (const name of fs.readdirSync(nsDir)) {
    const nameDir = path.join(nsDir, name);
    if (!fs.statSync(nameDir).isDirectory()) continue;
    for (const version of fs.readdirSync(nameDir)) {
      const versionDir = path.join(nameDir, version);
      if (!fs.statSync(versionDir).isDirectory()) continue;

      const outDir = path.join(outRoot, ns, name);
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, `${version}.tar.gz`);

      // Wrap the fixture's contents in a single named root directory (E11's required shape)
      // before taring, by copying into a scratch dir rather than fighting tar.create's API for
      // an entry-renaming/prefix feature it doesn't have -- boring, obviously correct (ADR-0103).
      const rootName = `${name}-${version}`;
      const stageParent = fs.mkdtempSync(path.join(os.tmpdir(), "wom-fixture-archive-"));
      const stageRoot = path.join(stageParent, rootName);
      fs.cpSync(versionDir, stageRoot, { recursive: true });
      try {
        tar.create({ gzip: true, file: outFile, cwd: stageParent, portable: true, sync: true }, [rootName]);
      } finally {
        fs.rmSync(stageParent, { recursive: true, force: true });
      }

      const bytes = fs.readFileSync(outFile);
      const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      built.push({ ns, name, version, sha256, outFile, size: bytes.length });
      console.log(`built ${outFile} (${bytes.length} bytes) sha256=${sha256}`);
    }
  }
}

// Write real hashes back into entry.json for every version that HAS a fixture tarball (i.e. a
// source tree exists under fixtures/archives-src for it). Always overwrites, even if a real hash
// is already there, so re-running this script after editing a fixture source tree can never leave
// a stale sha256 behind -- these are fixture-authoring files, not real (append-only) registry
// entries, so unconditional overwrite here is correct, not a violation of contracts/append-only.rules.md
// (that document governs real registry PRs, not this repository's own test fixtures).
let patched = 0;
for (const modDir of fs.readdirSync(registryModsDir)) {
  const entryPath = path.join(registryModsDir, modDir, "entry.json");
  if (!fs.existsSync(entryPath)) continue;
  const entry = JSON.parse(fs.readFileSync(entryPath, "utf8"));
  const [ns, name] = entry.id.split(":");
  let changed = false;
  for (const v of entry.versions) {
    const match = built.find((b) => b.ns === ns && b.name === name && b.version === v.version);
    if (!match) continue; // no fixture tarball for this version (e.g. removed/pulled) -- leave as-is
    if (v.source_sha256 !== match.sha256) {
      v.source_sha256 = match.sha256;
      changed = true;
      patched++;
    }
  }
  if (changed) {
    fs.writeFileSync(entryPath, JSON.stringify(entry, null, 2) + "\n");
    console.log(`patched ${entryPath} with real sha256(s)`);
  }
}

console.log(`\n${built.length} tarball(s) built, ${patched} sha256 placeholder(s) patched.`);
