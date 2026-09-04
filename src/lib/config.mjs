// Data-input configuration for the site build.
//
// Per the task spec's "one rule that governs" data inputs: the build reads exactly two sources
// (registry data, archived source tarballs) and takes both locations as CONFIGURATION, so
// pointing the build at a real registry checkout is a config change, never a code change.
//
// Defaults point at this repository's own fixtures (fixtures/registry, fixtures/archives) so that
// `npm run build` works out of the box with zero environment setup and zero network access, per
// acceptance criterion 1. To build against a real registry checkout, set the two environment
// variables below -- nothing in src/ or scripts/ needs to change.

import path from "node:path";

// Deliberately process.cwd(), not a path derived from import.meta.url: Astro/Vite's build step
// bundles this module and re-emits it under dist/ before running getStaticPaths, which changes
// what import.meta.url would resolve to (and DOES break a `path.dirname(fileURLToPath(...))`-based
// root -- caught during this task's own build, see docs/build.md). Every entry point that touches
// this module (`npm run build`, `npm run dev`, `npm run prepare-content`, `npm run validate-fixtures`)
// is invoked from the repository root via package.json's `scripts`, so cwd is a safe, boring anchor.
export const REPO_ROOT = process.cwd();

/**
 * Root of the registry checkout. Must contain `mods/<namespace>.<name>/entry.json` and
 * `page.json` for each mod, exactly as `worldofmodcraft/registry`'s own layout (README there).
 *
 * Default: this repository's fixtures, so a fixture-only build needs no configuration.
 * Real use: set REGISTRY_DIR to a checkout of worldofmodcraft/registry (e.g. the CI workflow
 * checks it out to a sibling path and points this at it).
 */
export const REGISTRY_DIR = path.resolve(
  process.env.REGISTRY_DIR ?? path.join(REPO_ROOT, "fixtures/registry"),
);

/**
 * Root of the LOCAL archived-source tarball store, staged as plain files on disk before this
 * build runs. Every registry version object carries `source_archive`, a full URL on platform
 * storage (depgraph N6, e.g. "https://archive.worldofmodcraft.com/<ns>/<name>/<version>.tar.gz").
 *
 * ASSUMPTION (recorded here because contracts/archive-layout.md, E11, does not exist yet --
 * see docs/build.md "Assumptions bound to task 025" for the full list): this build never fetches
 * that URL over the network (forbidden -- "no network access at build time" is acceptance
 * criterion 1, and even where network is available, ADR-0059 SS1 makes the archive, not a live
 * fetch, the source of truth). Instead it treats `source_archive`'s URL PATH (the part after the
 * host) as a path relative to ARCHIVE_DIR. A real deployment must stage tarballs at those paths
 * before running `npm run build` -- e.g. a small download step in the deploy workflow, added once
 * task 025's E11/E13 contracts land and say where that step belongs. Until then this is the
 * boundary: this repository stages nothing itself, it only reads what's already staged.
 *
 * Default: this repository's fixture tarballs (fixtures/archives), built by
 * `npm run make-fixture-archives` from fixtures/archives-src.
 */
export const ARCHIVE_DIR = path.resolve(
  process.env.ARCHIVE_DIR ?? path.join(REPO_ROOT, "fixtures/archives"),
);

/** Scratch directory for extracted tarball contents. Gitignored; safe to delete any time. */
export const CACHE_DIR = path.resolve(process.env.SITE_CACHE_DIR ?? path.join(REPO_ROOT, ".cache/archives"));

/** Where prepare-content.mjs writes files that Astro's own build must serve as static assets. */
export const GENERATED_PUBLIC_DIR = path.join(REPO_ROOT, "public/_generated");

/** Where prepare-content.mjs writes the consolidated per-mod data Astro pages read at build time. */
export const CONTENT_DATA_FILE = path.join(REPO_ROOT, ".cache/site-content.json");
