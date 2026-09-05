// Shared read/write for Pagefind's `.pf_fragment` file format, used by both
// scripts/normalize-pagefind-urls.mjs (fix round 1, F2 -- writes) and scripts/verify-dist.mjs
// (reads, to assert the fix doesn't regress). One implementation, reused, rather than two
// subtly-different ones parsing the same on-disk format.
//
// A fragment file's real shape (inspected directly with `gunzip` + `xxd`/`file` during fix round
// 1, not assumed): gzip-compressed bytes whose decompressed content is the literal 12-byte ASCII
// magic "pagefind_dcd" immediately followed by a compact JSON object
// (`{"url":...,"content":...,"word_count":...,"filters":...,"meta":...,"anchors":...}`) with
// nothing after it -- no trailing bytes, no padding.
import zlib from "node:zlib";

export const PAGEFIND_FRAGMENT_MAGIC = "pagefind_dcd";

/** @param {Buffer} compressed raw bytes of a `.pf_fragment` file @returns {object} the parsed fragment */
export function decodeFragment(compressed) {
  const decompressed = zlib.gunzipSync(compressed);
  const magic = decompressed.subarray(0, PAGEFIND_FRAGMENT_MAGIC.length).toString("utf8");
  if (magic !== PAGEFIND_FRAGMENT_MAGIC) {
    throw new Error(
      `expected the "${PAGEFIND_FRAGMENT_MAGIC}" magic prefix this module was written against, ` +
        `found "${magic}" -- Pagefind's fragment format has changed; this needs re-checking ` +
        `against the new format before it can safely read or rewrite anything.`,
    );
  }
  return JSON.parse(decompressed.subarray(PAGEFIND_FRAGMENT_MAGIC.length).toString("utf8"));
}

/** @param {object} fragment @returns {Buffer} gzip-compressed bytes ready to write back to a `.pf_fragment` file */
export function encodeFragment(fragment) {
  const decompressed = Buffer.concat([
    Buffer.from(PAGEFIND_FRAGMENT_MAGIC, "utf8"),
    Buffer.from(JSON.stringify(fragment), "utf8"),
  ]);
  return zlib.gzipSync(decompressed, { level: zlib.constants.Z_BEST_COMPRESSION });
}
