/**
 * @fileoverview Node test regression coverage for scoped seed override parsing and raw package seed
 * merge routing in env materialization.
 *
 * This file owns assertions for `package-render-values` helpers that parse labeled prefix keys,
 * drop ignored or metadata-only entries, route scoped overrides to the active package, and gate
 * blank map writes.
 * Flow: build scoped override config -> parse keys and merge raw seeds -> assert map outputs and
 * string helpers.
 *
 * @testing Node test runner (tsx): npm run test --prefix packages/env-materialize-kit
 * @testing Node test runner (tsx): cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/package-render-values.unit.test.ts
 *
 * @see packages/env-materialize-kit/src/package-render-values.ts - Scoped override parsing and raw seed merge helpers whose routing and error semantics are asserted here.
 * @see packages/env-materialize-kit/src/index.ts - Kit barrel that re-exports these helpers for downstream env-materialize entrypoints.
 * @see env-materialize.config.ts - Root env-materialize configuration that calls EnvMaterializeKit_applyRawPackageSeedValues while assembling per-package rendered env values.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EnvMaterializeKit_applyRawPackageSeedValues,
  EnvMaterializeKit_getNonEmptyStringMapValue,
  EnvMaterializeKit_parseScopedSeedOverrideKey,
  EnvMaterializeKit_setMapValueIfPresent,
  type EnvMaterializeKit_ScopedSeedOverrideConfig,
} from "./package-render-values.js";

const scopedOverride: EnvMaterializeKit_ScopedSeedOverrideConfig<string> = {
  packageIdByLabel: new Map([
    ["APP_A", "package-a"],
    ["APP_B", "package-b"],
  ]),
  prefix: "PROJECT_",
  separator: "__",
};

test("EnvMaterializeKit_parseScopedSeedOverrideKey parses configured override keys", () => {
  assert.deepEqual(
    EnvMaterializeKit_parseScopedSeedOverrideKey({
      key: "PROJECT_APP_A__PORT",
      scopedOverride,
    }),
    {
      packageId: "package-a",
      targetKey: "PORT",
    },
  );
  assert.equal(
    EnvMaterializeKit_parseScopedSeedOverrideKey({
      key: "ORDINARY_KEY",
      scopedOverride,
    }),
    null,
  );
  assert.throws(
    () =>
      EnvMaterializeKit_parseScopedSeedOverrideKey({
        key: "PROJECT_UNKNOWN__PORT",
        scopedOverride,
      }),
    /Unsupported scoped override label: UNKNOWN/u,
  );
});

test("EnvMaterializeKit_applyRawPackageSeedValues filters and routes seed values", () => {
  const valuesByKey = new Map<string, string>();

  EnvMaterializeKit_applyRawPackageSeedValues({
    ignoredKeyPrefixes: ["IGNORED_"],
    ignoredKeys: new Set(["SHARED_VALUE"]),
    metadataKeys: new Set(["METADATA_KEY"]),
    packageId: "package-a",
    scopedOverride,
    sourceValues: new Map([
      ["METADATA_KEY", "skip"],
      ["IGNORED_SECRET", "skip"],
      ["SHARED_VALUE", "skip"],
      ["BLANK", " "],
      ["PROJECT_APP_A__PORT", "4011"],
      ["PROJECT_APP_B__PORT", "skip"],
      ["ORDINARY", "keep"],
    ]),
    valuesByKey,
  });

  assert.deepEqual([...valuesByKey.entries()], [
    ["PORT", "4011"],
    ["ORDINARY", "keep"],
  ]);
});

test("EnvMaterializeKit map value helpers read and set only present strings", () => {
  const source = new Map([
    ["BLANK", " "],
    ["VALUE", "kept"],
  ]);
  const valuesByKey = new Map<string, string>();

  assert.equal(
    EnvMaterializeKit_getNonEmptyStringMapValue({ key: "BLANK", source }),
    null,
  );
  assert.equal(
    EnvMaterializeKit_getNonEmptyStringMapValue({ key: "VALUE", source }),
    "kept",
  );

  EnvMaterializeKit_setMapValueIfPresent({
    key: "A",
    value: null,
    valuesByKey,
  });
  EnvMaterializeKit_setMapValueIfPresent({
    key: "B",
    value: "set",
    valuesByKey,
  });
  assert.deepEqual([...valuesByKey.entries()], [["B", "set"]]);
});
