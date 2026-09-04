// Minimal semver comparator -- just enough to pick "the highest published version" for the
// current mod page (ADR-0059 SS2's "current README"/current screenshots -- see docs/build.md
// "Assumptions bound to task 025" for why that phrase resolves to a specific version at all).
//
// Deliberately not a dependency: entry.schema.json already enforces the semver GRAMMAR at data
// entry time (registry CI's job, not ours), so this module only orders strings that are already
// known-valid semver. ADR-0103: boring solution, no external package for a five-line comparison.

/** @param {string} v */
function parse(v) {
  const [core, pre = ""] = v.split("-", 2);
  const [major, minor, patch] = core.split(".").map(Number);
  return { major, minor, patch, pre };
}

/** Returns <0 if a<b, 0 if equal precedence, >0 if a>b (semver.org precedence rules SS11). */
export function compareSemver(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  // No prerelease outranks any prerelease (1.0.0 > 1.0.0-rc.1).
  if (pa.pre === "" && pb.pre !== "") return 1;
  if (pa.pre !== "" && pb.pre === "") return -1;
  if (pa.pre === pb.pre) return 0;
  return pa.pre < pb.pre ? -1 : 1;
}

/** Highest-precedence version among `published` entries, or undefined if there are none. */
export function highestPublished(versions) {
  const published = versions.filter((v) => v.status === "published");
  if (published.length === 0) return undefined;
  return published.reduce((best, v) => (compareSemver(v.version, best.version) > 0 ? v : best));
}
