import { defineConfig } from "astro/config";

// 100% static output (mission SS2, ADR-0059 SS5: no server-side or dynamic component). `site` is
// required for correctly-absolute URLs (used by a couple of <link> tags) once deployed to the
// apex domain via CNAME (see public/CNAME, copied verbatim into dist/ -- E13, docs/build.md).
export default defineConfig({
  site: "https://worldofmodcraft.com",
  trailingSlash: "ignore",
  build: {
    format: "directory",
  },
});
