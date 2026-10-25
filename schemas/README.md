# Vendored registry schemas

`entry.schema.json`, `page.schema.json` and `manifest.schema.json` in this directory are byte-for-byte
copies of `worldofmodcraft/registry`'s `contracts/{entry,page,manifest}.schema.json`, last
re-synced on **2026-10-25** (task 065) from the registry branch `task/065-entry-schema-key-id` at
commit `e9b121e` (registry task 065, before its merge: the schema bytes are what is enforced, not the
commit id). That sync added the `key_id` pattern `^[0-9A-F]{16}$` (registry task 065) and also carried
the version-object states of registry task 057, which the earlier copy (task 041, 2026-10-15, registry
commit `ec56e9f`) predated. Equality is enforced by `check-schemas`, not by this sentence.

## Why a vendored copy, not a path into the sibling checkout

The site build must not depend on `worldofmodcraft/registry` being checked out next to it on disk
(the task's file scope forbids touching that repository, and `src/lib/config.ts`'s whole point is
that a real registry location is *configuration*, not a hardcoded relative path). `scripts/validate-fixtures.mjs`
and any future runtime schema check read these local copies so the site repository is self-contained.

## Keeping them in sync

These files are not the source of truth — `worldofmodcraft/registry` is. Never edit them by hand.

- `npm run sync-schemas -- <registry-checkout>` re-copies the three files from
  `<registry-checkout>/contracts/` (exit 2, copying nothing, if any of the three is missing).
- `npm run check-schemas -- <registry-checkout>` compares SHA-256 of the raw bytes: exit 0 and
  `compared=3 differ=0` if identical, exit 1 naming every differing file, exit 2 on a usage error or a
  missing file or directory. Neither script touches the network; you supply the checkout.
- CI runs the check against a fresh checkout of the registry's default branch in
  `.github/workflows/schema-sync.yml` (pull requests, pushes to main) and in `deploy.yml` before the
  build. So a registry merge that changes a schema turns the site red until someone re-syncs: run
  `sync-schemas`, then `npm test`, and merge. A fixture failing against a tightened schema is a finding,
  not a fixture to loosen.
