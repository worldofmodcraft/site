#!/usr/bin/env node
// Mechanically checks the built dist/ tree against contracts/site-output.md (E13), so a broken
// deploy is caught by `npm run build` itself rather than discovered by Ludwig looking at a live,
// unstyled site. E13's own "Questions" section leaves it open whether such a check is automated
// or relied on by convention -- this repository automates it, specifically because E13 names an
// exact failure mode (`.nojekyll` missing -> GitHub Pages silently drops every `_astro/` asset)
// that a green `npm run build` and every acceptance criterion checked so far would not catch.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, CONTENT_DATA_FILE } from "../src/lib/config.mjs";

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
const leakNeedles = [REPO_ROOT, "/home/", "C:\\Users"];
function walkHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(p);
    else if (entry.name.endsWith(".html")) {
      const html = fs.readFileSync(p, "utf8");
      for (const needle of leakNeedles) {
        if (html.includes(needle)) {
          fail(`${p} contains what looks like a local filesystem path ("${needle}") -- E13's "no environment-specific values" rule.`);
        }
      }
    }
  }
}
if (fs.existsSync(distDir)) walkHtml(distDir);
if (failures === 0) ok("no local filesystem paths found in served HTML");

console.log("");
if (failures > 0) {
  console.error(`${failures} dist/ check(s) FAILED against contracts/site-output.md (E13).`);
  process.exit(1);
}
console.log("dist/ satisfies every check this repository runs against contracts/site-output.md (E13).");
