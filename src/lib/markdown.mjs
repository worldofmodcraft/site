// Renders an archived README.md to sanitised HTML.
//
// Security note: a README comes from a third-party author's repository (archived, but still
// third-party content -- ADR-0059 SS1 only changes WHERE it is read from, not WHO wrote it).
// markdown-it defaults to `html: false`, which ESCAPES raw HTML in the source as literal text
// instead of passing it through -- this is the whole reason markdown-it was chosen over a
// permissive-by-default renderer (ADR-0103: boring, predictable; the safe behaviour is the
// default, not an option someone has to remember to pass).
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false, // never pass through raw HTML from an author's README
  linkify: true,
  breaks: false,
});

/** @param {string} source raw README.md content @returns {string} sanitised HTML */
export function renderReadme(source) {
  return md.render(source);
}
