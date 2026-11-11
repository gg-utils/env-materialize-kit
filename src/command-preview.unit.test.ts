/**
 * @fileoverview Verifies shell quoting and pasteable command-preview formatting for the
 * `@gg-utils/env-materialize-kit` command-preview helpers.
 *
 * This file owns regression coverage for `EnvMaterializeKit_shellQuote` and
 * `EnvMaterializeKit_formatCommandPreview`, including embedded single-quote escaping and argv
 * token joining after a literal command prefix.
 * Flow: build argv plus prefix -> format preview -> assert quoted tokens and spacing.
 *
 * @testing Node test unit: npm run test --prefix packages/env-materialize-kit from repository root runs the tsx-backed Node test harness that includes command-preview.unit.test.ts.
 *
 * @see packages/env-materialize-kit/src/command-preview.ts - Product-neutral shell-quote and preview-formatting implementation whose edge cases are asserted here.
 * @see scripts/env-materialize/ui/lib/format-env-command.ts - Env-materialize UI adapter that consumes `EnvMaterializeKit_formatCommandPreview` output for operator-facing pasteable commands.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EnvMaterializeKit_formatCommandPreview,
  EnvMaterializeKit_shellQuote,
} from "./command-preview.js";

void test("EnvMaterializeKit_shellQuote quotes empty strings, spaces, and single quotes", () => {
  assert.equal(EnvMaterializeKit_shellQuote(""), "''");
  assert.equal(EnvMaterializeKit_shellQuote("/tmp/with space"), "'/tmp/with space'");
  assert.equal(EnvMaterializeKit_shellQuote("don't"), "'don'\\\\''t'");
});

void test("EnvMaterializeKit_formatCommandPreview leaves the prefix literal and quotes argv", () => {
  assert.equal(
    EnvMaterializeKit_formatCommandPreview({
      argv: ["--workspace", "/tmp/with space"],
      commandPrefix: ["npm", "run", "env:workspace", "--"],
    }),
    "npm run env:workspace -- '--workspace' '/tmp/with space'",
  );
});
