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
- **ADR-0120** (content whitelisting, not container framing) — **added retroactively during fix
  round 1 (2026-09-05); this was the manager's Context-selection miss, not the implementing
  agent's, since it postdates this task's original Context list and was never surfaced before
  work started.** It applies here because this branch copies third-party screenshot PNGs verbatim
  from a mod's archive into publicly-served `dist/` (`scripts/prepare-content.mjs`) with no
  re-validation of their content at this layer — on the unstated assumption that registry
  ingestion (a different component, ADR-0120's own home) already ran the whitelist check ADR-0120
  requires before the archive was ever accepted. That assumption is now stated explicitly in
  `docs/build.md`, not implemented here — PNG interior-content validation belongs to ingestion,
  not the site build (see fix round 1's log entry for F5).
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

## Fix round 1 (2026-09-05)

An independent adversarial review returned BLOCKING with three findings (F1-F3), all independently
verified real by the manager before this round started, plus five non-blocking findings (F4-F8)
and a verification-artefact requirement (F9). Every fix below was demonstrated with a command
actually run and, where the finding was a defect in an existing check, mutation-tested: the
check's subject was broken, the check was shown to redden, then both were restored. All commands
below were re-run for this log entry; none of this output is invented.

### F1 (BLOCKING) -- arbitrary local file read, published publicly

**What changed:** `src/lib/archive.mjs` gained one shared, exported helper,
`isSafeModSuppliedRelativePath(relPath)` (reuses the existing `hasParentSegment()` segment check --
not a second, subtly different implementation). `scripts/prepare-content.mjs`'s screenshot-copy
loop (was line 119, `const abs = path.join(extractedDir, relPath)`) now calls this helper before
the join and, on rejection, degrades exactly as a missing screenshot degrades (log a warning, omit
the gallery slot, keep building) -- but the warning says "rejected as unsafe", not "not found", per
the brief.

**Full audit of every `path.join` whose second argument is mod-supplied data** (grepped across
`src/` and `scripts/`, verdict for each recorded in `docs/build.md`'s new "Mod-supplied path
safety" section, reproduced here):

| Call site | Verdict |
|---|---|
| `scripts/prepare-content.mjs` screenshot copy (`page.json`'s `screenshots[]`) | **Was unsafe -- fixed.** |
| `manifest.schema.json`'s own `screenshots[]` | **Dormant, same bug, never read by any code in this repo today.** Flagged in `docs/build.md` so whoever wires it up reuses the shared helper instead of re-deriving the check. |
| README read (`path.join(extractedDir, "README.md")`) | Safe -- hard-coded literal, not mod-supplied. |
| manifest read (`path.join(extractedDir, "manifest.json")`) | Safe -- hard-coded literal. |
| `localArchivePathFor()` (`source_archive` URL's `pathname`) | Safe, verified not assumed: `new URL(...)`'s WHATWG path parser resolves/clamps `.`/`..` (including `%2e%2e`) during parsing itself -- confirmed directly: `new URL("https://x/../../../etc/passwd").pathname === "/etc/passwd"`, never a literal `..` segment. |
| `registry.mjs`'s `loadMods()` (`d.name` from `fs.readdirSync`) | Safe -- `d.name` is a real, already-existing child of the directory the OS just listed; a directory literally named `..` cannot exist as a listed child. |
| `ns`/`name`/`version` joins (`CACHE_DIR`, `GENERATED_PUBLIC_DIR`) | Safe by schema -- `entry.json`'s `id` pattern and the semver pattern admit no `/` at all. |

**Demonstration** (isolated scratch registry/archive built from a real copy of the
`fixture:lantern-quests` fixture, `page.json`'s `screenshots[]` mutated to
`["assets/screenshots/mine-tunnel.png", "../".repeat(20) + "etc/passwd"]` -- the clamping form, per
the manager's escalation note, not a count-exact payload):
```
$ REGISTRY_DIR=.../f1-regress/registry ARCHIVE_DIR=.../f1-regress/archives \
    node scripts/prepare-content.mjs
...
Screenshot copied from archive: .../mine-tunnel.png -> /_generated/mods/fixture/lantern-quests/screenshots/mine-tunnel.png
WARNING -- fixture:lantern-quests: page.json screenshot "../../../../../../../../../../../../../../../../../../../../etc/passwd"
  rejected as unsafe (escapes the archive root via ".." or is otherwise not a plain relative path)
  -- omitting this gallery slot rather than failing the build (E11 degrade philosophy).

Wrote 1 mod record(s) to .../.cache/site-content.json.
$ echo EXIT=$?
EXIT=0
$ grep -rl "root:x:0:0" public/_generated   # /etc/passwd's own content, searched for anywhere in the generated tree
(no output -- not found)
```
**Mutation test:** reverted `scripts/prepare-content.mjs` to its pre-fix-round-1 content and
re-ran the same scratch fixture through `docs/tasks/009-verify.sh`'s own regression step:
```
STEP 4. Regression check for fix round 1, finding F1 ...
...
Screenshot copied from archive: /etc/passwd -> /_generated/mods/fixture/lantern-quests/screenshots/passwd
FAIL  no 'rejected as unsafe' warning found -- ...
LEAKED: public/_generated/mods/fixture/lantern-quests/screenshots/passwd is byte-identical to /etc/passwd
FAIL  a local file was copied into the publicly-served tree via the traversal path -- F1 is NOT fixed
```
Restored the fix; re-ran; both checks green again. The mutation genuinely reproduced the reviewer's
end-to-end exploit (a real byte-identical `/etc/passwd` landing in the publicly-served tree), and
the regression check catches it.

**Manager's escalation (verify-dist was blind to the exploit even with F1 fixed in isolation):**
the manager reproduced F1 on the unmodified `f93be23` and found `scripts/verify-dist.mjs` printed
"OK -- no local filesystem paths found in served HTML" while a byte-identical `/etc/passwd` sat in
`dist/_generated/...` -- the old leak scan greped HTML text for path *strings*, with no notion of a
foreign *file* in the generated tree. Fixed with a second, independent line of defence in
`scripts/verify-dist.mjs`: every file under `dist/_generated/**/screenshots/` must now be a real
image by magic bytes (PNG `89504e470d0a1a0a`, JPEG `ffd8ff`, or RIFF/WEBP), never by file extension
(ADR-0120's typing philosophy). Demonstrated per the manager's explicit ask -- plant a non-image
file, show it reddens, remove it:
```
$ echo "not a real image, just text" > dist/_generated/mods/fixture/lantern-quests/screenshots/sneaky.txt
$ node scripts/verify-dist.mjs
...
FAIL  .../sneaky.txt is not a recognised image by magic bytes (PNG/JPEG/WEBP) -- this tree is
      served publicly and must contain only screenshots copied from an archive, never an arbitrary
      file (fix round 1, F1). Extension is not evidence of file type (ADR-0120).
1 dist/ check(s) FAILED against contracts/site-output.md (E13).
$ rm dist/_generated/mods/fixture/lantern-quests/screenshots/sneaky.txt
$ node scripts/verify-dist.mjs
...
OK    all 5 file(s) under dist/_generated/ are real images by magic bytes
dist/ satisfies every check this repository runs against contracts/site-output.md (E13).
```
**Narrowing stated explicitly, per the manager's note:** this primitive reads regular files with a
real size that the build process's OS user can read (e.g. `/etc/passwd`) -- `fs.copyFileSync` on
`/proc/self/environ` copies 0 bytes, so environment-borne CI secrets are not reachable through this
specific primitive. The impact is "reads files the runner's user can read off disk", not "reads the
runner's environment."

### F2 (BLOCKING) -- E14 violated by Pagefind's indexed URLs

**Read `contracts/url-scheme.md` (E14) in full** (landed on the registry's `task/025-boundary-
contracts` branch): canonical mod-page URL is `/mods/<ns>/<name>`, no trailing slash, and Pagefind's
own indexed URL is explicitly named as something that must match byte-for-byte.

**Investigated, not guessed:** decompressed a `.pf_fragment` file directly (`gzip`-compressed bytes,
literal 12-byte ASCII magic `"pagefind_dcd"` immediately followed by compact JSON, nothing after
it) and read `{"url":"/about/","content":...}` -- confirmed every route's fragment carried a
trailing slash, not only mod pages. Read `node_modules/pagefind/README.md` and `npx pagefind
--help` in full: no CLI flag suppresses the trailing slash (`-k`/`--keep-index-url` only controls
whether `index.html` stays at the end); a per-page override would require switching from the CLI to
the Node indexing API, a bigger, less-boring change (ADR-0103) than fixing four bytes after the
fact.

**Fix:** a post-index normalisation step, `scripts/normalize-pagefind-urls.mjs`, wired into
`npm run build` between `index-search` and `verify-dist`. It decodes every fragment (via the new
shared `src/lib/pagefind-fragment.mjs`, also used by `verify-dist.mjs` so there is one
implementation of the on-disk format, not two), strips exactly one trailing `/` from `url` (except
the bare root `/`), and re-encodes. Applied uniformly to every route, not only `/mods/**`, because
the site's own internal links (`browse.astro`, `index.astro`, `SiteFooter.astro`,
`SiteHeader.astro`) already never emit a trailing slash for any route -- a single uniform rule
matches that convention rather than special-casing mod pages.

**Demonstration (real build output):**
```
> node scripts/normalize-pagefind-urls.mjs
en_10267a5.pf_fragment: "/about/" -> "/about" (E14: no trailing slash)
en_5fb0b0b.pf_fragment: "/mods/fixture/lantern-quests/" -> "/mods/fixture/lantern-quests" (E14: no trailing slash)
en_77408b6.pf_fragment: "/browse/" -> "/browse" (E14: no trailing slash)
en_782a552.pf_fragment: "/mods/fixture/campfire-tales/" -> "/mods/fixture/campfire-tales" (E14: no trailing slash)

Checked 5 Pagefind fragment(s); rewrote 4 to drop a trailing slash.
```
`scripts/verify-dist.mjs` gained two permanent regression checks (F8's ask, "so F2 cannot regress
silently"): no generated HTML `href` carries a trailing slash on a page route, and no Pagefind
fragment's `url` does either.

**Mutation test 1 (skip the normalize step):** built without running
`normalize-pagefind-urls`, then ran `verify-dist.mjs`:
```
FAIL  .../en_10267a5.pf_fragment indexes url "/about/" with a trailing slash -- E14 ... Did npm run
      normalize-pagefind-urls run before verify-dist?
FAIL  .../en_5fb0b0b.pf_fragment indexes url "/mods/fixture/lantern-quests/" with a trailing slash ...
FAIL  .../en_77408b6.pf_fragment indexes url "/browse/" with a trailing slash ...
FAIL  .../en_782a552.pf_fragment indexes url "/mods/fixture/campfire-tales/" with a trailing slash ...
4 dist/ check(s) FAILED against contracts/site-output.md (E13).
```
**Mutation test 2 (inject a trailing-slash href):** hand-edited `dist/index.html`'s `/browse` link
to `/browse/`:
```
FAIL  dist/index.html links to "/browse/" with a trailing slash -- E14 (url-scheme.md) requires no
      trailing slash on a page route.
```
Both restored with a clean `npm run build`; `verify-dist.mjs` green again both times (10 OK lines,
0 FAIL). **F2 was fixed, not escalated** -- the boring post-index normalisation step worked.

### F3 (BLOCKING) -- the path-escape check skips the first segment

**What changed:** `src/lib/archive.mjs`'s `validateAndDetermineRoot()` used to destructure
`const [firstSegment, ...rest] = segments` and call `hasParentSegment(rest)`, leaving the segment
that becomes `root` unchecked. Now calls `hasParentSegment(segments)` over the whole path, matching
`archive-layout.md`'s own wording ("anywhere in the path -- not only at the start").

**Demonstration:** crafted a tar entry named literally `../onlyfile.txt` (GNU tar refuses to WRITE a
leading `../` directly, so built it with an innocent name then `--transform`'d it after tar had
already read the file from disk -- the same disguise technique the existing self-test's Attack 1
already used, and confirmed with `node-tar`'s own `tar.list()` that the entry's path really is
`"../onlyfile.txt"` inside the archive):
```
$ node -e '... extractArchive(".../attack2.tar.gz", {ns:"attack",name:"f3",version:"1.0.0"}) ...'
REJECTED (GOOD): MalformedArchiveError attack:f3@1.0.0 (.../attack2.tar.gz): entry
  "../onlyfile.txt" escapes the archive root via "..".
```
**Mutation test:** `git stash`'d back to the pre-fix `archive.mjs` and re-ran the identical archive
against it:
```
ACCEPTED (confirms pre-fix bug) -- extracted to /home/ludwig/wt/site-task-009/.cache/archives/attack/f3/1.0.0
```
Confirms the fix is load-bearing, not coincidental. Fix restored; re-ran; rejected again.

### F4 (non-blocking) -- E9 signature/hash verification, not yet wired up

Read `contracts/signature-format.md`'s cross-reference in `archive-layout.md`: "a consumer must
complete E9's verification before extracting anything this document describes." Not implemented in
this branch, and not exploitable today (the workflow's tarball staging is commented "NOT YET WIRED
UP" -- no externally-supplied tarball reaches `extractArchive()` yet). Added as an explicit named
TODO row in `docs/build.md`'s "Assumptions bound to task 025" table (the E9 row) so whoever wires up
real staging finds it there rather than rediscovering the gap.

### F5 (non-blocking) -- ADR-0120 was a Context-selection miss

Added ADR-0120 (content whitelisting, not container framing) to `docs/tasks/009-site-build.md`'s
Context section, marked explicitly as a retroactive manager miss, not this task's original scope.
Documented the actual, unstated assumption in `docs/build.md`'s new "Content trust assumption
(ADR-0120)" section: this build copies archive screenshots into public `dist/` verbatim, trusting
that registry ingestion already ran ADR-0120's whitelist check before the archive was accepted --
PNG interior-content validation is NOT implemented here, by design; it belongs to ingestion. (The
new magic-bytes check added for F1's escalation is a different, narrower thing -- "is this a
well-formed image container at all" -- and `docs/build.md` explicitly says not to read it as an
ADR-0120 whitelist.)

### F6 (non-blocking) -- self-test coverage gaps

Added two cases to `scripts/self-test-archive-safety.mjs`: **Attack 4**, two different top-level
roots in one archive (the code already rejected this; the test didn't cover it), and **Attack 5**,
an entry whose own first segment is `..` with no other entry to establish a different root first
(the precise F3 regression -- see F3's mutation test above, run through this same test file):
```
$ npm run test:archive-safety
PASS  Attack 1 (traversal entry not declared by any manifest) is rejected
PASS  Attack 2 (symlink entry targeting outside the archive root) is rejected
PASS  Archive with no top-level root directory is rejected
PASS  Archive with two different top-level roots is rejected
PASS  Entry whose own first segment is ".." is rejected (not just checked from the second segment on)
PASS  A well-formed single-root archive still extracts successfully (no false positive)

All archive-safety checks passed.
```

### F7 (non-blocking) -- no `npm test` script

Added `"test": "npm run validate-fixtures && npm run test:archive-safety && npm run build"` to
`package.json`, aliasing the de-facto suite this repository already ran piecemeal.

### F8 (non-blocking) -- `verify-dist.mjs`'s leak scan too narrow

Broadened the leak-needle list from `[REPO_ROOT, "/home/", "C:\\Users"]` to also include
`"/root/"`, `"/Users/"`, and `"/github/workspace"`. **Mutation test:** injected
`<p>debug: built at /root/ci-workspace/site</p>` into `dist/index.html`:
```
FAIL  dist/index.html contains what looks like a local filesystem path ("/root/") -- E13's
      "no environment-specific values" rule.
```
Confirmed the OLD needle list would have missed it (`node -e '...oldNeedles.some(...)' ` ->
`false`), confirming this is a real widening, not a no-op. Restored with a clean build; green
again. (The canonical-URL assertions this same finding asked for are covered under F2 above.)

### F9 -- verification artefact, and its mutation-test exercise

`docs/tasks/009-verify.sh` (executable, `chmod +x`) runs, from a fresh checkout: dependency install
if `node_modules` is missing, fixture validation, the archive-safety self-test, a clean
`npm run build`, and the new F1 regression check (isolated scratch fixture, clamping-form
traversal payload, asserts both the "rejected as unsafe" log line and that no byte-for-byte copy of
`/etc/passwd` exists anywhere under `public/_generated/`), then a final restore build so the
worktree is left in its normal state. Full real run:
```
$ ./docs/tasks/009-verify.sh
...
PASS  fixtures validate
PASS  archive-safety self-test passed
PASS  npm run build succeeded (chains prepare-content, astro build, index-search,
      normalize-pagefind-urls, verify-dist -- E13/E14 checked as part of this)

Generated routes (find dist -name index.html):
dist/about/index.html
dist/browse/index.html
dist/index.html
dist/mods/fixture/campfire-tales/index.html
dist/mods/fixture/lantern-quests/index.html

STEP 4. Regression check for fix round 1, finding F1 ...
(prepare-content exited 0 against the hostile fixture, as expected -- E11 degrade, not fail)
PASS  the traversal screenshot path was rejected as unsafe (F1 fix engaged)
PASS  no file under public/_generated/ is a copy of /etc/passwd -- the traversal did not reach the published tree

STEP 5. Restoring a real, clean build (so the worktree is left in its normal built state)
PASS  final restore build succeeded

PASS  All task 009 verification checks passed.
```

**Mutation-test summary (every check in the script, subject broken, check shown to redden, then
restored):**

| Check | Mutation | Result |
|---|---|---|
| Fixture validation | Deleted `page.json`'s required `tags` field | `Error: ... failed page.schema.json validation: - (root) must have required property 'tags'`, exit 1. Restored, green. |
| Archive-safety self-test | Reverted `src/lib/archive.mjs` to pre-fix-round-1 | `FAIL Entry whose own first segment is ".." is rejected ...`, exit 1. Restored, green. |
| Clean build | Moved `fixtures/registry` away | `Error: No mods directory at .../fixtures/registry/mods`, exit 1. Restored, green. |
| F1 regression check | Reverted `scripts/prepare-content.mjs` to pre-fix-round-1 | Both sub-checks failed, with the real leak reproduced (`Screenshot copied from archive: /etc/passwd -> ...`, `LEAKED: ... is byte-identical to /etc/passwd`). Restored, green. |
| verify-dist: generated-screenshot magic bytes (F1 escalation) | Planted `sneaky.txt` under `dist/_generated/**/screenshots/` | `FAIL .../sneaky.txt is not a recognised image by magic bytes ...`. Removed, green. |
| verify-dist: Pagefind fragment URL / HTML href canonical form (F2/F8) | Skipped `normalize-pagefind-urls`; separately hand-edited an `href` to add a trailing slash | Both reddened with the exact fragment/file named. Restored via clean build, green. |
| verify-dist: local-path leak scan (F8) | Injected `/root/...` text into `dist/index.html` | `FAIL dist/index.html contains what looks like a local filesystem path ("/root/")`. Confirmed the pre-F8 needle list would have missed it. Restored, green. |

No check in this script (or in `verify-dist.mjs`/`self-test-archive-safety.mjs`) stayed green while
its subject was broken.

### Files changed this round
`src/lib/archive.mjs` (F1 helper, F3 fix), `scripts/prepare-content.mjs` (F1 call site),
`scripts/verify-dist.mjs` (F2/F8 canonical-URL checks, F8 broadened leak scan, F1-escalation
magic-bytes check), `scripts/self-test-archive-safety.mjs` (F6), `package.json` (F7 `test` script,
`normalize-pagefind-urls` wired into `build`), `scripts/normalize-pagefind-urls.mjs` (new, F2),
`src/lib/pagefind-fragment.mjs` (new, shared fragment codec for F2), `docs/build.md` (F1 audit
table, F2/F3/F4/F5/F8 documentation), `docs/tasks/009-site-build.md` (F5 Context addition, this
log), `docs/tasks/009-verify.sh` (new, F9).
