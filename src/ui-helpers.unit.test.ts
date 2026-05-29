/**
 * @fileoverview Verifies env-materialize-kit UI helper primitives for target selection, optional
 * form-field parsing, path resolution, and mutation summary formatting.
 *
 * This file owns regression coverage for `EnvMaterializeKit_*` helpers imported from `ui-helpers`
 * without exercising Ink, OpenTUI, or a real TTY.
 * Flow: build inputs -> call helper -> assert arrays, trimmed strings, resolved paths, thrown
 * errors, or summary lines.
 *
 * @testing Node.js test runner unit: cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/ui-helpers.unit.test.ts
 *
 * @see packages/env-materialize-kit/src/ui-helpers.ts - Product-neutral helper implementations for target expansion, integer and string field parsing, optional path resolution, and mutation summary lines whose contracts are asserted here.
 * @see packages/env-materialize-kit/src/ink-wizard-model.ts - Ink-backed wizard view model that imports `EnvMaterializeKit_TargetsChoice` from `ui-helpers` so wizard target selection stays aligned with the `all` versus single-target expansion rules asserted here.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  EnvMaterializeKit_formatMutationSummaryLines,
  EnvMaterializeKit_parseOptionalPositiveIntegerField,
  EnvMaterializeKit_resolveOptionalPathField,
  EnvMaterializeKit_resolveOptionalTrimmedStringField,
  EnvMaterializeKit_targetsFromChoice,
} from "./ui-helpers.js";

test("EnvMaterializeKit_targetsFromChoice expands all to configured defaults", () => {
  assert.deepEqual(
    EnvMaterializeKit_targetsFromChoice({
      choice: "all",
      defaultTargets: ["one", "two"],
    }),
    ["one", "two"],
  );
  assert.deepEqual(
    EnvMaterializeKit_targetsFromChoice({
      choice: "one",
      defaultTargets: ["one", "two"],
    }),
    ["one"],
  );
});

test("EnvMaterializeKit_parseOptionalPositiveIntegerField handles blanks and errors", () => {
  assert.equal(
    EnvMaterializeKit_parseOptionalPositiveIntegerField({
      label: "Port",
      rawValue: " ",
    }),
    undefined,
  );
  assert.equal(
    EnvMaterializeKit_parseOptionalPositiveIntegerField({
      label: "Port",
      rawValue: " 42 ",
    }),
    42,
  );
  assert.throws(
    () =>
      EnvMaterializeKit_parseOptionalPositiveIntegerField({
        label: "Port",
        rawValue: "0",
      }),
    /Port must be a positive integer or blank/u,
  );
});

test("EnvMaterializeKit optional field resolvers trim strings and resolve paths", () => {
  assert.equal(EnvMaterializeKit_resolveOptionalTrimmedStringField(" x "), "x");
  assert.equal(EnvMaterializeKit_resolveOptionalTrimmedStringField(" "), undefined);
  assert.equal(
    EnvMaterializeKit_resolveOptionalPathField({
      currentWorkingDirectory: "/repo",
      rawValue: " ./nested ",
    }),
    path.resolve("/repo/nested"),
  );
  assert.equal(
    EnvMaterializeKit_resolveOptionalPathField({
      currentWorkingDirectory: "/repo",
      rawValue: " ",
    }),
    undefined,
  );
});

test("EnvMaterializeKit_formatMutationSummaryLines groups statuses in stable order", () => {
  assert.deepEqual(
    EnvMaterializeKit_formatMutationSummaryLines([
      { changed: true, filePath: "/a", status: "written" },
      { changed: false, filePath: "/b", status: "unchanged" },
      { changed: false, filePath: "/c", status: "unchanged" },
    ]),
    [
      "Targets: 3 file(s) reported.",
      "Mutations (changed=true): 1",
      "  unchanged: 2",
      "  written: 1",
    ],
  );
});
