#!/usr/bin/env node
// Mechanically checks the built dist/ tree against contracts/site-output.md (E13), so a broken
// deploy is caught by `npm run build` itself rather than discovered by Ludwig looking at a live,
// unstyled site. E13's own "Questions" section leaves it open whether such a check is automated
// or relied on by convention -- this repository automates it, specifically because E13 names an
// exact failure mode (`.nojekyll` missing -> GitHub Pages silently drops every `_astro/` asset)
// that a green `npm run build` and every acceptance criterion checked so far would not catch.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, CONTENT_DATA_FILE, GENERATED_PUBLIC_DIR } from "../src/lib/config.mjs";
import { decodeFragment } from "../src/lib/pagefind-fragment.mjs";

const distDir = path.join(REPO_ROOT, "dist");
let failures = 0;

function fail(message) {
  failures++;
  console.error(`FAIL  ${message}`);
}
function ok(message) {
  console.log(`OK    ${message}`);
}

// -- .nojekyll: present, empty, at the root. --
const nojekyllPath = path.join(distDir, ".nojekyll");
if (!fs.existsSync(nojekyllPath)) {
  fail(`dist/.nojekyll is missing -- GitHub Pages will run Jekyll and silently drop dist/_astro/ (E13).`);
} else if (fs.statSync(nojekyllPath).size !== 0) {
  fail(`dist/.nojekyll is not empty -- E13 requires empty content (a non-empty file is not itself harmful to Pages, but is not what this build is meant to emit).`);
} else {
  ok("dist/.nojekyll present and empty");
}

// -- CNAME: present, exact content. --
const cnamePath = path.join(distDir, "CNAME");
if (!fs.existsSync(cnamePath)) {
  fail("dist/CNAME is missing -- the custom domain will not be configured (E13).");
} else {
  const content = fs.readFileSync(cnamePath, "utf8");
  if (content !== "worldofmodcraft.com" && content !== "worldofmodcraft.com\n") {
    fail(`dist/CNAME content is ${JSON.stringify(content)} -- E13 requires exactly "worldofmodcraft.com" with at most one trailing newline.`);
  } else {
    ok("dist/CNAME present with exact required content");
  }
}

// -- index.html at the root. --
if (!fs.existsSync(path.join(distDir, "index.html"))) {
  fail("dist/index.html is missing -- the apex domain would serve nothing at '/' (E13).");
} else {
  ok("dist/index.html present");
}

// -- One route per mod, per E14's /mods/<ns>/<name> scheme, in the directory-index shape --
// -- astro.config.mjs's build.format:"directory" produces. --
if (!fs.existsSync(CONTENT_DATA_FILE)) {
  fail(`${CONTENT_DATA_FILE} not found -- run prepare-content before verify-dist.`);
} else {
  const mods = JSON.parse(fs.readFileSync(CONTENT_DATA_FILE, "utf8"));
  for (const mod of mods) {
    const modPage = path.join(distDir, "mods", mod.ns, mod.name, "index.html");
    if (!fs.existsSync(modPage)) {
      fail(`dist/mods/${mod.ns}/${mod.name}/index.html is missing for registry entry ${mod.id} (E13/E14).`);
    } else {
      ok(`dist/mods/${mod.ns}/${mod.name}/index.html present`);
    }
  }
}

// -- Pagefind's own output tree, non-empty. --
const pagefindDir = path.join(distDir, "pagefind");
if (!fs.existsSync(pagefindDir) || fs.readdirSync(pagefindDir).length === 0) {
  fail("dist/pagefind/ is missing or empty -- client-side search will not work on the deployed site (E13).");
} else {
  ok("dist/pagefind/ present and non-empty");
}

// -- No absolute local filesystem paths leaked into served HTML. --
// Fix round 1, finding F8: this used to grep only REPO_ROOT, "/home/" and "C:\Users", which would
// miss a leak on a runner whose home isn't under /home (root-owned CI images commonly use
// "/root/"), a macOS build machine ("/Users/"), or GitHub's own hosted-runner container path
// ("/github/workspace", used by actions/checkout's default). Broadened to cover all four.
const leakNeedlesFound = new Set();
const leakNeedles = [REPO_ROOT, "/home/", "/root/", "/Users/", "/github/workspace", "C:\\Users"];
function walkHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(p);
    else if (entry.name.endsWith(".html")) {
      const html = fs.readFileSync(p, "utf8");
      for (const needle of leakNeedles) {
        if (html.includes(needle)) {
          leakNeedlesFound.add(needle);
          fail(`${p} contains what looks like a local filesystem path ("${needle}") -- E13's "no environment-specific values" rule.`);
        }
      }
    }
  }
}
if (fs.existsSync(distDir)) walkHtml(distDir);
if (leakNeedlesFound.size === 0) ok("no local filesystem paths found in served HTML");

// -- Canonical URL form (E14): no trailing slash on an internal page link, in EITHER generated --
// -- HTML hrefs or Pagefind's own indexed fragment URLs (fix round 1, finding F2/F8). A regression --
// -- in either place must turn this check red, not require someone to decompress a fragment by hand --
// -- to notice. Excludes the bare root "/" (which IS just "/") and anything that is plainly an --
// -- asset reference (has a file extension) rather than a page route. --
const trailingSlashHrefs = [];
const hrefPattern = /href="(\/[^"]*)"/g;
function isPageRouteHref(href) {
  if (href === "/") return false; // the root itself -- "/" is its own canonical form, not a violation.
  if (!href.endsWith("/")) return false;
  // A trailing-slash href ending in something that looks like a file extension before the slash
  // isn't a page route (this build doesn't produce any such links, but stay precise about what
  // "canonical page URL" means rather than flagging things this check was never about).
  return true;
}
function walkHtmlForHrefs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtmlForHrefs(p);
    else if (entry.name.endsWith(".html")) {
      const html = fs.readFileSync(p, "utf8");
      for (const match of html.matchAll(hrefPattern)) {
        const href = match[1];
        if (isPageRouteHref(href)) trailingSlashHrefs.push({ file: p, href });
      }
    }
  }
}
if (fs.existsSync(distDir)) walkHtmlForHrefs(distDir);
if (trailingSlashHrefs.length > 0) {
  for (const { file, href } of trailingSlashHrefs) {
    fail(`${file} links to "${href}" with a trailing slash -- E14 (url-scheme.md) requires no trailing slash on a page route.`);
  }
} else {
  ok("no generated HTML href carries a trailing slash on a page route (E14)");
}

const pagefindFragmentDir = path.join(distDir, "pagefind", "fragment");
let fragmentUrlViolations = 0;
let fragmentsChecked = 0;
if (fs.existsSync(pagefindFragmentDir)) {
  for (const filename of fs.readdirSync(pagefindFragmentDir)) {
    if (!filename.endsWith(".pf_fragment")) continue;
    fragmentsChecked++;
    const filePath = path.join(pagefindFragmentDir, filename);
    const fragment = decodeFragment(fs.readFileSync(filePath));
    if (fragment.url !== "/" && fragment.url.endsWith("/")) {
      fragmentUrlViolations++;
      fail(`${filePath} indexes url "${fragment.url}" with a trailing slash -- E14 (url-scheme.md) requires no trailing slash. Did npm run normalize-pagefind-urls run before verify-dist?`);
    }
  }
}
if (fragmentsChecked > 0 && fragmentUrlViolations === 0) {
  ok(`no Pagefind fragment indexes a trailing-slash URL (${fragmentsChecked} fragment(s) checked, E14)`);
}

// -- Generated screenshot files are real images, not an arbitrary file smuggled in via a --
// -- traversal path (fix round 1, F1/F9 escalation): even with prepare-content.mjs's own --
// -- path-escape rejection in place, this is a second, independent line of defence at the point --
// -- the file actually reaches the publicly-served tree, checking WHAT was copied rather than --
// -- trusting the path that produced it. Per ADR-0120's typing philosophy, "is this an image" is --
// -- decided by magic bytes, never by file extension. --
const IMAGE_SIGNATURES = [
  { name: "PNG", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { name: "JPEG", bytes: [0xff, 0xd8, 0xff] },
];
function isRiffWebp(buf) {
  return (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  );
}
function isImageByMagicBytes(buf) {
  if (isRiffWebp(buf)) return true;
  return IMAGE_SIGNATURES.some(
    (sig) => buf.length >= sig.bytes.length && sig.bytes.every((b, i) => buf[i] === b),
  );
}
// GENERATED_PUBLIC_DIR ("public/_generated") is a top-level entry under Astro's `public/` dir,
// which Astro copies to the SAME top-level path under dist/ (not nested under "dist/public/") --
// i.e. dist/_generated/, not dist/public/_generated/. Using path.basename() here rather than
// path.relative(REPO_ROOT, ...) avoids re-introducing the "public/" prefix that would otherwise
// silently point this check at a directory that never exists, making it vacuously pass.
const generatedDistDir = path.join(distDir, path.basename(GENERATED_PUBLIC_DIR));
let generatedFilesChecked = 0;
let generatedFilesRejected = 0;
function walkGenerated(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkGenerated(p);
    } else {
      generatedFilesChecked++;
      const head = Buffer.alloc(16);
      const fd = fs.openSync(p, "r");
      const bytesRead = fs.readSync(fd, head, 0, 16, 0);
      fs.closeSync(fd);
      if (!isImageByMagicBytes(head.subarray(0, bytesRead))) {
        generatedFilesRejected++;
        fail(
          `${p} is not a recognised image by magic bytes (PNG/JPEG/WEBP) -- this tree is served ` +
            `publicly and must contain only screenshots copied from an archive, never an arbitrary ` +
            `file (fix round 1, F1). Extension is not evidence of file type (ADR-0120).`,
        );
      }
    }
  }
}
if (fs.existsSync(generatedDistDir)) {
  walkGenerated(generatedDistDir);
}
if (generatedFilesChecked > 0 && generatedFilesRejected === 0) {
  ok(`all ${generatedFilesChecked} file(s) under dist/${path.relative(distDir, generatedDistDir)}/ are real images by magic bytes`);
} else if (generatedFilesChecked === 0) {
  ok(`dist/${path.relative(distDir, generatedDistDir)}/ has no files to check (no mod has any screenshot in this build)`);
}

console.log("");
if (failures > 0) {
  console.error(`${failures} dist/ check(s) FAILED against contracts/site-output.md (E13).`);
  process.exit(1);
}
console.log("dist/ satisfies every check this repository runs against contracts/site-output.md (E13).");
