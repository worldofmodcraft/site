#!/usr/bin/env bash
# Task 009 -- verification artefact (MANAGER.md SS2c: "verification is a runnable artefact").
#
# Runs the mechanical acceptance criteria for the site build end to end, from a fresh checkout:
#   1. Fixtures validate against the vendored registry schemas.
#   2. src/lib/archive.mjs's path-escape/root-convention defence (E11) self-test passes.
#   3. A clean `npm run build` succeeds against the repository's own fixtures, no network access
#      beyond what npm already installed.
#   4. The built dist/ tree passes scripts/verify-dist.mjs (E13/E14, including fix round 1's new
#      checks: trailing-slash-free URLs in both HTML hrefs and Pagefind fragments, and every
#      generated screenshot being a real image by magic bytes).
#   5. Fix round 1, finding F1's regression check: a schema-valid page.json whose screenshot path
#      escapes the archive root (`../../../../etc/passwd`) must be REJECTED, and must never appear
#      anywhere in the published dist/ tree.
#
# This script is self-contained: it does not assume anything about a prior session's state beyond
# a git checkout of this repository. It installs dependencies if node_modules is missing, uses
# only paths relative to its own location (never a hard-coded path from any one contributor's
# machine), and cleans up every scratch file/dir it creates, on both success and failure.
#
# Usage: docs/tasks/009-verify.sh   (run from anywhere -- it cd's to the repository root itself)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

PASS=$'\033[32mPASS\033[0m'
FAIL=$'\033[31mFAIL\033[0m'
STEP=$'\033[36mSTEP\033[0m'
failures=0

step() { echo; echo "$STEP $1"; }
pass() { echo "$PASS  $1"; }
fail() { echo "$FAIL  $1"; failures=$((failures + 1)); }

SCRATCH="$(mktemp -d)"
cleanup() {
  rm -rf "$SCRATCH"
}
trap cleanup EXIT

step "0. Dependencies"
if [ ! -d node_modules ]; then
  echo "node_modules missing -- running 'npm ci' (fresh clone path)."
  npm ci
else
  echo "node_modules present, skipping install."
fi

step "1. Fixtures validate against the vendored registry schemas (npm run validate-fixtures)"
if npm run validate-fixtures; then
  pass "fixtures validate"
else
  fail "fixture validation failed"
fi

step "2. Archive path-escape / root-convention self-test (npm run test:archive-safety, E11)"
if npm run test:archive-safety; then
  pass "archive-safety self-test passed"
else
  fail "archive-safety self-test failed"
fi

step "3. Clean build from fixtures alone (npm run build)"
rm -rf dist .cache public/_generated
if npm run build; then
  pass "npm run build succeeded (chains prepare-content, astro build, index-search, normalize-pagefind-urls, verify-dist -- E13/E14 checked as part of this)"
else
  fail "npm run build failed"
fi

echo
echo "Generated routes (find dist -name index.html):"
find dist -name index.html 2>/dev/null | sort || true

step "4. Regression check for fix round 1, finding F1 (arbitrary local file read via a schema-valid page.json screenshot path)"
# Isolated from the real fixtures entirely: a scratch registry + archive, built from a COPY of one
# real fixture mod, with its page.json's screenshots[] mutated to include a traversal path. Schema
# validity matters here: page.schema.json's pattern (^(?!/)(?!.*://)(?!.*\\).+$) forbids a leading
# "/", a URL scheme, and a backslash -- but NOT a ".." segment, so this is a legitimately
# schema-valid document, exactly as an attacker's accepted page.json PR would be (ADR-0059 SS3:
# page.json publishes immediately on a lighter gate than entry.json).
#
# The traversal count uses the CLAMPING form ('../' repeated well past the filesystem root, per
# the escalation note that produced this check) rather than a count-exact payload: path.join
# clamps excess ".." segments at the root instead of erroring, so this is the reliable form of the
# attack. A count-exact payload risks landing one directory short, which would degrade to a
# harmless "not found" warning and make this check pass for the wrong reason.
REGRESSION_DIR="$SCRATCH/f1-regression"
mkdir -p "$REGRESSION_DIR/registry/mods" "$REGRESSION_DIR/archives/fixture"
cp -r fixtures/registry/mods/fixture.lantern-quests "$REGRESSION_DIR/registry/mods/"
cp -r fixtures/archives/fixture/lantern-quests "$REGRESSION_DIR/archives/fixture/"

node -e '
const fs = require("fs");
const p = process.argv[1];
const doc = JSON.parse(fs.readFileSync(p, "utf8"));
doc.screenshots = ["assets/screenshots/mine-tunnel.png", "../".repeat(20) + "etc/passwd"];
fs.writeFileSync(p, JSON.stringify(doc, null, 2));
' "$REGRESSION_DIR/registry/mods/fixture.lantern-quests/page.json"

REGRESSION_LOG="$SCRATCH/f1-regression.log"
if REGISTRY_DIR="$REGRESSION_DIR/registry" ARCHIVE_DIR="$REGRESSION_DIR/archives" \
    SITE_CACHE_DIR="$SCRATCH/f1-regression-cache" \
    node scripts/prepare-content.mjs >"$REGRESSION_LOG" 2>&1; then
  echo "(prepare-content exited 0 against the hostile fixture, as expected -- E11 degrade, not fail)"
else
  cat "$REGRESSION_LOG"
  fail "prepare-content.mjs exited non-zero against the hostile fixture -- F1's fix must DEGRADE (log + omit), not crash the build"
fi

if grep -q 'rejected as unsafe' "$REGRESSION_LOG"; then
  pass "the traversal screenshot path was rejected as unsafe (F1 fix engaged)"
else
  fail "no 'rejected as unsafe' warning found -- the traversal path may have been silently accepted or silently dropped for the wrong reason"
  cat "$REGRESSION_LOG"
fi

# The decisive check: no byte-for-byte copy of a local file the mod never legitimately owned may
# exist anywhere this build writes publicly-served output, regardless of what name it landed under.
LEAK_FOUND=0
if [ -d public/_generated ]; then
  while IFS= read -r -d '' f; do
    if cmp -s "$f" /etc/passwd; then
      LEAK_FOUND=1
      echo "LEAKED: $f is byte-identical to /etc/passwd"
    fi
  done < <(find public/_generated -type f -print0)
fi
if [ "$LEAK_FOUND" -eq 0 ]; then
  pass "no file under public/_generated/ is a copy of /etc/passwd -- the traversal did not reach the published tree"
else
  fail "a local file was copied into the publicly-served tree via the traversal path -- F1 is NOT fixed"
fi

# Restore the repository to its normal, real, fixture-built state (this regression check
# necessarily overwrote .cache/site-content.json and public/_generated with the scratch mod's
# hostile-fixture run -- both are gitignored/derived, and step 3 already proved a real clean build
# from the repository's OWN fixtures succeeds, but leaving the tree in a real-fixture state rather
# than the scratch one avoids surprising whoever inspects the worktree right after this script).
step "5. Restoring a real, clean build (so the worktree is left in its normal built state)"
rm -rf dist .cache public/_generated
if npm run build >/dev/null; then
  pass "final restore build succeeded"
else
  fail "final restore build failed"
fi

echo
if [ "$failures" -gt 0 ]; then
  echo "$FAIL  $failures check(s) failed -- see above."
  exit 1
fi
echo "$PASS  All task 009 verification checks passed."
