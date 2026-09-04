# Vendored registry schemas

`entry.schema.json`, `page.schema.json` and `manifest.schema.json` in this directory are byte-for-byte
copies of `worldofmodcraft/registry`'s `contracts/{entry,page,manifest}.schema.json`, taken on
**2026-09-04** (verified identical by `md5sum` against `~/registry/contracts/*.schema.json` at that
date — the task brief states these merged to `main` "today" and are stable).

## Why a vendored copy, not a path into the sibling checkout

The site build must not depend on `worldofmodcraft/registry` being checked out next to it on disk
(the task's file scope forbids touching that repository, and `src/lib/config.ts`'s whole point is
that a real registry location is *configuration*, not a hardcoded relative path). `scripts/validate-fixtures.mjs`
and any future runtime schema check read these local copies so the site repository is self-contained.

## Keeping them in sync

These files are not the source of truth — `worldofmodcraft/registry` is. If the registry schemas
change, re-copy them here in the same PR that adapts `src/lib/registry.ts` to the change, and update
the date above. `scripts/validate-fixtures.mjs` fails loudly (not silently) if a fixture no longer
matches, which is the signal that a re-copy is due.
