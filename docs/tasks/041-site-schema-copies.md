# Task 041: Give the site's copies of the registry schemas a sync mechanism that can fail

- **Mission:** SITE-V1 — **Status:** review (manager, 2026-10-14, after independent spec review round 2: PASS) 
- **Agent / model:** implementer / sonnet
- **Budget:** small (≤ 1 agent-session)
- **Branch / worktree:** `task/041-site-schema-copies` / `~/wt/site-task-041` — **site** repo (`worldofmodcraft/site`)

## Objective
The site repository's three vendored schemas (`schemas/{entry,page,manifest}.schema.json`) are
provably identical to the registry's `contracts/*.schema.json`, and any divergence turns a check
red instead of going unnoticed. After this task: `npm run sync-schemas -- <registry-checkout>`
re-copies them, `npm run check-schemas -- <registry-checkout>` exits non-zero on any byte
difference, and both the site's pull-request workflow and its deploy workflow run that check
against a fresh checkout of the registry's `main`.

## The finding this closes (re-verified 2026-10-14, not copied from the 2026-09-06 draft)
The 2026-09-06 draft said the copies were byte-identical. They no longer are. Registry PR #5
(task 034) merged, and two of the three copies are stale:

```
$ cd /home/ludwig/site
$ for f in entry page manifest; do
    printf '%s site=' $f; git show origin/main:schemas/$f.schema.json | sha256sum | cut -c1-16
    printf '%s reg =' $f; git -C /home/ludwig/registry show origin/main:contracts/$f.schema.json | sha256sum | cut -c1-16
  done
entry    site=32ff7b78fd1eeefa   reg =32ff7b78fd1eeefa     (identical)
page     site=1a476ea643554f2f   reg =8c4c1a2d66c80320     (DIFFERENT)
manifest site=12c13c332341fa2a   reg =885a26c759713950     (DIFFERENT)
```
(Real output of those commands after `git fetch` of both repos on 2026-10-14, laid out on one line
per file for reading; digests truncated to 16 hex characters here, full digests in the criteria.)
`page.schema.json` and `manifest.schema.json` differ because task 034 added the `..`-segment
exclusion to `screenshots[]`. This task's first act is therefore a real re-sync, and its first
demonstration is a check that is red on `origin/main` today.

The site defends itself at runtime (`isSafeModSuppliedRelativePath` in `src/lib/archive.mjs`);
that defence stays. This task removes the drift mechanism, not that defence.

## Decision made in this spec (and why)
The draft named three options: build-time checkout, vendored copy plus drift check, published
artefact. **Chosen: vendored copy plus a drift check against a registry checkout.**
- The site must stay buildable offline from its own tree (docs/build.md and `schemas/README.md`:
  the site repository is self-contained; task 009 forbids network at build time). A pure
  build-time checkout would break that. A published contracts artefact adds a new node and edge
  that nobody has specified (ADR-0117) for the sake of three files.
- A vendored copy plus a comparison that runs wherever a registry checkout is available is the
  boring option (ADR-0103) and needs no new edge: E10 already names the registry's `contracts/`
  as its contract; the check only compares against it.

## Context to load (exhaustive)
- ADRs: 0059 §1-§2 (page content, archive-only sourcing), 0103 (boring solutions), 0117 (graph
  before code). ADR selection: `docs/decisions/INDEX.json` lookup on "schema" and "site".
- Files (site repo): `schemas/README.md`, `schemas/*.schema.json`, `src/lib/validate.mjs`,
  `scripts/validate-fixtures.mjs`, `.github/workflows/deploy.yml`, `package.json`, `docs/build.md`.
- Files (registry repo, read-only): `contracts/{entry,page,manifest}.schema.json`.
- Doctrine: MANAGER.md §2c (all five rules), §3.6b, §3.6c, §3.7.
- Graph: `docs/architecture/depgraph.md` — node **N7 site-build**, edge **E10**.

## File scope (declared; anything else = stop and report)
In the **site** repo only:
- `scripts/sync-schemas.mjs` (new), `scripts/check-schemas.mjs` (new)
- `schemas/*.schema.json` (re-copied by the sync script; no hand edits)
- `schemas/README.md` (rewrite "Keeping them in sync"; update the "taken on" date)
- `package.json` (two script entries only)
- `.github/workflows/schema-sync.yml` (new: runs the check on pull requests and pushes to main)
- `.github/workflows/deploy.yml` (one new step before the build: check out registry `main` into
  `registry-checkout/` and run the check; **no other change** — task 055 owns the rest of this file)
- `docs/tasks/041-site-schema-copies.md` (this file, carried into the site repo as the task log)
- `docs/tasks/041-verify.sh` (new, executable)
- `docs/build.md` (the one paragraph describing sync)

## Acceptance criteria
[script] = run by `docs/tasks/041-verify.sh`; [external] = a live CI run, not script-verified.
1. [script] `check-schemas.mjs <registry-dir>` compares all three files by SHA-256 of the raw bytes
   and exits 0 only if all three match; exit 1 names every file that differs (all of them, not the
   first); exit 2 on usage error (missing directory, missing file). The three exits are distinct and
   documented in the script header.
2. [script] **The check is red on the pre-fix tree, against a pinned input.** The verify script
   materialises the site's schemas from the recorded pre-fix commit (the stale ones; record its sha in the
   log) beside the registry's schemas **at a recorded registry commit** (`ec56e9f` when read on 2026-10-14;
   the log re-verifies the three digests at that commit with `git show <sha>:contracts/...`) or beside
   checked-in copies under `scripts/tests/fixtures/registry-at-<sha>/`. It never reads live registry
   `main`: the verdict must not change when the registry merges something. It shows exit 1 naming `page.schema.json` and `manifest.schema.json` and not
   `entry.schema.json` — written and shown failing before the re-sync (MANAGER.md §2c rule 5).
3. [script] After `sync-schemas.mjs`, `check-schemas.mjs` exits 0 and the three copies equal the
   registry's by full SHA-256. The sync script exits 2 on a registry directory lacking any of the
   three files, rather than copying a subset.
4. [script] **Mutation:** flip one byte in each of the three site copies in turn; the check reddens
   each time and names that file. Delete one copy: exit 2, not 0 (a missing file is not "no
   differences"). Point the check at an empty directory: exit 2.
5. [script] **A comparison of nothing is a broken comparison:** the check prints `compared=3` on
   success and the verify script asserts it; a variant of the check run with the file list
   emptied must fail.
6. [script] The existing suite passes on the re-synced schemas: `npm test` exits 0, and the
   fixtures validate against the new, stricter `page`/`manifest` schemas. If a fixture fails because
   of the tighter pattern, that is a finding to report, not a fixture to loosen.
7. [script] Both workflow files contain the check step, against a checkout of
   `worldofmodcraft/registry` at its default branch (the live-`main` comparison belongs to the workflows only, by design), and neither pins a registry commit (a pinned
   commit would compare against a stale copy — the original defect). Greps that fail on zero matches.
8. [external] The new workflow runs green on the task's own PR, **with the registry commit it compared
   against printed in the run log and recorded in this file**. If a registry schema merge lands while the
   task is open, the run legitimately reddens: the remedy is to re-run `sync-schemas` at the new registry
   sha and record it, not to treat it as a task failure; the red-demonstration below is independent of the
   registry's state because it flips one byte of a vendored copy. To prove it can fail in CI, a
   separate throwaway branch that flips one byte of a vendored schema is pushed, shown red, and its
   PR closed unmerged (no history rewrite after push; MANAGER.md §3.9). Both run URLs go in the log.
9. [script] `schemas/README.md` states the actual procedure and date; greps assert the words
   `sync-schemas` and `check-schemas` appear in it.
10. `docs/tasks/041-verify.sh` exists, is executable, was mutation-tested (criterion 4 is the
    mutation) and was run in a **fresh clone**, its output pasted in the log (§2c rule 4).

## Forbidden here
- Editing a schema by hand in the site repo, changing the registry's copy from the site side, or
  loosening a fixture to make a stricter schema pass.
- A check that compares anything other than raw bytes (parsed-JSON equality hides whitespace and
  key-order drift; the contract is the file).
- Network access inside the check or sync scripts: they take a directory; the workflow does the
  checkout (the site build stays offline, task 009).
- A check that reports success on an empty or partial registry directory (criteria 4-5).
- Touching `src/lib/archive.mjs` or the runtime path-safety defence.
- Anything in MANAGER.md §3.7.

## Dependencies and sequencing
- Needs registry PR #5 (task 034) merged — **done**; it is what created the drift.
- **Sequence before task 055.** Both edit `.github/workflows/deploy.yml`; 055 builds on the
  registry-checkout step this task adds. Not parallel.
- Independent of 008a/008b/010.
- Graph: touches node **N7** and edge **E10** only. No new edge: the check reads the registry's
  `contracts/`, the location E10 already names as its contract.

## Verification artefact (MANAGER.md §2c)
Declared: `docs/tasks/041-verify.sh` (criteria 1-7 and 9 are script-verified; 8 is a live CI run
and is recorded as such). Criterion 2 is rule 5's forward form: the break (stale `page`/`manifest`)
is a fixture shown failing before the fix.

## Design consequence (stated so nobody is surprised later)
Because the deploy workflow checks the vendored copies against the registry's live `main`, **every
merge to the registry that changes a `contracts/*.schema.json` file turns the site's deploy red until the
site's copies are re-synced** — including task 057 (the `pending` state; the `oneOf` rewrite of
`entry.schema.json`). That is the mechanism working as designed (a red deploy is better than a site
validating against a stale contract). **Who re-syncs and when:** the manager books a small "re-sync
schemas" task in the site repository **in the same session in which a registry schema change merges**,
as part of that change's closing checklist (the registry task's log names it); the task runs
`npm run sync-schemas`, `npm test`, and merges. For 057 specifically it is a precondition of task 055
and is already named in 055's Dependencies. Until it merges, site deploys fail visibly; no auto-sync
workflow is built here (a bot rewriting the site's schemas would bypass review).

## Deliverables
Scripts + workflows + re-synced schemas + verify script + docs updated + this file's log section current.

## Questions  (agent-maintained; see MANAGER.md 8b)
- Q: Should the check also fail when the registry adds a schema file the site does not vendor? |
  options: A) no, three named files only / B) compare every `contracts/*.schema.json` | assumed: A |
  built on assumption: the file list is hard-coded to the three E10 names; revisit if E10's
  contract set grows.

---
# Task 041 log  (append-only, updated continuously by the executing agent)
- 2026-09-06 draft opened by the manager (finding raised by the reviewer of registry PR #5).
- 2026-10-14 gate-ready spec written under task 054; drift re-verified (page and manifest differ).
- 2026-10-15 implementer: built check-schemas/sync-schemas, package.json entries, schema-sync.yml, one step in deploy.yml (before Node setup/build), re-synced page+manifest, README/build.md, docs/tasks/041-verify.sh. Pinned inputs: registry commit ec56e9f (digests re-verified by the verify script via git show: entry 32ff7b78fd1eeefa, page 8c4c1a2d66c80320, manifest 885a26c759713950; registry origin/main 4d4a204 has identical schemas); pre-fix site commit 37ff009 (stale page 1a476ea643554f2f, manifest 12c13c332341fa2a).
- Red before fix (AC2, real output, run on the stale tree before sync): exit=1, "DIFFERS page.schema.json ... DIFFERS manifest.schema.json ... compared=3 differ=2"; entry not named.
- AC6: npm test exit 0 on the re-synced schemas; no fixture needed loosening, no finding.
- Fresh-clone run at sha cce2f45 (clone of the branch in /tmp/fc041, npm ci inside), tails:
  - verify: "ok   AC9 README mentions check-schemas / VERIFY: PASS / rc=0" (all AC1-7, AC9 lines ok)
  - --mutate: "MUTANT sync-partial: killed ... / MUTATION: all mutants killed / rc=0" (7 mutants, each killed by a named check: always-green, first-only, missing-is-ok, empty-list-ok, no-count, sync-subset, sync-partial).
- Open (external, AC8): live CI run of schema-sync.yml on the PR with the registry sha printed in the run log (the workflow prints it); plus a throwaway branch flipping one byte, shown red, PR closed unmerged. URLs and registry sha to be recorded here by the manager. Not run: no push by instruction.
- Assumption A (Questions) unchanged: file list hard-coded to three names.
