# How this site is built

This document is acceptance criterion 11 of task 009: where data comes from, how to point the
build at a real registry, how deployment is triggered, and what is fixture data to be removed
once real mods exist. Read `README.md` first for the one-paragraph version.

## The two data inputs, and the one rule

`npm run build` reads exactly two sources, both configurable, both local (never fetched over the
network at build time):

1. **Registry data** -- `REGISTRY_DIR/mods/<namespace>.<name>/{entry.json,page.json}`, validated
   against the vendored schemas in `schemas/` (see `schemas/README.md`).
2. **Archived source tarballs** -- `ARCHIVE_DIR/<path from source_archive's URL>`, containing (per
   this build's own reading of the archive interior -- see "Assumptions bound to task 025" below)
   `README.md`, `manifest.json` and whatever screenshot files `page.json` points at.

**The build never fetches an author's live repository, and never fetches `source_archive` over
the network either.** Both `REGISTRY_DIR` and `ARCHIVE_DIR` are read from local disk; getting real
data onto that disk (checking out the registry, staging tarballs) is a separate concern from this
repository, by design -- see `.github/workflows/deploy.yml`'s commented-out section.

Defaults (`src/lib/config.mjs`): `REGISTRY_DIR` = `fixtures/registry`, `ARCHIVE_DIR` =
`fixtures/archives`. Override with environment variables to build against something else:

```sh
REGISTRY_DIR=/path/to/registry/checkout ARCHIVE_DIR=/path/to/staged/tarballs npm run build
```

No code changes needed for that -- this is the whole point of `src/lib/config.mjs`.

## Running the build

```sh
npm install
npm run build
```

`npm run build` is three steps chained (`package.json`):

1. `npm run prepare-content` (`scripts/prepare-content.mjs`) -- reads the registry, extracts each
   mod's current-version archive, renders its README, copies its screenshots into
   `public/_generated/`, and writes one consolidated JSON record per mod to
   `.cache/site-content.json`. Every step logs what file it read from where, so the log itself is
   the evidence for "sourced from the archive, not a live repo" (acceptance criterion 3).
2. `astro build` -- Astro's own static build. Pages read `.cache/site-content.json` directly (see
   `src/pages/index.astro`, `src/pages/browse.astro`, `src/pages/mods/[ns]/[name].astro`); none of
   them touch the registry, an archive, or the filesystem paths above themselves.
3. `npm run index-search` (`pagefind --site dist`) -- indexes the built HTML for client-side
   search (acceptance criterion 6).

`.cache/`, `public/_generated/` and `dist/` are all derived and gitignored -- never hand-edit them,
never commit them (Forbidden list, task 009 spec).

Two more scripts exist for working with fixtures specifically, not part of `npm run build`:

- `npm run validate-fixtures` (`scripts/validate-fixtures.mjs`) -- validates every fixture
  `entry.json`/`page.json`/`manifest.json` against the vendored schemas and prints one `OK` line
  per file. This is the standalone demonstration that fixtures validate, run and its real output
  recorded in the task log rather than merely asserted.
- `npm run make-fixture-archives` (`scripts/make-fixture-archives.mjs`) -- rebuilds
  `fixtures/archives/**/*.tar.gz` from `fixtures/archives-src/`, and writes each tarball's real
  SHA-256 back into the matching `entry.json`. Run this after editing anything under
  `fixtures/archives-src/`.
- `npm run make-fixture-screenshots` (`scripts/make-fixture-screenshots.mjs`) -- (re)generates the
  original placeholder screenshot PNGs under `fixtures/archives-src/`. See `docs/design.md` for
  what each one is and how it was produced.
- `npm run test:archive-safety` (`scripts/self-test-archive-safety.mjs`) -- crafts several hostile
  tarballs (a path-traversal entry, a symlink escaping the archive root, an archive with no
  wrapping root directory) and proves `src/lib/archive.mjs` rejects every one of them without
  writing outside its extraction directory, plus one well-formed archive to prove there's no false
  positive. Wired into `.github/workflows/deploy.yml` as a step before every build. Not part of
  `npm run build` itself (it shells out to the system `tar` binary to build test fixtures on the
  fly, which a normal build has no reason to do).
- `npm run normalize-pagefind-urls` (`scripts/normalize-pagefind-urls.mjs`) -- fix round 1, finding
  F2: strips the trailing slash Pagefind's CLI indexer puts on every fragment's `url` field, so
  Pagefind's indexed URLs match `contracts/url-scheme.md` (E14). Chained between `index-search` and
  `verify-dist` in `npm run build`. See the "Search" section above.
- `npm run verify-dist` (`scripts/verify-dist.mjs`) -- checks the just-built `dist/` tree against
  `contracts/site-output.md` (E13): `.nojekyll`, `CNAME`'s exact content, `index.html`, one route
  per mod, Pagefind's output, no leaked local filesystem paths (broadened in fix round 1, F8, to
  also catch `/root/`, `/Users/` and `/github/workspace`), no trailing-slash page route in either
  generated HTML `href`s or Pagefind's fragment URLs (fix round 1, F2/F8, so that fix can't
  regress silently), and -- fix round 1, F1/F9 escalation -- that every file copied into
  `dist/_generated/**/screenshots/` is a real image by magic bytes (PNG/JPEG/WEBP), never an
  arbitrary file smuggled in via a path-escape bug, checked independently of whatever path
  produced it. Chained onto the end of `npm run build` itself, so an incomplete or compromised
  deploy fails the build rather than being discovered by someone looking at a live, broken (or
  leaking) site.
- `npm test` (added in fix round 1, finding F7) -- aliases the de-facto test suite this repository
  already had no single entry point for: `validate-fixtures`, then `test:archive-safety`, then a
  full `build` (which itself chains `verify-dist`, including the new checks above).

## Fixture data -- what it is, and what to do when real mods exist

No real mod exists yet (task 009 spec). `fixtures/registry/mods/` holds two invented mods so the
generator has something real to render against:

- `fixture:campfire-tales` -- three versions (`1.0.0`, `1.1.0`, `1.2.0`), with `1.1.0` **removed**
  (a fictional Blizzard-asset report) so the site's handling of a removed version's reason, and of
  a version whose archive was legitimately pulled, is exercised (acceptance criterion 3).
- `fixture:lantern-quests` -- a single published version, the other fixture shape the spec asks
  for. Its description contains the word "phosphorescent", chosen because it appears nowhere else
  in the fixtures, to make client-side search demonstrable (acceptance criterion 6).

**Every file under `fixtures/` is invented and must be deleted once real mods are published** --
none of it should ever be treated as real registry content. When `worldofmodcraft/registry` has at
least one real mod, delete `fixtures/registry/`, `fixtures/archives/` and `fixtures/archives-src/`
in the same PR that points `REGISTRY_DIR`/`ARCHIVE_DIR` at the real thing in
`.github/workflows/deploy.yml`.

`schemas/*.schema.json` are different: they are vendored **copies** of the registry's own
contracts (see `schemas/README.md`), not fixtures, and should stay -- just kept in sync if the
registry schemas change.

## Assumptions bound to task 025 -- and their reconciliation

Task 009's spec is explicit that four contracts this build depends on -- E11 (archive interior),
E12 (rebuild trigger), E13 (build output), E14 (URL scheme) -- did not exist at the start of this
task, and that `docs/architecture/depgraph.md`'s one-line definitions were the contract until task
025 wrote them. **Two of the four landed during this task's run** (`contracts/archive-layout.md`
for E11 and `contracts/site-output.md` for E13, on `worldofmodcraft/registry`'s
`task/025-boundary-contracts` branch) and this repository has been reconciled against both. The
table below is that reconciliation record: what was assumed beforehand, and whether the real
contract confirmed it, overrode it, or left it undecided (in which case the original reasoning
still stands as this repository's own choice).

| Edge | Original assumption (this repo, before task 025's contract) | What the real contract says | Outcome |
|---|---|---|---|
| E11: archive root | Not stated -- the first implementation extracted a tarball's entries directly into a destination directory, as if there were no wrapping directory at all. | `contracts/archive-layout.md`: an archive has **exactly one top-level directory**, whose name must be **determined by inspection, never guessed or constructed** from `entry.json`/manifest fields. | **Overridden.** `src/lib/archive.mjs` now lists every entry first (`tar.list`, no extraction), determines `<root>` from the entries themselves, rejects any archive with zero or more-than-one distinct root, and extracts with `strip: 1` so the rest of the code can keep addressing files as `${extractedDir}/README.md`. Fixture tarballs were rebuilt (`scripts/make-fixture-archives.mjs`) to actually have this wrapping (`<name>-<version>/...`), where they previously did not. |
| E11: path-escape rule | Not considered at all -- the first implementation relied entirely on whatever `node-tar` does by default. | Every entry (not only manifest/page-declared ones) must be rejected if it contains a `..` segment, is absolute, or is a symlink targeting outside the root; **the whole archive** is rejected, not just the offending entry. | **Overridden (a real gap, now closed).** `src/lib/archive.mjs`'s `validateAndDetermineRoot()` checks every entry -- including symlink targets, checked conservatively (any `..` or absolute target rejected outright, no partial path resolution) -- before a single byte is extracted, and throws `MalformedArchiveError` for the whole archive on any violation. Proven, not just asserted, by `scripts/self-test-archive-safety.mjs` (see below) -- including the exact "manifest never mentions this path" attack the contract itself records. |
| E11: missing README / missing screenshot / malformed archive | Assumed these were build-fatal (`throw`). | All three must **degrade** that mod's page (render without the missing piece, log the fact) rather than fail the build. | **Overridden.** `scripts/prepare-content.mjs` now catches `MalformedArchiveError` per mod and degrades (no README/screenshots/manifest-derived fields for that mod, warning logged with the `source_archive` identity) instead of throwing; a missing README alone is not even a warning-worthy condition (matches the contract's "not an error for either side"); a missing declared screenshot is skipped with a warning and simply omitted from the gallery. |
| E11: `manifest.json` at the archive root | Assumed, since neither `entry.schema.json` nor `page.schema.json` carries a licence field and no kernel exists yet to parse `mod.lua`. | **Not mentioned at all** -- the contract only covers `README.md` and screenshot paths. | **Undecided by the contract; this repository's assumption stands, unconfirmed.** Given the contract's neighbouring principle (a missing declared file degrades rather than fails), the same degrade treatment was extended to a missing `manifest.json` for consistency, but this is this repository's own extension, not something E11 requires -- flagged again below under "still open." |
| E11: which version's archive backs "current" gallery/README, and whose `screenshots[]` (manifest's or `page.json`'s) is shown | Highest-published-semver version; `page.json`'s `screenshots[]`, not the manifest's own, because ADR-0059 SS2 makes screenshots page content specifically so they're editable without a new version. | Not addressed -- the contract is silent on which version's archive a "current" page reads from, and doesn't adjudicate manifest vs. page-content screenshot lists. | **Undecided by the contract; this repository's assumption stands**, reasoning unchanged from before task 025. |
| E13: `.nojekyll` | Not considered at all -- the first implementation shipped no such file. | **Required**, empty, at `dist/`'s root, or GitHub Pages silently drops every `dist/_astro/` asset (Jekyll's underscore-prefix exclusion). | **Overridden (a real gap, now closed).** `public/.nojekyll` (empty) is copied verbatim into `dist/.nojekyll` by Astro's static public-dir copy; `scripts/verify-dist.mjs` checks it is present and empty on every `npm run build`. |
| E13: `CNAME` content | Assumed the bare apex domain sufficed; no exact-format rule written down. | Exactly `worldofmodcraft.com`, lowercase, no scheme, no `www.`, no trailing slash, at most one trailing newline. | **Confirmed** -- `public/CNAME`'s content already matched exactly; `scripts/verify-dist.mjs` now checks this mechanically instead of by eye. |
| E13: what else must exist | Assumed `dist/` + `CNAME` was sufficient (the graph's own one-line description). | `index.html` at the root, one route per mod matching E14's scheme, Pagefind's output tree, and no leaked local filesystem paths -- graded as all-or-nothing, not partial credit. | **Confirmed as the right instinct, formalised.** These were already true of this build's output by construction; `scripts/verify-dist.mjs` now checks all of them mechanically, wired onto the end of `npm run build` itself (E13's own "Questions" section left open whether such a check should be automated -- this repository chose to automate it). |
| E12 | "rebuild trigger: `repository_dispatch` event type + payload" (depgraph.md's one-liner; no dedicated contract has landed for this edge yet). | Not yet available. | **Still an open assumption.** `.github/workflows/deploy.yml` uses event type `registry-updated`, no payload fields read. Re-check against `contracts/rebuild-trigger.md` once it exists. |
| E14 | "URL scheme: `/mods/<ns>/<name>`" (depgraph.md's one-liner; no dedicated contract had landed for this edge at the time this row was first written, though `contracts/site-output.md` references it without restating it). | `contracts/url-scheme.md` landed on `worldofmodcraft/registry`'s `task/025-boundary-contracts` branch during fix round 1: `https://worldofmodcraft.com/mods/<ns>/<name>`, **no trailing slash**, and explicitly names "Pagefind's own indexed URL for the identical mod" as something that must match byte-for-byte. | **Overridden (a real gap, found by review and closed in fix round 1).** `astro.config.mjs`'s `trailingSlash: "ignore"` still lets both forms resolve for the site's own routing, which is fine for that purpose, but Pagefind's CLI-driven indexer has no way to suppress the trailing slash it derives from the built file's directory path -- every fragment's indexed `url` came out as e.g. `/mods/fixture/lantern-quests/`, violating E14. Fixed with a post-index normalisation step, `scripts/normalize-pagefind-urls.mjs` (wired between `index-search` and `verify-dist` in `npm run build`), which strips the trailing slash from every fragment's `url` field (see its own header comment for why a per-page override wasn't available and why this is the boring option, and `src/lib/pagefind-fragment.mjs` for the shared fragment-file codec it and `verify-dist.mjs` both use). `scripts/verify-dist.mjs` now asserts this mechanically in two places -- no generated HTML `href` carries a trailing slash on a page route, and no Pagefind fragment's `url` does either -- so a regression in either one turns the build red instead of silently reappearing. |
| E9: signature/hash verification before extraction | Not implemented, not considered -- see below. | `contracts/archive-layout.md` SS"Relationship to other contracts": "A consumer must complete E9's verification before extracting anything this document describes" -- i.e. a reader must verify `source_sha256` and `signature`/`key_id` against `contracts/signature-format.md` BEFORE `extractArchive()` ever opens the tarball. | **TODO -- not exploitable today, but a real gap, found in fix round 1 (F4) and recorded here rather than silently deferred.** Nothing in this branch performs E9's check. It is not exploitable *yet* because the workflow's tarball staging is commented "NOT YET WIRED UP" (`.github/workflows/deploy.yml`) -- there is no real, network-supplied tarball for a forged signature to ride in on; every tarball this build reads today is either this repository's own fixture (built and staged locally by `scripts/make-fixture-archives.mjs`) or whatever a future staging step places under `ARCHIVE_DIR`. **Whoever wires up real staging must add E9 verification before `extractArchive()` is called with a real, externally-supplied tarball path** -- this row is that explicit TODO, so it is not rediscovered from scratch. `contracts/signature-format.md` (E9) itself was not read for this task (out of the declared Context); read it fully before implementing the check. |

**Still open, flagged for whoever reviews this against the final E11 text:** whether a missing
`manifest.json` should really degrade the whole mod's licence/type/display-name (this repository's
choice) or should instead be treated as build-fatal given how central a licence is to the mission's
own acceptance criteria. No contract adjudicates this; it is a judgement call recorded here rather
than silently made.

If `contracts/rebuild-trigger.md` (E12) appears in the registry repository, re-read it against
this table and reconcile any difference in the same PR, the same way E11, E13 and (in fix round 1)
E14 were reconciled here.

## Mod-supplied path safety -- every `path.join` whose second argument is mod-supplied data

Fix round 1 (2026-09-05) found a BLOCKING finding (F1): `page.schema.json`'s `screenshots[]`
pattern (`^(?!/)(?!.*://)(?!.*\\).+$`) forbids a leading `/`, a URL scheme, and a backslash, but
**not** a `..` segment, so a schema-valid `page.json` could name
`"../../../../../../etc/passwd"` and have it copied byte-for-byte into `public/_generated/` (and
from there into `dist/`, served to the whole internet) under a harmless-looking `path.basename()`
name. Fixed with a single shared, exported check, `isSafeModSuppliedRelativePath()`
(`src/lib/archive.mjs`), reusing the same `..`-segment check the tar-entry validator already used,
called before the join at `scripts/prepare-content.mjs`'s screenshot-copy loop (see that file for
the exact line and the demonstration in the task log).

The fix round's instructions required grepping **every** `path.join` in this repository whose
second argument originates in mod-supplied data (not fixed strings, not this repository's own
configuration) and recording a verdict for each -- not only the one that was broken:

| Call site | Second argument | Verdict |
|---|---|---|
| `scripts/prepare-content.mjs` (screenshot copy loop) | `relPath` from `page.json`'s `screenshots[]` | **Was unsafe -- fixed in fix round 1 (F1).** Now guarded by `isSafeModSuppliedRelativePath()` before the join; a rejected path degrades that gallery slot (logs "rejected as unsafe", omits the slot, build continues) exactly as a missing screenshot already degraded. |
| `manifest.schema.json`'s own `screenshots[]` field | N/A -- **never read by any code in this repository.** | **Dormant, same bug, currently unreachable.** The manifest schema carries the identical permissive pattern (no `..` exclusion) as `page.schema.json`'s, but `scripts/prepare-content.mjs` only reads `manifest.license`, `manifest.type`, `manifest.name` and `manifest.ai_assisted` from a parsed manifest -- `manifest.screenshots` is validated (schema-checked) but never joined onto a path anywhere. **If a future task wires this field up** (e.g. to seed `page.json`'s own `screenshots[]` at first publish, which is what the manifest schema's own description says it's for), it MUST call `isSafeModSuppliedRelativePath()` before any `path.join`, exactly like the fixed call site above -- do not re-derive this check. |
| `scripts/prepare-content.mjs` (README read) | The literal string `"README.md"` | **Safe -- not mod-supplied.** Hard-coded, never comes from `page.json`/`manifest.json`/`entry.json`. |
| `scripts/prepare-content.mjs` (manifest read) | The literal string `"manifest.json"` | **Safe -- not mod-supplied.** Same reasoning. |
| `src/lib/archive.mjs`'s `localArchivePathFor()` | `url.pathname` from `entry.json`'s `source_archive` (a full `https://` URL, write-back-only field -- `^https://\S+$`) | **Safe, but not for the obvious reason -- verified, not assumed.** `new URL(...)`'s WHATWG-spec path parser resolves (and clamps) `.`/`..` segments, including percent-encoded ones (`%2e%2e`), during parsing itself -- confirmed directly in this environment: `new URL("https://x/../../../etc/passwd").pathname` returns `"/etc/passwd"`, never a string containing a literal `..` segment for `path.join` to act on, and clamps rather than erroring past the URL's own root. A `path.join(ARCHIVE_DIR, relativePath)` built from that `pathname` can therefore never escape `ARCHIVE_DIR` via `..`. (It is also write-back-only per ADR-0041/E8 -- pipeline-authored, not directly author-supplied -- but this verdict does not rely on that; it holds purely from the URL parser's own normalisation.) |
| `src/lib/registry.mjs`'s `loadMods()` (`dir`, `entryPath`, `pagePath`) | `d.name`, from `fs.readdirSync(modsDir, {withFileTypes:true})` | **Safe -- not mod-supplied in the relevant sense.** `d.name` is a real, existing child of `modsDir` returned by the OS's own directory-listing call; a directory literally named `..` cannot exist as a listed child of another directory (the OS filesystem API doesn't allow it), so this can never carry a traversal segment regardless of what any JSON file says. |
| `src/lib/archive.mjs`'s `extractArchive()` (`destDir = path.join(CACHE_DIR, ns, name, version)`) and `scripts/prepare-content.mjs`'s screenshot destination (`path.join(GENERATED_PUBLIC_DIR, "mods", mod.ns, mod.name, ...)`) | `ns`/`name` from `entry.json`'s `id` (pattern `^[a-z0-9][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$`); `version` (strict semver pattern) | **Safe by schema.** Neither pattern admits `/`, so no segment of either value can ever be `..` or contain a path separator at all. |

## Content trust assumption (ADR-0120) -- stated explicitly, not implemented here

**Added in fix round 1 (F5); ADR-0120 (content whitelisting, not container framing) was a
retroactive Context-selection miss by the manager, not this task's original scope -- see
`docs/tasks/009-site-build.md`'s Context section for the same note.** ADR-0120 requires that an
*accepted* image asset on this platform contain only whitelisted structural elements (e.g. a PNG
may carry only `IHDR`/`PLTE`/`IDAT`/`IEND` plus a short safe list -- no arbitrary private chunks
that could smuggle other content past a magic-bytes-only check).

**This repository does not implement that check, and is not the right place to.** `scripts/
prepare-content.mjs` copies a mod's screenshot files out of its archive into `public/_generated/`
(and from there into publicly-served `dist/`) verbatim, on the explicit, now-stated assumption
that **registry ingestion already ran ADR-0120's whitelist check before the archive was accepted
into the registry at all** -- this build only reads an already-accepted archive, it never accepts
one. If that assumption is wrong (ingestion does not yet enforce ADR-0120, or enforces it more
loosely than the ADR requires), this build would faithfully republish whatever slipped through,
and closing that gap is ingestion's fix, not a re-validation duplicated here. `scripts/
verify-dist.mjs`'s magic-bytes check (added in fix round 1 for a different reason -- see F1's
regression check below) only confirms a copied file *is a well-formed image container of some
kind* (PNG/JPEG/WEBP signature) -- it is a defence against an arbitrary non-image file being
smuggled through a path-traversal bug, not an ADR-0120 interior-content whitelist, and must not be
read as one.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages via the official
`actions/upload-pages-artifact` + `actions/deploy-pages` flow. Two triggers:

- `push` to `main` (this repository changed).
- `repository_dispatch` with type `registry-updated` (a registry merge -- see the E12 row above).
- (`workflow_dispatch` too, for a manual rebuild while wiring this up.)

**This task does not enable GitHub Pages or touch DNS** -- both are Ludwig's manual steps (task
spec, "Do not" list), and the workflow will not successfully deploy until Pages is enabled with
source "GitHub Actions" in this repository's Settings. Once task 009's build is on `main`:

1. Repository Settings -> Pages -> Source: "GitHub Actions".
2. Point `worldofmodcraft.com`'s DNS at GitHub Pages (apex `A`/`ALIAS` records per GitHub's own
   documentation) -- `public/CNAME` already declares the apex domain so Pages will request a
   certificate for it once DNS resolves.

## Performance (acceptance criterion 10)

The task spec says: run Lighthouse if a headless browser is genuinely available, and never report
a score that wasn't actually measured. This environment has no browser installed and no root
access to install one via the system package manager. To get a **real** measurement rather than an
unverifiable one, this task:

1. Downloaded Chrome for Testing via `@puppeteer/browsers` (no root needed).
2. Found it wouldn't launch (`error while loading shared libraries: libnspr4.so ...` and four
   others) -- confirmed with `ldd`, no partial guessing.
3. Downloaded the five missing `.deb` packages with `apt-get download` (works without root; it
   only fetches, it doesn't install) and extracted them with `dpkg-deb -x` into a local prefix,
   then pointed `LD_LIBRARY_PATH` at it. Chrome launched successfully after that.
4. Served `dist/` locally and ran `npx lighthouse` against the mod page for real, and separately
   drove the same Chrome with `puppeteer-core` to click through the actual search and filter UI
   for acceptance criteria 5 and 6 (see their sections in the task log for the exact commands and
   output).

**Result:** Lighthouse performance score **99/100** on `/mods/fixture/campfire-tales/`
(`docs/perf/lighthouse-mod-page.json` is the full report), default mobile-emulation + simulated
network throttling config (not the desktop preset -- the harder default, still 99). First
Contentful Paint / Largest Contentful Paint / Speed Index all 1.4s, Total Blocking Time 0ms,
Cumulative Layout Shift 0.058. Lighthouse's own `network-requests` audit: **11 requests, ~181 KB
transferred**, all same-origin (self-hosted fonts, self-hosted images, no third-party script or
stylesheet of any kind).

**Caveat, stated plainly:** this measured a two-mod fixture site on a local static file server, not
the live site under real network conditions with the eventual real mod catalogue. The 99 score is
real evidence the generated output is lightweight (no render-blocking third-party resources, small
font/image payload), not a guarantee the number holds unchanged at a much larger catalogue size.
**TODO:** re-run Lighthouse against `worldofmodcraft.com` once it is actually live and DNS-served,
and once it carries more than two mods, to confirm the score holds under real conditions.

## Search

Client-side, via [Pagefind](https://pagefind.app/), indexed as a post-build step
(`npm run index-search` = `pagefind --site dist`). The Default UI (`pagefind-ui.js` +
`pagefind-ui.css`, both fetched from `/pagefind/` at runtime, generated by the indexer -- never
from a CDN) is mounted on `/browse` (`src/pages/browse.astro`). Its default light theme is
re-themed to match the site's dark palette by redefining Pagefind's own `--pagefind-ui-*` custom
properties, scoped to the `#search` mount element rather than `:root` -- see the comment in
`src/styles/global.css` for why `:root` doesn't work (Pagefind's own stylesheet is injected at
runtime, after this one, so a same-selector override loses the cascade; scoping to the mount
element sidesteps that because inherited custom properties resolve from the nearest ancestor, not
from source order).

**Fix round 1 (F2):** `pagefind --site dist` derives each page's indexed URL from the built file's
own directory path, which always carries a trailing slash (`/mods/fixture/lantern-quests/`) --
violating `contracts/url-scheme.md` (E14)'s no-trailing-slash rule, which explicitly names
Pagefind's indexed URLs as something that must comply. `npm run build` now runs `npm run
normalize-pagefind-urls` (`scripts/normalize-pagefind-urls.mjs`) immediately after `index-search`
and before `verify-dist`, rewriting every fragment's `url` field to drop that trailing slash. See
the "Assumptions bound to task 025" table's E14 row above for the full account, and
`scripts/normalize-pagefind-urls.mjs`'s own header comment for why this was the boring fix over
switching to Pagefind's Node indexing API.

## What "install" does today

Mission SS2 explicitly keeps the `modcraft://` protocol handler out of scope for this phase --
there is no launcher to register it. Each mod page's Install section (acceptance criterion 4)
therefore renders the URI as inert text with a visible "launcher coming soon" note, plus a working
direct download link to the current version's `source_archive`. The URI's own shape
(`modcraft://install/<namespace>/<name>@<version>`) is this task's own choice, recorded as an
assumption in `src/pages/mods/[ns]/[name].astro` -- no ADR or contract fixes it yet.
