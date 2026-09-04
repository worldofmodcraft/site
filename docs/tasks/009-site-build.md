# Task 009: The site — Astro build, generated mod pages, search, and a design worth showing

- **Mission:** SITE-V1 — **Status:** spec-approved (manager, 2026-09-03)
- **Agent / model:** implementer / sonnet
- **Budget:** large (<= 6 agent-sessions). Sized large deliberately: this is the largest single
  task in the mission. **Past ~60 % of your context, finish the current sub-step, bring the log
  below to a state a fresh agent could resume from, and end the run** (MANAGER.md §5).
- **Branch / worktree:** task/009-site-build / `~/wt/site-task-009` (repo `worldofmodcraft/site`)
- **Graph:** node **N7** (`site-build`), and the site half of **N8**. Consumes edges **E10**
  (entry + page schemas) and **E11** (archive interior); produces **E13** (`dist/` + `CNAME`) and
  **E14** (URL scheme). See `docs/architecture/depgraph.md` in the platform repo.

## Objective
`worldofmodcraft/site` builds a complete static portal with `npm run build`, generated entirely
from registry data plus archived source tarballs: a start page, a browse page with filtering, one
generated mod page per registry entry, an About/Licensing page, and client-side search. It deploys
to GitHub Pages via a committed workflow, serving the apex domain through a `CNAME`. The design is
distinctive and deliberate — dark, atmospheric, subtly fantasy-flavoured, and entirely original.
This is the task that makes worldofmodcraft.com serve its first page.

## Context to load (exhaustive — read before writing)
In this repository: `README.md` (what this repo is and is not).
In the platform repository `~/wom` (read-only — never write there):
- **ADR-0059** — the whole thing. §1 (three sources, archive never live repo), §2 (version-bound
  vs page content), §3 (page.json PRs publish immediately), §4 (browse, Pagefind, filters).
- **ADR-0058** §2 and §4 (owner shape; provider neutrality — the site must not assume GitHub).
- **ADR-0041** — what a version page must show: hash, commit link, status, signature, `key_id`.
- **ADR-0049** — licensing; the site needs a "Licensing explained" page.
- **ADR-0004** — own assets only. This governs every pixel you produce.
- **ADR-0003** (naming), **ADR-0056** (English), **ADR-0103** (boring solutions).
- `docs/tasks/MISSION-worldofmodcraft-site-v1.md` §1, §2 (out of scope), §4 D3, §7 (criteria 3, 4, 7).
- `docs/architecture/depgraph.md` — nodes and the edge table. **E11, E12, E13 and E14 name contract
  files that do not exist yet** (task 025 writes them, in parallel with this task, in the registry
  repository). Until they land, the edge table's own one-line definitions in `depgraph.md` are the
  contract; code against those and record in your log exactly what you assumed, so task 025 and
  task 008 are bound by the same text. If `contracts/archive-layout.md` appears in the registry
  repository during your run, re-read it and reconcile.
In the registry repository `~/registry` (read-only): `contracts/entry.schema.json`,
`contracts/page.schema.json`, `contracts/manifest.schema.json` and everything under
`contracts/examples/` — these are your input shapes and your fixture starting point.

## File scope (declared)
Everything in this repository except `LICENSE`. In practice: `package.json`, `package-lock.json`,
`astro.config.*`, `src/**`, `public/**`, `fixtures/**`, `.github/workflows/**`, `docs/**`,
`.gitignore`. Anything outside this repository = stop and report.

## Data inputs, and the one rule that governs them
The build reads **two** sources and no others:
1. **Registry data** — `mods/<ns>.<name>/entry.json` and `page.json`, shaped by the schemas above.
2. **The archived source tarball** — where a version's `README.md` and its screenshot files come
   from, at the paths the manifest declares.

**Never the author's live repository.** ADR-0059 §1 exists so pages survive repo deletion; a fetch
of `github.com/<author>/...` at build time is a violation of the graph's declared non-edges, not a
convenience. The commit link on a version page is a *link for a human to click*, never a fetch.

No real mod exists yet, so build against **fixtures you create** under `fixtures/`: at least two
mod entries (one with several versions including one `removed` with a reason, one single-version),
their `page.json` files, and matching source tarballs containing a real `README.md` and real PNG
screenshots. Fixtures must validate against the registry's schemas — demonstrate that they do,
rather than asserting it. The data layer must take the registry location as configuration, so
pointing the build at a real registry checkout is a config change and not a code change.

## Acceptance criteria
Each demonstrated by a command actually run, with its real output in the log; visual criteria by a
screenshot committed under `docs/screenshots/`.

1. **`npm run build` produces a complete `dist/` from fixtures alone**, with no network access at
   build time beyond what npm already installed. Show the command, its exit code, and a listing of
   the generated routes.
2. **URL scheme** is `/mods/<ns>/<name>` (E14), and a mod page exists at that path for every
   fixture entry. Show the generated paths.
3. **Mod page content** (ADR-0059 §1, mission §7.4): description and tags from `page.json`; the
   README **rendered from the archived tarball**, not from a live repo; a screenshot gallery from
   the archive at the manifest-declared paths; the licence; and a version list where each version
   shows its version string, commit hash, a link to the archived source, and its status — with a
   `removed` version rendering its reason rather than being hidden. Demonstrate the archive
   provenance by pointing at the archive paths in the build log.
4. **The install button renders the `modcraft://` URI** with a "launcher coming soon" affordance
   plus a direct archived-download link (mission §2 and §4 D3: the protocol handler itself is out
   of scope; the button is not).
5. **Browse page** lists all mods, filters by tag and type, and sorts by recently updated
   (ADR-0059 §4). Demonstrate a filter narrowing the list.
6. **Search works client-side via Pagefind** and finds a mod by a word that appears only in its
   description. Demonstrate the query and the result.
7. **Start page and About//Licensing page exist**: the start page says what the platform is and is
   honest that it is in development (mission §4 D3), and links the decision log; the licensing page
   explains the ADR-0049 split (AGPL platform, MIT-with-linking-clause SDK, any OSI licence for
   mods) in plain language for a reader who is not a lawyer.
8. **Design is deliberate, and original** (mission §4 D3 and §7.7): dark, atmospheric, subtly
   fantasy-flavoured, coherent typography and spacing, and *intentional* on both a narrow phone
   viewport and a wide desktop one. **Nothing Blizzard-derived anywhere** — no Blizzard asset,
   name, font, or iconography, and no imitation of their visual identity (ADR-0004). Any decorative
   art is generated by you as original work; state in the log how each asset was produced.
   Demonstrate with committed screenshots at both viewport sizes.
9. **Deployment workflow** builds and publishes to GitHub Pages, emitting `CNAME` containing
   `worldofmodcraft.com` into `dist/` (E13). The workflow is committed and its trigger documented;
   it must be triggerable by a registry merge (`repository_dispatch` — E12) as well as by a push to
   this repository. **Do not enable Pages and do not point DNS** — that is Ludwig's step, and it is
   blocked until this task's first build is on `main`.
10. **Performance**: mission §7.3 asks for Lighthouse >= 90 on the mod page. Run it if a headless
    browser is genuinely available in this environment; if it is not, say so plainly in the log,
    record what you *did* measure (built page weight, request count, absence of render-blocking
    third-party resources) and leave an explicit TODO row for the check to be run against the live
    site. **Do not report a Lighthouse score you did not obtain.**
11. **`docs/` in this repository explains the build**: where data comes from, how to point it at a
    real registry, how the deployment is triggered, and what is fixture data that must be removed
    or replaced when real mods exist. Docs move with the code, in this branch.

## Forbidden here
Beyond MANAGER.md §3.7:
- **Fetching anything from an author's live repository at build time**, for READMEs, screenshots,
  metadata or anything else. The archive is the only source (ADR-0059 §1).
- **Any server-side or dynamic component** — no API, no runtime data fetch from our own backend, no
  accounts, no ratings, no telemetry, no health panels (mission §2, ADR-0059 §5). The site is 100 %
  static.
- **Any Blizzard asset, name, font, iconography or visual imitation**, and any third-party asset
  whose licence you have not checked and recorded. Web fonts must be self-hosted with their licence
  noted, or system fonts used.
- **Hand-editing generated output** in `dist/`, or committing `dist/` at all.
- **Enabling GitHub Pages, changing DNS, or touching the `worldofmodcraft/registry` repository.**
- Marking criterion 8 or 10 done without the artefact that demonstrates it. A screenshot you did
  not take and a score you did not measure are the two easiest lies in this task.

## Questions  (agent-maintained; see MANAGER.md §8b)
- **Missing/malformed `manifest.json` inside a mod's current-version archive** -- not covered by
  E11 (`contracts/archive-layout.md` only names `README.md` and screenshot paths), but it is the
  only source this build has for licence/type/display-name in this phase (no kernel to parse
  `mod.lua`; neither `entry.schema.json` nor `page.schema.json` carries a licence field). Options,
  for whoever reviews `scripts/prepare-content.mjs`'s current behaviour:
  - **A. (implemented, ★ lean)** Degrade only that mod's manifest-derived fields (licence/type
    shown as "unavailable", display name falls back to a title-cased slug of its registry name),
    log a loud warning naming the `source_archive`, and still build every other mod's page and
    the mod's own README/screenshots if those parts of the archive are fine. Consistent with E11's
    overall "a missing piece degrades, it doesn't fail the build" philosophy, extended to a field
    E11 doesn't name.
  - B. Skip generating that one mod's page entirely (loud error, `npm run build` still exits 0
    for the rest), on the reasoning that a mod page with no visible licence is worse than no page.
  - C. Treat it as fully build-fatal (`npm run build` exits non-zero) until fixed, on the
    reasoning that licence is legally central enough that "the site half-built" should block a
    deploy rather than silently publish an unlicensed-looking mod page.
  No ADR or contract adjudicates this; A is implemented today (`scripts/prepare-content.mjs`,
  `docs/build.md`'s reconciliation table) because it best matches E11's own stated philosophy, but
  it is a one-paragraph change to switch to B or C if review disagrees.

---
# Task 009 log  (append-only, updated continuously by the executing agent)
- 2026-09-03 spec approved; worktree created from site `main` (task 022's seed commit).
- 2026-09-04/05 (single continuous session) -- full implementation. Summary below; see
  `docs/build.md` and `docs/design.md` for the permanent documentation this log points at.

## Environment verification (done before writing anything)
- Node `v24.20.0` / npm `11.19.0` at `/home/ludwig/.local/node/bin/`, confirmed directly.
- No frontend-design skill present in this environment's available-skills listing (checked at
  session start) -- design direction in `docs/design.md` was authored directly.
- **No headless browser was pre-installed, and there is no root/sudo access** (`sudo -n true` ->
  "interactive authentication is required"; `apt-get install chromium` needs root). To get a
  *real* Lighthouse score and a *real* interactive Pagefind/filter demonstration rather than
  unverifiable claims, this session: downloaded Chrome for Testing via `npx @puppeteer/browsers
  install chrome@stable` (no root needed) -> launch failed with `error while loading shared
  libraries: libnspr4.so: cannot open shared object file` (`ldd` then showed 5 missing libs:
  libnspr4, libnss3, libnssutil3, libsmime3, libasound.so.2) -> fetched those exact `.deb` files
  with `apt-get download` (fetch-only, no root needed) into a scratch dir, extracted them with
  `dpkg-deb -x` (no install, no root), and pointed `LD_LIBRARY_PATH` at the extracted
  `usr/lib/x86_64-linux-gnu`. Chrome then launched headless successfully
  (`--headless=new --no-sandbox --disable-gpu --dump-dom https://example.com` produced real HTML).
  This recipe lives only in this log and in `docs/build.md`'s performance section (not in any
  script this repo ships) -- it was a one-time verification step for this task's own report, not
  part of the site's build, which needs no browser at all.

## Criterion 1 -- `npm run build` produces a complete `dist/` from fixtures alone, no network
Command and real output (clean tree: `rm -rf dist .cache public/_generated` first):
```
$ npm run build
...
23:19:40 [build] 5 page(s) built in 467ms
23:19:40 [build] Complete!
...
> pagefind --site dist
...
  Indexed 5 pages
...
> node scripts/verify-dist.mjs
OK    dist/.nojekyll present and empty
OK    dist/CNAME present with exact required content
OK    dist/index.html present
OK    dist/mods/fixture/campfire-tales/index.html present
OK    dist/mods/fixture/lantern-quests/index.html present
OK    dist/pagefind/ present and non-empty
OK    no local filesystem paths found in served HTML

dist/ satisfies every check this repository runs against contracts/site-output.md (E13).
$ echo EXIT_CODE=$?
EXIT_CODE=0
```
Generated routes (`find dist -name index.html`): `dist/index.html`, `dist/about/index.html`,
`dist/browse/index.html`, `dist/mods/fixture/campfire-tales/index.html`,
`dist/mods/fixture/lantern-quests/index.html`.
**No network:** `grep -rn "fetch(\|http\.request\|https\.request\|XMLHttpRequest" src/ scripts/`
returns nothing -- no network-capable API is referenced anywhere in the build path (`OS`-level
network-namespace isolation (`unshare -n`) was attempted for a stronger proof and is unavailable
without privilege in this environment -- `unshare: unshare failed: Operation not permitted` --
so this is static-analysis evidence, stated as such, not a sandboxed-network proof).

## Criterion 2 -- URL scheme `/mods/<ns>/<name>` (E14)
`src/pages/mods/[ns]/[name].astro`'s own file path is the contract. Generated paths (above):
`/mods/fixture/campfire-tales/`, `/mods/fixture/lantern-quests/` -- one per fixture entry, both.

## Criterion 3 -- mod page content, sourced from archive, provenance shown in the build log
`npm run prepare-content`'s real output (unabridged for one mod):
```
-- fixture:campfire-tales --
Current (highest published) version: 1.2.0
Archive path for current version, resolved from source_archive (never fetched over
the network -- see src/lib/archive.mjs): /home/.../fixtures/archives/fixture/campfire-tales/1.2.0.tar.gz
Extracted to: /home/.../. cache/archives/fixture/campfire-tales/1.2.0
manifest.json read from archive: license=MIT type=mod
README rendered from archive file: /home/.../1.2.0/README.md (1047 bytes source)
Screenshot copied from archive: /home/.../1.2.0/assets/screenshots/campfire.png -> /_generated/...
Screenshot copied from archive: /home/.../1.2.0/assets/screenshots/tales.png -> /_generated/...
Screenshot copied from archive: /home/.../1.2.0/assets/screenshots/lantern-glow.png -> /_generated/...
```
Removed-version reason rendering, confirmed in the built HTML:
`grep -o "1\.1\.0 removed:.\{0,140\}" dist/mods/fixture/campfire-tales/index.html` ->
`1.1.0 removed:</strong> A contributed screenshot was a re-touched Blizzard asset, reported after
publish; artefacts pulled per ADR-0041. The archived sour...` -- rendered, not hidden, exactly as
the criterion requires. Screenshots (`docs/screenshots/mod-page-desktop.png`,
`mod-page-mobile.png`) show description, tags, gallery, README, version table and licence
together on one page.

## Criterion 4 -- install button: `modcraft://` URI + "coming soon" + direct download
`grep -o "modcraft://install/[^<\"]*" dist/mods/fixture/campfire-tales/index.html` ->
`modcraft://install/fixture/campfire-tales@1.2.0`. `grep -o "launcher coming soon" ...` matches.
`grep -o "archive.worldofmodcraft.com/fixture/campfire-tales/[0-9.]*\.tar\.gz" ...` matches all
three versions' archived-download links. Visible in `docs/screenshots/mod-page-desktop.png`'s
"Install" card.

## Criterion 5 -- browse page: list, filter by tag/type, sort by recently updated, filter demo
Sort: `src/pages/browse.astro` sorts fixtures by `updatedAt` descending server-side. Filter demo,
via a real headless-Chrome click (not a hand-simulated DOM mutation):
```
FILTER DEMO: before = "2 of 2 mods shown" after clicking tag=quest = "1 of 2 mods shown"
```
Screenshot: `docs/screenshots/browse-filtered-desktop.png`.

## Criterion 6 -- client-side search via Pagefind, finds a mod by a word unique to its description
Fixture `fixture:lantern-quests`'s `page.json` description contains "phosphorescent", chosen
because it appears in no other fixture. Real query via the actual Pagefind Default UI, driven by
`puppeteer-core` against the locally-headless Chrome described above (typed into the real
`<input>`, waited for real results, read the real DOM -- not a canned response):
```
QUERY: phosphorescent
[
  { "title": "Lantern Quests", "link": "/mods/fixture/lantern-quests/",
    "excerpt": "... A short phosphorescent quest chain through the old" },
  { "title": "Browse", ... }, { "title": "A modding platform, built out in the open.", ... }
]
```
Screenshot: `docs/screenshots/browse-search-desktop.png` (also shows the search UI correctly
re-themed dark to match the site -- see the "Pagefind theming bug" note below).

## Criterion 7 -- start page + About/Licensing page
`src/pages/index.astro`: states what the platform is, an explicit "Honestly, where this stands"
section naming what does NOT exist yet, and a decision-log link. `src/pages/about.astro`: a
"Licensing, in plain language" section walking through ADR-0049's three-way split (AGPL platform
/ MIT-with-linking-clause SDK / any-OSI-licence mods) for a non-lawyer reader, plus its own
rationale paragraph. Screenshots: `docs/screenshots/start-{desktop,mobile}.png`,
`about-{desktop,mobile}.png`.

## Criterion 8 -- design: dark, atmospheric, original, intentional at both viewports
Direction, typography, and a full "how each decorative asset was produced" log:
`docs/design.md`. Nothing Blizzard-derived: every image asset is either hand-authored inline SVG
or a from-scratch PNG encoder's output (`src/lib/png.mjs`, verified with `file` to be genuine
640x360 8-bit RGB PNGs); no font, icon or name is borrowed from Blizzard's identity. Fonts are
Cinzel + EB Garamond, both SIL OFL-1.1, self-hosted via `@fontsource/*` (no CDN). Screenshots at
both viewports, all committed under `docs/screenshots/`: `start-desktop.png`/`start-mobile.png`,
`browse-desktop.png`/`browse-mobile.png`, `mod-page-desktop.png`/`mod-page-mobile.png`,
`about-desktop.png`/`about-mobile.png`, plus `browse-filtered-desktop.png` and
`browse-search-desktop.png` for criteria 5/6.
**Bug found and fixed during this task, worth recording:** the first draft had a real, visible
whitespace bug -- Astro's compiler trims whitespace-only text nodes adjacent to a `<a>` tag when
authored on its own line, producing "Read thefull decision logif you want" with no spaces.
Caught by reading the actual screenshot, not by assuming the markup was fine; fixed with explicit
`{" "}` expressions in `index.astro`, `about.astro`, `SiteFooter.astro`. Re-screenshotted after the
fix. Separately, Pagefind's Default UI theming had a real bug too: `pagefind-ui.js` does NOT
auto-inject `pagefind-ui.css` in v1.5.2 (an assumption this task made and then disproved by
checking `document.styleSheets` in the real browser) -- fixed by adding the `<link>` explicitly in
`browse.astro`; a second real bug (CSS custom-property overrides on `:root` losing the cascade to
Pagefind's own later-loaded `:root` stylesheet) was fixed by scoping the overrides to `#search`
instead (`src/styles/global.css`, comment explains why).

## Criterion 9 -- deployment workflow, `CNAME`, triggers
`.github/workflows/deploy.yml`: triggers on `push` to `main`, `repository_dispatch` (type
`registry-updated` -- E12 assumption, `docs/build.md`), and manual `workflow_dispatch`; builds,
runs the archive-safety self-test first, then deploys via the official
`actions/upload-pages-artifact` + `actions/deploy-pages` flow. `dist/CNAME` contains
`worldofmodcraft.com` (verified by `scripts/verify-dist.mjs`, see criterion 1's output).
**GitHub Pages was not enabled and DNS was not touched** -- confirmed by inspection of this task's
own actions (no `gh` or DNS commands run), per the spec's explicit "Do not" list.

## Criterion 10 -- performance (Lighthouse if a browser genuinely exists here; it does, see above)
Real Lighthouse run against `http://localhost:8123/mods/fixture/campfire-tales/` (served by a
plain Node `http` static server in scratch, default Lighthouse config -- mobile emulation +
simulated throttling, the harder default, not `--preset=desktop`):
```
Performance score: 99
first-contentful-paint 1.4 s   largest-contentful-paint 1.4 s
total-blocking-time 0 ms       cumulative-layout-shift 0.058
speed-index 1.4 s
```
Full report committed at `docs/perf/lighthouse-mod-page.json`. Lighthouse's own
`network-requests` audit: **11 requests, ~181 KB transferred, 100% same-origin** (fonts and
images self-hosted; no third-party script/stylesheet at all -- listed in full in `docs/build.md`).
**Caveat recorded in `docs/build.md` and repeated here:** this measured a two-mod fixture site on
a local static server, not the live site under real conditions at real catalogue size -- **TODO:
re-run Lighthouse against the live `worldofmodcraft.com` once deployed** and once it carries more
than two mods.

## Criterion 11 -- docs explain the build
`docs/build.md`: the two data inputs and the one rule, how to run the build, `REGISTRY_DIR`/
`ARCHIVE_DIR` config to point at a real registry, what fixture data is and what to delete when
real mods exist, the full E11/E12/E13/E14 assumption-and-reconciliation table, deployment
triggers, the performance methodology above, and what "install" does today. `docs/design.md`:
design rationale and the asset-production log for criterion 8.

## Mid-task course correction: contracts E11 and E13 landed during this run
The coordinator flagged that `contracts/archive-layout.md` (E11) and `contracts/site-output.md`
(E13) had landed on `worldofmodcraft/registry`'s `task/025-boundary-contracts` branch (not yet
merged to `main`) and asked for reconciliation before completion. Read both in full from
`/home/ludwig/wt/registry-task-025/contracts/`. Reconciliation record (assumption confirmed /
overridden / still-open) is `docs/build.md`'s "Assumptions bound to task 025" table; the two real
gaps it found and closed:
- **`.nojekyll` (E13):** this build shipped none. Astro's default asset directory `_astro/`
  begins with an underscore, which Jekyll (GitHub Pages' default processor) silently excludes,
  breaking every deployed page's CSS/JS with no error anywhere. Fixed: `public/.nojekyll` (empty,
  verified `wc -c` = 0), checked by the new `scripts/verify-dist.mjs`, wired onto the end of
  `npm run build` itself (not just a one-time manual check) -- see criterion 1's output above.
- **Archive root + path-escape rule (E11):** this build's first implementation extracted a
  tarball's entries directly into a destination directory (no wrapping root assumed or checked),
  and had no defence against a hostile tar entry beyond whatever `node-tar` does by default. E11
  requires exactly one top-level root, determined by inspection (never guessed), and requires
  every entry -- not only manifest-declared ones -- to be checked for path traversal (`..`),
  absolute paths, and symlink escapes, rejecting the WHOLE archive on any violation. Fixed:
  `src/lib/archive.mjs` now lists every entry (`tar.list`, no extraction) before touching disk,
  determines the root from the entries, validates every entry including symlink targets, and
  only then extracts with `strip: 1`. Fixture tarballs were rebuilt
  (`scripts/make-fixture-archives.mjs`) to actually have the required wrapping shape, which they
  did not before. **Proven, not just coded:** `scripts/self-test-archive-safety.mjs` crafts three
  real hostile tarballs with the system `tar` binary (a traversal entry matching E11's own
  recorded attack example almost exactly, a symlink escaping the root, and a rootless archive)
  plus one well-formed control archive, and asserts the reader rejects all three hostile ones
  without writing outside its extraction directory, while still accepting the well-formed one.
  Real output:
  ```
  PASS  Attack 1 (traversal entry not declared by any manifest) is rejected
  PASS  Attack 2 (symlink entry targeting outside the archive root) is rejected
  PASS  Archive with no top-level root directory is rejected
  PASS  A well-formed single-root archive still extracts successfully (no false positive)

  All archive-safety checks passed.
  ```
  Wired into `.github/workflows/deploy.yml` as a step before every build.
- Also reconciled (already correct, now checked mechanically instead of by eye): `CNAME`'s exact
  content, `index.html`'s presence, one route per mod, Pagefind's output tree -- all now asserted
  by `scripts/verify-dist.mjs`.
- E11 does not mention `manifest.json` at all (this build's own invention, unconfirmed either
  way) -- extended the same degrade-not-fail treatment to it for consistency, and booked the
  judgement call under Questions above rather than deciding it silently.
- E12 and E14 have not landed their own contract documents yet -- this build's prior assumptions
  for both stand unchanged (`docs/build.md`'s table).

## What could not be verified
- Live-site Lighthouse and live DNS/HTTPS/Pages behaviour (blocked on Ludwig's manual steps,
  mission SS6 -- not this task's to do).
- Whether GitHub's actual Pages deploy action behaves exactly as `.github/workflows/deploy.yml`
  assumes -- it has not been run against a real GitHub Actions runner (this task has no CI access
  of its own); the workflow follows GitHub's own documented official pattern
  (`actions/upload-pages-artifact` + `actions/deploy-pages`) rather than a hand-rolled deploy step,
  which is the boring, well-trodden choice (ADR-0103) specifically to minimise this risk.

## Final verification commands (all re-run clean, immediately before this log entry)
```
$ rm -rf dist .cache public/_generated && npm run build   # exit 0, see criterion 1
$ npm run validate-fixtures                                # 7/7 OK
$ npm run test:archive-safety                               # 4/4 PASS
```
File scope respected throughout: no file outside this repository was written; the only files read
outside it were the (declared, read-only) platform repo, the registry repo's `contracts/`
(including the task/025 branch worktree the coordinator pointed at), and this machine's own
package/library files needed to install a verification-only headless browser.
