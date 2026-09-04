#!/usr/bin/env node
// Standalone security self-test for src/lib/archive.mjs, demonstrating (not merely asserting)
// that it enforces contracts/archive-layout.md's path-escape rule, per that document's own
// "Attack attempt against this rule, recorded as required by acceptance criterion 3" section.
// Not part of `npm run build` (it crafts throwaway malicious tarballs with a real path-traversal
// entry -- exercising the defence, not something a normal build needs to do every run). Run with
// `node scripts/self-test-archive-safety.mjs`; exits non-zero and prints why on any failure.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { extractArchive, MalformedArchiveError } from "../src/lib/archive.mjs";

const work = fs.mkdtempSync(path.join(os.tmpdir(), "wom-archive-safety-test-"));
let failures = 0;

function check(label, fn) {
  try {
    fn();
    console.log(`PASS  ${label}`);
  } catch (err) {
    failures++;
    console.error(`FAIL  ${label}\n      ${err.message}`);
  }
}

// ---- Attack 1: contracts/archive-layout.md's own recorded example -- a traversal entry the ----
// ---- manifest never mentions, encountered only during a blind full-archive extraction.      ----
{
  const stage = path.join(work, "attack1", "campfire-tales-1.2.0");
  fs.mkdirSync(path.join(stage, "assets", "screenshots"), { recursive: true });
  fs.writeFileSync(path.join(stage, "README.md"), "hello");
  // The hostile entry: an out-of-tree write disguised inside a subdirectory tar entry NAME. GNU
  // tar refuses to CREATE an archive containing a literal ".." path component by default (exactly
  // the safety this test wants to bypass to prove the READER's defence, not the archiver's), so
  // this uses --transform to rewrite an innocent entry's name to the hostile one inside the
  // archive after tar has already read it from disk -- producing a real tar stream with the
  // hostile entry name, the same shape a hand-crafted or non-GNU-tar-made hostile archive would
  // have, without this test needing to hand-roll tar's binary header format.
  fs.writeFileSync(path.join(stage, "assets", "screenshots", "escape.png"), "not a real png");
  const tarballPath = path.join(work, "attack1.tar.gz");
  execFileSync("tar", [
    "-czf", tarballPath,
    "--transform", "s#campfire-tales-1.2.0/assets/screenshots/escape.png#campfire-tales-1.2.0/assets/screenshots/../../../../../../tmp/wom-archive-safety-pwned#",
    "-C", path.join(work, "attack1"),
    "campfire-tales-1.2.0",
  ]);

  const canary = "/tmp/wom-archive-safety-pwned";
  fs.rmSync(canary, { force: true });
  check("Attack 1 (traversal entry not declared by any manifest) is rejected", () => {
    let threw = false;
    try {
      extractArchive(tarballPath, { ns: "attack", name: "one", version: "1.2.0" });
    } catch (err) {
      threw = true;
      if (!(err instanceof MalformedArchiveError)) {
        throw new Error(`expected MalformedArchiveError, got ${err.constructor.name}: ${err.message}`);
      }
    }
    if (!threw) throw new Error("extractArchive did not throw at all -- the archive was accepted");
    if (fs.existsSync(canary)) {
      throw new Error(`the traversal entry WAS written outside the extraction root: ${canary}`);
    }
  });
}

// ---- Attack 2: a symlink entry whose target escapes the archive root. ----
{
  const stageDir = path.join(work, "attack2-stage");
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, "README.md"), "hello");
  const tarballPath = path.join(work, "attack2.tar.gz");
  // Build the tar by hand with GNU tar so the archive contains a real symlink entry (tar -h
  // would dereference it; omitting -h preserves it as a symlink entry, which is what a hostile
  // archive would ship).
  fs.mkdirSync(path.join(work, "attack2", "lantern-quests-1.0.0"), { recursive: true });
  fs.cpSync(stageDir, path.join(work, "attack2", "lantern-quests-1.0.0"), { recursive: true });
  fs.symlinkSync("../../../../../../etc/passwd", path.join(work, "attack2", "lantern-quests-1.0.0", "evil-link"));
  execFileSync("tar", ["-czf", tarballPath, "-C", path.join(work, "attack2"), "lantern-quests-1.0.0"]);

  check("Attack 2 (symlink entry targeting outside the archive root) is rejected", () => {
    let threw = false;
    try {
      extractArchive(tarballPath, { ns: "attack", name: "two", version: "1.0.0" });
    } catch (err) {
      threw = true;
      if (!(err instanceof MalformedArchiveError)) {
        throw new Error(`expected MalformedArchiveError, got ${err.constructor.name}: ${err.message}`);
      }
    }
    if (!threw) throw new Error("extractArchive did not throw at all -- the symlink archive was accepted");
  });
}

// ---- Attack 3: no wrapping root at all (files at the true tar top level). ----
{
  const stageDir = path.join(work, "attack3-stage");
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, "README.md"), "hello");
  const tarballPath = path.join(work, "attack3.tar.gz");
  execFileSync("tar", ["-czf", tarballPath, "-C", stageDir, "README.md"]);

  check("Archive with no top-level root directory is rejected", () => {
    let threw = false;
    try {
      extractArchive(tarballPath, { ns: "attack", name: "three", version: "1.0.0" });
    } catch (err) {
      threw = true;
      if (!(err instanceof MalformedArchiveError)) {
        throw new Error(`expected MalformedArchiveError, got ${err.constructor.name}: ${err.message}`);
      }
    }
    if (!threw) throw new Error("extractArchive did not throw -- a rootless archive was accepted");
  });
}

// ---- Control: a genuinely well-formed archive (same shape as the real fixtures) still works. ----
{
  const stageDir = path.join(work, "control", "good-mod-1.0.0");
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, "README.md"), "hello, this is fine");
  const tarballPath = path.join(work, "control.tar.gz");
  execFileSync("tar", ["-czf", tarballPath, "-C", path.join(work, "control"), "good-mod-1.0.0"]);

  check("A well-formed single-root archive still extracts successfully (no false positive)", () => {
    const dir = extractArchive(tarballPath, { ns: "control", name: "good", version: "1.0.0" });
    const content = fs.readFileSync(path.join(dir, "README.md"), "utf8");
    if (content !== "hello, this is fine") throw new Error(`unexpected README content: ${content}`);
  });
}

fs.rmSync(work, { recursive: true, force: true });
fs.rmSync("/tmp/wom-archive-safety-pwned", { force: true });

if (failures > 0) {
  console.error(`\n${failures} archive-safety check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll archive-safety checks passed.");
