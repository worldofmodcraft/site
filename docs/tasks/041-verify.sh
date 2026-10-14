#!/usr/bin/env bash
# Task 041 verification. Run from anywhere:  docs/tasks/041-verify.sh [--mutate]
#   (no flag)  verify criteria 1-7 and 9 against this tree; exit 0 only if all pass
#   --mutate   mutation-test THIS script: sabotage check-schemas/sync-schemas in several ways and
#              require that the verification then FAILS for each (MANAGER.md 2c rule 4)
# Inputs are pinned: the registry is read from git at a recorded commit, never from live main.
#   REGISTRY_REPO (default /home/ludwig/registry) must contain that commit.
#   VERIFY_SCRIPTS_DIR / VERIFY_SKIP_NPM are used by --mutate.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
REG_REPO="${REGISTRY_REPO:-/home/ludwig/registry}"
REG_SHA=ec56e9f
PRE_FIX=37ff009
SCRIPTS="${VERIFY_SCRIPTS_DIR:-$ROOT/scripts}"
NAMES="entry page manifest"

if [ "${1:-}" = "--mutate" ]; then
  T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
  fails=0
  mutant() { # name, file, sed-expression
    local d="$T/$1"; mkdir -p "$d"; cp "$ROOT"/scripts/{check,sync}-schemas.mjs "$d/"
    sed -i "$3" "$d/$2"
    if cmp -s "$d/$2" "$ROOT/scripts/$2"; then echo "MUTANT $1: sed changed nothing -- broken mutation"; fails=1; return; fi
    if VERIFY_SCRIPTS_DIR="$d" VERIFY_SKIP_NPM=1 "$HERE/041-verify.sh" >"$d/out" 2>&1; then
      echo "MUTANT $1: SURVIVED (verify passed) -- verify script is too weak"; fails=1
    else echo "MUTANT $1: killed ($(grep -m1 '^FAIL' "$d/out"))"; fi
  }
  mutant always-green    check-schemas.mjs 's/^if (differ.length) {/if (false) {/'
  mutant first-only      check-schemas.mjs 's/differ.push(/if (!differ.length) differ.push(/'
  mutant missing-is-ok   check-schemas.mjs 's/^if (missing.length) {/if (false) {/'
  mutant empty-list-ok   check-schemas.mjs 's/^if (compared === 0) {/if (false) {/'
  mutant no-count        check-schemas.mjs 's/compared=\${compared} differ=0/ok/'
  mutant sync-subset     sync-schemas.mjs 's/for (const f of FILES) fs.copyFileSync/for (const f of FILES.slice(0,2)) fs.copyFileSync/'
  mutant sync-partial    sync-schemas.mjs 's/^if (absent.length) {/if (false) {/'
  [ $fails = 0 ] && { echo "MUTATION: all mutants killed"; exit 0; } || { echo "MUTATION: FAILED"; exit 1; }
fi

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail=0
ok()   { echo "ok   $*"; }
bad()  { echo "FAIL $*"; fail=1; }
expect_exit() { # label, want, got
  [ "$3" = "$2" ] && ok "$1 (exit $3)" || bad "$1: want exit $2, got $3"; }
full() { git -C "$REG_REPO" show "$REG_SHA:contracts/$1.schema.json" | sha256sum | cut -d' ' -f1; }

# ---- pinned registry input
mkdir -p "$T/reg/contracts"
for n in $NAMES; do git -C "$REG_REPO" show "$REG_SHA:contracts/$n.schema.json" > "$T/reg/contracts/$n.schema.json" \
  || { echo "FAIL cannot read registry $REG_SHA (REGISTRY_REPO=$REG_REPO)"; exit 1; }; done
echo "registry $REG_SHA digests: $(for n in $NAMES; do echo -n "$n=$(full $n | cut -c1-16) "; done)"

# fresh work tree: scripts under test + a schemas dir we can damage
mk() { rm -rf "$1"; mkdir -p "$1/scripts" "$1/schemas"; cp "$SCRIPTS/check-schemas.mjs" "$SCRIPTS/sync-schemas.mjs" "$1/scripts/"; }
run() { node "$1/scripts/$2" "${@:3}"; }

# ---- criterion 2: red on the pre-fix tree, pinned input
P="$T/prefix"; mk "$P"
for n in $NAMES; do git -C "$ROOT" show "$PRE_FIX:schemas/$n.schema.json" > "$P/schemas/$n.schema.json"; done
out="$(run "$P" check-schemas.mjs "$T/reg" 2>&1)"; rc=$?
expect_exit "AC2 pre-fix tree ($PRE_FIX) is red" 1 $rc
echo "$out" | grep -q 'DIFFERS page.schema.json' && echo "$out" | grep -q 'DIFFERS manifest.schema.json' \
  && ! echo "$out" | grep -q 'entry.schema.json' && ok "AC2 names page+manifest, not entry" || bad "AC2 naming wrong: $out"

# ---- criterion 3: sync then green; sync refuses a partial registry
S="$T/synced"; mk "$S"; cp "$P"/schemas/* "$S/schemas/"
run "$S" sync-schemas.mjs "$T/reg" >/dev/null; expect_exit "AC3 sync" 0 $?
out="$(run "$S" check-schemas.mjs "$T/reg" 2>&1)"; expect_exit "AC3 check after sync" 0 $?
echo "$out" | grep -qx 'compared=3 differ=0' && ok "AC5 prints compared=3" || bad "AC5 no 'compared=3 differ=0' line: $out"
for n in $NAMES; do
  [ "$(sha256sum < "$S/schemas/$n.schema.json" | cut -d' ' -f1)" = "$(full $n)" ] && ok "AC3 synced $n equals registry (full sha256)" || bad "AC3 synced $n differs"
  [ "$(sha256sum < "$ROOT/schemas/$n.schema.json" | cut -d' ' -f1)" = "$(full $n)" ] && ok "AC3 committed $n equals registry @ $REG_SHA" || bad "AC3 committed $n differs from registry @ $REG_SHA"
done
Q="$T/partial"; cp -r "$T/reg" "$Q"; rm "$Q/contracts/manifest.schema.json"
X="$T/syncpartial"; mk "$X"; cp "$P"/schemas/* "$X/schemas/"
run "$X" sync-schemas.mjs "$Q" >/dev/null 2>&1; expect_exit "AC3 sync with registry lacking a file" 2 $?
cmp -s "$X/schemas/page.schema.json" "$P/schemas/page.schema.json" && ok "AC3 partial sync copied nothing" || bad "AC3 partial sync copied a subset"
run "$X" sync-schemas.mjs >/dev/null 2>&1; expect_exit "AC3 sync, no argument" 2 $?

# ---- criterion 4: mutation of the site copies
for n in $NAMES; do
  M="$T/mut-$n"; mk "$M"; cp "$S"/schemas/* "$M/schemas/"
  node -e 'const fs=require("fs");const p=process.argv[1];const b=fs.readFileSync(p);b[10]^=1;fs.writeFileSync(p,b)' "$M/schemas/$n.schema.json"
  out="$(run "$M" check-schemas.mjs "$T/reg" 2>&1)"; rc=$?
  expect_exit "AC4 one byte flipped in $n" 1 $rc
  [ "$(echo "$out" | grep -c 'DIFFERS')" = 1 ] && echo "$out" | grep -q "DIFFERS $n.schema.json" && ok "AC4 names exactly $n" || bad "AC4 naming for $n: $out"
done
M="$T/mut-all"; mk "$M"; cp "$S"/schemas/* "$M/schemas/"
for n in $NAMES; do node -e 'const fs=require("fs");const p=process.argv[1];const b=fs.readFileSync(p);b[10]^=1;fs.writeFileSync(p,b)' "$M/schemas/$n.schema.json"; done
out="$(run "$M" check-schemas.mjs "$T/reg" 2>&1)"; [ "$(echo "$out" | grep -c DIFFERS)" = 3 ] && ok "AC1 all three differing files named" || bad "AC1 not all named: $out"
M="$T/mut-del"; mk "$M"; cp "$S"/schemas/* "$M/schemas/"; rm "$M/schemas/page.schema.json"
run "$M" check-schemas.mjs "$T/reg" >/dev/null 2>&1; expect_exit "AC4 deleted site copy" 2 $?
mkdir "$T/empty"; run "$S" check-schemas.mjs "$T/empty" >/dev/null 2>&1; expect_exit "AC4 empty registry dir" 2 $?
mkdir -p "$T/empty/contracts"; run "$S" check-schemas.mjs "$T/empty" >/dev/null 2>&1; expect_exit "AC4 empty contracts/ dir" 2 $?
run "$S" check-schemas.mjs "$T/nonexistent" >/dev/null 2>&1; expect_exit "AC1 missing directory" 2 $?
run "$S" check-schemas.mjs >/dev/null 2>&1; expect_exit "AC1 no argument" 2 $?

# ---- criterion 5: emptied file list must fail
E="$T/emptylist"; mk "$E"; cp "$S"/schemas/* "$E/schemas/"
sed -i 's/^const FILES = .*/const FILES = [];/' "$E/scripts/check-schemas.mjs"
grep -q '^const FILES = \[\];' "$E/scripts/check-schemas.mjs" || bad "AC5 could not build the emptied variant"
run "$E" check-schemas.mjs "$T/reg" >/dev/null 2>&1; rc=$?
[ $rc != 0 ] && ok "AC5 emptied-list variant fails (exit $rc)" || bad "AC5 emptied-list variant passed"

# ---- criterion 6: the suite
if [ -n "${VERIFY_SKIP_NPM:-}" ]; then echo "skip AC6 (VERIFY_SKIP_NPM)"
else
  (cd "$ROOT" && { [ -d node_modules ] || npm ci --no-audit --no-fund >/dev/null 2>&1; } && npm test >"$T/npm.log" 2>&1); rc=$?
  expect_exit "AC6 npm test" 0 $rc; [ $rc = 0 ] || tail -20 "$T/npm.log"
fi

# ---- criterion 7: workflows (non-comment lines only; greps fail on zero matches)
for w in deploy schema-sync; do
  f="$ROOT/.github/workflows/$w.yml"
  nc="$(grep -v '^[[:space:]]*#' "$f")"
  echo "$nc" | grep -q 'repository: worldofmodcraft/registry' && ok "AC7 $w checks out the registry" || bad "AC7 $w: no registry checkout"
  echo "$nc" | grep -q 'node scripts/check-schemas.mjs registry-checkout' && ok "AC7 $w runs the check" || bad "AC7 $w: no check step"
  ! echo "$nc" | grep -Eq '^[[:space:]]*ref:' && ok "AC7 $w pins no ref" || bad "AC7 $w pins a ref"
done
grep -n 'Set up Node\|check-schemas\|npm run build' "$ROOT/.github/workflows/deploy.yml" | awk -F: '/check-schemas/{c=$1} /npm run build/{b=$1} END{exit !(c && b && c<b)}' \
  && ok "AC7 deploy: check precedes build" || bad "AC7 deploy: check not before build"

# ---- criterion 9
for w in sync-schemas check-schemas; do grep -q "$w" "$ROOT/schemas/README.md" && ok "AC9 README mentions $w" || bad "AC9 README lacks $w"; done

[ $fail = 0 ] && { echo "VERIFY: PASS"; exit 0; } || { echo "VERIFY: FAIL"; exit 1; }
