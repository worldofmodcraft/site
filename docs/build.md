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
- `npm run verify-dist` (`scripts/verify-dist.mjs`) -- checks the just-built `dist/` tree against
  `contracts/site-output.md` (E13): `.nojekyll`, `CNAME`'s exact content, `index.html`, one route
  per mod, Pagefind's output, and no leaked local filesystem paths. Chained onto the end of
  `npm run build` itself, so an incomplete deploy fails the build rather than being discovered by
  someone looking at a live, broken site.

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
| E14 | "URL scheme: `/mods/<ns>/<name>`" (depgraph.md's one-liner; no dedicated contract has landed for this edge yet, though `contracts/site-output.md` references it without restating it). | Not yet available as its own document. | **Still an open assumption.** `src/pages/mods/[ns]/[name].astro`'s own file path is this contract in the repo layout, not just prose; `astro.config.mjs` sets `trailingSlash: "ignore"` so both `/mods/<ns>/<name>` and `/mods/<ns>/<name>/` resolve. Re-check once `contracts/url-scheme.md` exists. |

**Still open, flagged for whoever reviews this against the final E11 text:** whether a missing
`manifest.json` should really degrade the whole mod's licence/type/display-name (this repository's
choice) or should instead be treated as build-fatal given how central a licence is to the mission's
own acceptance criteria. No contract adjudicates this; it is a judgement call recorded here rather
than silently made.

If `contracts/rebuild-trigger.md` (E12) or `contracts/url-scheme.md` (E14) appear in the registry
repository, re-read them against this table and reconcile any difference in the same PR, the same
way E11 and E13 were reconciled here.

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

## What "install" does today

Mission SS2 explicitly keeps the `modcraft://` protocol handler out of scope for this phase --
there is no launcher to register it. Each mod page's Install section (acceptance criterion 4)
therefore renders the URI as inert text with a visible "launcher coming soon" note, plus a working
direct download link to the current version's `source_archive`. The URI's own shape
(`modcraft://install/<namespace>/<name>@<version>`) is this task's own choice, recorded as an
assumption in `src/pages/mods/[ns]/[name].astro` -- no ADR or contract fixes it yet.
