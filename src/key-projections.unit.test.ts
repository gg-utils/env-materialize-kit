/**
 * @fileoverview Verifies product-neutral env key projection helpers for map-backed value assembly
 * in the `@gg-utils/env-materialize-kit` package.
 *
 * This file owns regression coverage for `EnvMaterializeKit_buildValueMap`, direct and conditional
 * map projections, resolved multi-map projections, value entry application, and configured key
 * collection with later-map precedence and empty-value trimming.
 * Flow: build source `Map` inputs -> invoke projection helpers -> assert resulting `Map` entries.
 *
 * @testing Node test unit: npm run test --prefix packages/env-materialize-kit from repository root runs the tsx-backed Node test harness that includes key-projections.unit.test.ts.
 *
 * @see packages/env-materialize-kit/src/key-projections.ts - Map-backed projection helpers whose trimming rules, conditional cases, resolution order, and merge semantics are asserted here.
 * @see packages/env-materialize-kit/src/index.ts - Package barrel that re-exports the key-projection surface covered by this regression suite.
 *
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EnvMaterializeKit_applyConditionalMapValueProjections,
  EnvMaterializeKit_applyMapValueProjections,
  EnvMaterializeKit_applyResolvedMapValueProjections,
  EnvMaterializeKit_applyValueEntries,
  EnvMaterializeKit_buildValueMap,
  EnvMaterializeKit_collectMapValues,
  EnvMaterializeKit_resolveProjectedMapValue,
} from "./key-projections.js";

test("EnvMaterializeKit_buildValueMap applies only present non-empty entries", () => {
  assert.deepEqual(
    [...EnvMaterializeKit_buildValueMap({
      entries: [
        ["A", "1"],
        ["B", ""],
        ["C", undefined],
      ],
    })],
    [["A", "1"]],
  );
});

test("EnvMaterializeKit_applyMapValueProjections maps non-empty source values", () => {
  const valuesByKey = new Map<string, string>([["EXISTING", "kept"]]);
  EnvMaterializeKit_applyMapValueProjections({
    projections: [
      { sourceKey: "SOURCE_A", targetKey: "TARGET_A" },
      { sourceKey: "SOURCE_B", targetKey: "TARGET_B" },
    ],
    sourceValues: new Map([
      ["SOURCE_A", "alpha"],
      ["SOURCE_B", " "],
    ]),
    valuesByKey,
  });

  assert.deepEqual([...valuesByKey.entries()], [
    ["EXISTING", "kept"],
    ["TARGET_A", "alpha"],
  ]);
});

test("EnvMaterializeKit_applyConditionalMapValueProjections writes matching cases", () => {
  const valuesByKey = new Map<string, string>();
  EnvMaterializeKit_applyConditionalMapValueProjections({
    projections: [
      {
        cases: [
          { entries: [["FLAG_ENABLED", "1"]], sourceValue: "true" },
          { entries: [["FLAG_ENABLED", "0"]], sourceValue: "false" },
        ],
        sourceKey: "FEATURE_FLAG",
      },
    ],
    sourceValues: new Map([["FEATURE_FLAG", "false"]]),
    valuesByKey,
  });

  assert.deepEqual([...valuesByKey.entries()], [["FLAG_ENABLED", "0"]]);
});

test("EnvMaterializeKit resolved projections use first non-empty source map value", () => {
  assert.equal(
    EnvMaterializeKit_resolveProjectedMapValue({
      key: "A",
      sourceValues: [
        new Map([["A", " "]]),
        new Map([["A", " second "]]),
      ],
    }),
    "second",
  );

  const valuesByKey = new Map<string, string>();
  EnvMaterializeKit_applyResolvedMapValueProjections({
    keys: ["A", "B"],
    sourceValues: [
      new Map([["A", "first"]]),
      new Map([["B", "second"]]),
    ],
    valuesByKey,
  });

  assert.deepEqual([...valuesByKey.entries()], [
    ["A", "first"],
    ["B", "second"],
  ]);
});

test("EnvMaterializeKit_applyValueEntries mutates an existing map", () => {
  const valuesByKey = new Map<string, string>([["A", "old"]]);
  EnvMaterializeKit_applyValueEntries({
    entries: [
      ["A", "new"],
      ["B", "added"],
    ],
    valuesByKey,
  });

  assert.deepEqual([...valuesByKey.entries()], [
    ["A", "new"],
    ["B", "added"],
  ]);
});

test("EnvMaterializeKit_collectMapValues collects configured keys with later maps winning", () => {
  assert.deepEqual(
    [
      ...EnvMaterializeKit_collectMapValues({
        keys: ["A", "B", "C"],
        sourceValues: [
          new Map([
            ["A", "logical"],
            ["B", " "],
          ]),
          new Map([
            ["A", "override"],
            ["B", "present"],
            ["D", "ignored"],
          ]),
        ],
      }),
    ],
    [
      ["A", "override"],
      ["B", "present"],
    ],
  );
});
