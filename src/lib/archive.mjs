// Resolves a registry version's `source_archive` URL to a local tarball, and extracts it.
//
// RECONCILED against contracts/archive-layout.md (E11), read from
// worldofmodcraft/registry's task/025-boundary-contracts branch during this task -- see
// docs/build.md's "Assumptions bound to task 025" table for which of this file's earlier
// assumptions that contract confirmed and which it overrode. In short, it overrode two things
// this file used to do: (1) it extracted straight into a destination directory as if the tarball
// had no wrapping root, when E11 requires exactly one top-level directory whose name is
// determined by inspection, never guessed; (2) it had no defence against a hostile tar entry
// (path traversal via "..", an absolute path, or a symlink escaping the root) except whatever
// node-tar does by default. E11 requires that check to run over EVERY entry during extraction,
// not only manifest/page-declared ones, and requires rejecting the WHOLE archive (not just the
// bad entry) when it fires. Both are implemented below.
//
// Local-staging assumption (src/lib/config.mjs's ARCHIVE_DIR doc, NOT covered by E11, which
// starts from "the reader already has the bytes"): `source_archive`'s URL PATH, resolved under
// ARCHIVE_DIR, is where this build expects the tarball file itself to already be staged. This
// build never fetches the URL.
import path from "node:path";
import fs from "node:fs";
import * as tar from "tar";
import { ARCHIVE_DIR, CACHE_DIR } from "./config.mjs";

/**
 * Thrown for anything contracts/archive-layout.md calls "malformed": not a valid gzip/tar stream,
 * no single consistent top-level root, or any entry (including a symlink target) that escapes
 * that root. Callers must degrade (no README/screenshots for that version) rather than crash the
 * whole build -- see scripts/prepare-content.mjs.
 */
export class MalformedArchiveError extends Error {}

/**
 * @param {string} sourceArchiveUrl full URL from a version object's `source_archive` field
 * @returns {string} absolute local path where this build expects the tarball to be staged
 */
export function localArchivePathFor(sourceArchiveUrl) {
  const url = new URL(sourceArchiveUrl);
  const relativePath = url.pathname.replace(/^\/+/, "");
  return path.join(ARCHIVE_DIR, relativePath);
}

/** True if any path segment is exactly ".." -- rejects a traversal wherever it appears, not only at the start. */
function hasParentSegment(segments) {
  return segments.some((s) => s === "..");
}

/**
 * Lists every entry in a tar(.gz) file without extracting anything, so the whole archive can be
 * validated before a single byte is written to disk.
 * @returns {{path: string, type: string, linkpath: string|undefined}[]}
 */
function listEntries(tarballPath) {
  const entries = [];
  tar.list({
    file: tarballPath,
    sync: true,
    onentry: (entry) => {
      entries.push({ path: entry.path, type: entry.type, linkpath: entry.linkpath });
    },
  });
  return entries;
}

/**
 * Validates every entry against contracts/archive-layout.md's root convention and path-escape
 * rule, and returns the (inspected, never guessed) root directory name.
 * @throws {MalformedArchiveError}
 */
function validateAndDetermineRoot(entries, identity) {
  if (entries.length === 0) {
    throw new MalformedArchiveError(`${identity}: archive has no entries.`);
  }
  let root;
  for (const entry of entries) {
    if (entry.path.startsWith("/")) {
      throw new MalformedArchiveError(`${identity}: entry "${entry.path}" is an absolute path.`);
    }
    const segments = entry.path.split("/").filter(Boolean);
    if (segments.length === 0) {
      throw new MalformedArchiveError(`${identity}: entry with an empty name.`);
    }
    if (segments.length === 1 && entry.type !== "Directory") {
      // A file sitting at the true tar top level -- no wrapping root at all.
      throw new MalformedArchiveError(
        `${identity}: entry "${entry.path}" has no top-level root directory (E11 requires exactly one).`,
      );
    }
    const [firstSegment, ...rest] = segments;
    if (root === undefined) {
      root = firstSegment;
    } else if (root !== firstSegment) {
      throw new MalformedArchiveError(
        `${identity}: multiple top-level roots ("${root}" and "${firstSegment}") -- E11 requires exactly one.`,
      );
    }
    if (hasParentSegment(rest)) {
      throw new MalformedArchiveError(`${identity}: entry "${entry.path}" escapes the archive root via "..".`);
    }
    if (entry.type === "SymbolicLink" || entry.type === "Link") {
      const target = entry.linkpath ?? "";
      // Conservative on purpose (E11: "must inspect symlink targets under the same two rules,
      // not only literal path strings"): reject ANY absolute target or any target containing a
      // ".." segment, rather than resolving it relative to the link's own directory first. This
      // fixture build has no legitimate use for symlinks inside an archive, so being stricter
      // than the minimum necessary never costs anything real (ADR-0103).
      const targetSegments = target.split("/").filter(Boolean);
      if (target.startsWith("/") || hasParentSegment(targetSegments)) {
        throw new MalformedArchiveError(
          `${identity}: link entry "${entry.path}" targets "${target}", which escapes the archive root.`,
        );
      }
    }
  }
  return root;
}

/**
 * Extracts a tarball into a deterministic cache directory keyed by namespace/name/version,
 * enforcing contracts/archive-layout.md's root convention and path-escape rule over every entry
 * first. Idempotent: re-extracts every run rather than trusting a stale cache (MANAGER.md SS5,
 * "catch-and-ignore" -- a stale extraction masking a fixture edit would be exactly that).
 *
 * @param {string} tarballPath
 * @param {{ns: string, name: string, version: string}} id
 * @returns {string} absolute path to the extracted directory (root-stripped: files sit directly
 *   under this path, e.g. `${result}/README.md`, regardless of the archive's own root name)
 * @throws {MalformedArchiveError} if the archive fails E11's validation -- caller must degrade
 */
export function extractArchive(tarballPath, { ns, name, version }) {
  if (!fs.existsSync(tarballPath)) {
    throw new Error(
      `Archived source tarball not found at ${tarballPath} (declared by ${ns}:${name}@${version}'s ` +
        `source_archive). This build never fetches it from the network -- stage the file locally ` +
        `or fix ARCHIVE_DIR. See src/lib/config.mjs.`,
    );
  }

  const identity = `${ns}:${name}@${version} (${tarballPath})`;
  let entries;
  try {
    entries = listEntries(tarballPath);
  } catch (err) {
    throw new MalformedArchiveError(`${identity}: not a valid gzip/tar stream (${err.message}).`);
  }
  // Throws MalformedArchiveError on any violation -- validated fully before extracting anything,
  // so a hostile entry can never cause a partial extraction (E11: reject the WHOLE archive).
  validateAndDetermineRoot(entries, identity);

  const destDir = path.join(CACHE_DIR, ns, name, version);
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  // strip: 1 drops the inspected (never hard-coded) root's single path component, so callers can
  // address files as `${destDir}/README.md` regardless of what the archive named its root.
  tar.extract({ file: tarballPath, cwd: destDir, strip: 1, sync: true });
  return destDir;
}
