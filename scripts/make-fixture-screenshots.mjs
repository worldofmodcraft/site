#!/usr/bin/env node
// Generates every fixture "screenshot" PNG referenced by the fixture manifests/page.json files,
// as pure original generative art (src/lib/png.mjs) -- no downloaded, copied or AI-generated
// images, no Blizzard-derived shapes or palettes (ADR-0004). Each is a simple abstract
// gradient-plus-shape composition distinguishable by name; see docs/build.md's "How fixture
// assets were produced" for the description of each one and why this counts as original work.
import fs from "node:fs";
import path from "node:path";
import { encodePng } from "../src/lib/png.mjs";

const W = 640;
const H = 360;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

/** Warm vertical gradient (deep ember to soft amber) with a simple radiating "flame" triangle. */
function paintCampfire(x, y, w, h) {
  const t = y / h;
  let [r, g, b] = [lerp(40, 200, t), lerp(16, 110, t), lerp(24, 40, t)];
  const cx = w / 2;
  const flameHalfWidth = lerp(60, 4, y / h) * (1 - Math.abs((x - cx) / (w * 0.5)));
  if (y > h * 0.25 && Math.abs(x - cx) < flameHalfWidth) {
    const glow = clamp01(1 - y / h);
    r = lerp(r, 255, glow);
    g = lerp(g, 200, glow * 0.8);
    b = lerp(b, 80, glow * 0.3);
  }
  return [r | 0, g | 0, b | 0];
}

/** Cool indigo gradient with a pale open-book silhouette (two trapezoids meeting at a spine). */
function paintTales(x, y, w, h) {
  const t = y / h;
  let [r, g, b] = [lerp(18, 30, t), lerp(14, 24, t), lerp(48, 90, t)];
  const cx = w / 2;
  const bookY0 = h * 0.55;
  const bookY1 = h * 0.85;
  if (y > bookY0 && y < bookY1) {
    const pageT = (y - bookY0) / (bookY1 - bookY0);
    const halfWidth = lerp(w * 0.05, w * 0.32, pageT);
    if (Math.abs(x - cx) < halfWidth && Math.abs(x - cx) > 2) {
      r = 235;
      g = 225;
      b = 205;
    }
    if (Math.abs(x - cx) <= 2) {
      r = 90;
      g = 70;
      b = 40;
    }
  }
  return [r | 0, g | 0, b | 0];
}

/** Soft radial amber glow, no shapes -- stands in for a lit lantern post at dusk. */
function paintLanternGlow(x, y, w, h) {
  const dx = x - w * 0.5;
  const dy = y - h * 0.4;
  const dist = Math.sqrt(dx * dx + dy * dy) / (Math.max(w, h) * 0.5);
  const glow = clamp01(1 - dist);
  const r = lerp(20, 255, glow);
  const g = lerp(18, 190, glow);
  const b = lerp(30, 90, glow * 0.6);
  return [r | 0, g | 0, b | 0];
}

/** Dark stone gradient with a pale rounded-arch tunnel mouth. */
function paintMineTunnel(x, y, w, h) {
  const t = y / h;
  let [r, g, b] = [lerp(28, 12, t), lerp(26, 12, t), lerp(30, 16, t)];
  const cx = w / 2;
  const archTop = h * 0.3;
  const archHalfWidth = w * 0.22;
  const inArch =
    y > archTop &&
    Math.abs(x - cx) < archHalfWidth &&
    (y > archTop + archHalfWidth
      ? true
      : (x - cx) * (x - cx) + (archTop + archHalfWidth - y) * (archTop + archHalfWidth - y) <
        archHalfWidth * archHalfWidth);
  if (inArch) {
    const depthT = clamp01((y - archTop) / (h - archTop));
    r = lerp(70, 5, depthT);
    g = lerp(60, 5, depthT);
    b = lerp(50, 8, depthT);
  }
  return [r | 0, g | 0, b | 0];
}

/** Small warm radial glow on a near-black ground -- a hand lantern rather than a post. */
function paintLantern(x, y, w, h) {
  const dx = x - w * 0.42;
  const dy = y - h * 0.6;
  const dist = Math.sqrt(dx * dx + dy * dy) / (Math.min(w, h) * 0.35);
  const glow = clamp01(1 - dist);
  const r = lerp(8, 250, glow * glow);
  const g = lerp(8, 170, glow * glow);
  const b = lerp(14, 60, glow * glow * 0.5);
  return [r | 0, g | 0, b | 0];
}

const targets = [
  { file: "fixtures/archives-src/fixture/campfire-tales/1.0.0/assets/screenshots/campfire.png", paint: paintCampfire },
  { file: "fixtures/archives-src/fixture/campfire-tales/1.2.0/assets/screenshots/campfire.png", paint: paintCampfire },
  { file: "fixtures/archives-src/fixture/campfire-tales/1.2.0/assets/screenshots/tales.png", paint: paintTales },
  {
    file: "fixtures/archives-src/fixture/campfire-tales/1.2.0/assets/screenshots/lantern-glow.png",
    paint: paintLanternGlow,
  },
  {
    file: "fixtures/archives-src/fixture/lantern-quests/1.0.0/assets/screenshots/mine-tunnel.png",
    paint: paintMineTunnel,
  },
  { file: "fixtures/archives-src/fixture/lantern-quests/1.0.0/assets/screenshots/lantern.png", paint: paintLantern },
];

for (const { file, paint } of targets) {
  const png = encodePng(W, H, paint);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
