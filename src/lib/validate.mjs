// Compiles the three vendored registry schemas (schemas/README.md explains why they're vendored)
// and exposes one validator per schema, shared by scripts/validate-fixtures.mjs (the standalone
// demonstration) and scripts/prepare-content.mjs (a defensive check at build time: a fixture or
// registry file that fails its schema is a hard build error, never a silently-skipped mod --
// MANAGER.md SS5 forbids catch-and-ignore).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// The vendored schemas declare "$schema": ".../draft/2020-12/schema" (schemas/*.schema.json).
// Plain `ajv` only ships the draft-07 meta-schema; Ajv2020 is the same engine with the
// 2020-12 meta-schema (and its vocabularies) preloaded -- required, not a style choice.
import Ajv2020 from "ajv/dist/2020.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.resolve(here, "../../schemas");

const ajv = new Ajv2020({ allErrors: true, strict: true });

function loadSchema(file) {
  return JSON.parse(fs.readFileSync(path.join(schemasDir, file), "utf8"));
}

export const validators = {
  entry: ajv.compile(loadSchema("entry.schema.json")),
  page: ajv.compile(loadSchema("page.schema.json")),
  manifest: ajv.compile(loadSchema("manifest.schema.json")),
};

/**
 * @param {"entry"|"page"|"manifest"} kind
 * @param {unknown} data
 * @param {string} context human-readable label for error messages (e.g. a file path)
 * @throws if `data` does not satisfy the named schema
 */
export function validateOrThrow(kind, data, context) {
  const validate = validators[kind];
  if (!validate(data)) {
    const details = validate.errors.map((e) => `  - ${e.instancePath || "(root)"} ${e.message}`).join("\n");
    throw new Error(`${context} failed ${kind}.schema.json validation:\n${details}`);
  }
}
