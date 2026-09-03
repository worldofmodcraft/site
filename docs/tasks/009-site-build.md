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
- (none yet)

---
# Task 009 log  (append-only, updated continuously by the executing agent)
- 2026-09-03 spec approved; worktree created from site `main` (task 022's seed commit).
