#!/usr/bin/env node
// Fix round 1, finding F2 (BLOCKING -- E14 violated by Pagefind's indexed URLs).
//
// contracts/url-scheme.md (E14) fixes the canonical mod-page URL as `/mods/<ns>/<name>`, with NO
// trailing slash, and explicitly names "Pagefind's own indexed URL for the identical mod" as one
// of the things that must be byte-identical to every other reference to that page (its "Attempt 2"
// attack-attempt section). This site's own generated links already omit the trailing slash
// (src/pages/browse.astro, src/pages/index.astro, src/components/*.astro all emit
// `/mods/<ns>/<name>`, `/browse`, `/about`, never a trailing slash except the bare root "/").
//
// Pagefind, however, derives each page's indexed `url` from the built file's own path
// (astro.config.mjs's `build.format: "directory"` emits `dist/mods/<ns>/<name>/index.html`), and
// its CLI has no flag to suppress the resulting directory-with-trailing-slash form -- `-k` /
// `--keep-index-url` only controls whether `index.html` stays at the END of the path; the shortest
// alternative, stripping it, still leaves the trailing "/". There is no per-page URL override
// documented for the CLI-driven build (confirmed by reading node_modules/pagefind/README.md and
// `npx pagefind --help` in full -- see docs/build.md's "Search" section). A per-page override
// would also require switching from the CLI (`pagefind --site dist`) to the Node indexing API
// (`pagefind.createIndex()` + `index.addHTMLFile()` with an explicit `url`), which is a bigger,
// less-boring change than fixing the four bytes Pagefind gets wrong after the fact (ADR-0103).
//
// This script is therefore the "boring" option the fix-round instructions name: a post-index
// normalisation step, run after `pagefind --site dist` and before `verify-dist.mjs`. It rewrites
// every fragment file's own `url` field (the ONLY place a per-page URL is stored -- the `.pf_index`
// and `.pf_meta` files reference fragments by content hash, not URL; verified by decompressing and
// inspecting one of each during this fix, see the task log) to strip exactly one trailing "/",
// except for the bare root "/" itself, which stays "/" (E14 does not apply to it, and "" is not a
// valid URL). This makes Pagefind's indexed URL match this site's own link convention exactly, for
// every route, not only mod pages -- a single uniform rule is the boring choice over special-casing
// only `/mods/**` while leaving `/about/` and `/browse/` inconsistent with the site's own nav.
//
// Fragment file format details, and why this script trusts it: see src/lib/pagefind-fragment.mjs
// (shared with scripts/verify-dist.mjs, which reads fragments back to assert this doesn't
// regress -- one implementation of the on-disk format, not two subtly different ones).
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../src/lib/config.mjs";
import { decodeFragment, encodeFragment } from "../src/lib/pagefind-fragment.mjs";

const fragmentDir = path.join(REPO_ROOT, "dist", "pagefind", "fragment");

if (!fs.existsSync(fragmentDir)) {
  console.log(`No ${fragmentDir} -- nothing to normalise (pagefind produced no fragments).`);
  process.exit(0);
}

/** Strips exactly one trailing "/" from a site-relative URL, except the bare root, which stays "/". */
function canonicalize(url) {
  if (url === "/" || !url.endsWith("/")) return url;
  return url.slice(0, -1);
}

let checked = 0;
let rewritten = 0;

for (const filename of fs.readdirSync(fragmentDir)) {
  if (!filename.endsWith(".pf_fragment")) continue;
  checked++;
  const filePath = path.join(fragmentDir, filename);
  const fragment = decodeFragment(fs.readFileSync(filePath));

  const canonical = canonicalize(fragment.url);
  if (canonical === fragment.url) continue;

  console.log(`${filename}: "${fragment.url}" -> "${canonical}" (E14: no trailing slash)`);
  fragment.url = canonical;
  fs.writeFileSync(filePath, encodeFragment(fragment));
  rewritten++;
}

console.log(`\nChecked ${checked} Pagefind fragment(s); rewrote ${rewritten} to drop a trailing slash.`);
