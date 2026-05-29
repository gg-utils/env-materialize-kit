/**
 * @fileoverview Verifies product-neutral workspace value helpers for env materialization: optional
 * trimmed text reads, nested JSON scalar extraction, scalar precedence, mapped key fallbacks,
 * trailing path segment removal, and temporary process.env snapshots with restoration.
 *
 * This file owns Node `node:test` regression coverage for the helpers exported from
 * `workspace-values.ts` and consumed by env materialize adapters.
 * Flow: temp filesystem fixtures or in-memory maps -> helper invocation -> assert normalized values
 * and env restoration semantics.
 *
 * @testing Node test unit: npm run test --prefix packages/env-materialize-kit from repository root runs the tsx-backed Node test harness that includes workspace-values.unit.test.ts.
 *
 * @see packages/env-materialize-kit/src/workspace-values.ts - Shared filesystem and precedence resolver helpers whose trimming, JSON traversal, mapped-key fallback, path-segment, and temporary env contracts are asserted here.
 * @see packages/env-materialize-kit/src/index.ts - Package barrel that re-exports the workspace-values surface verified by this regression suite.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EnvMaterializeKit_readOptionalNestedJsonScalar,
  EnvMaterializeKit_readOptionalTrimmedTextFile,
  EnvMaterializeKit_removeTrailingPathSegment,
  EnvMaterializeKit_resolveFirstNonEmptyString,
  EnvMaterializeKit_resolveMappedFallbackValue,
  EnvMaterializeKit_resolvePositiveInteger,
  EnvMaterializeKit_withTemporaryProcessEnv,
} from "./workspace-values.js";

test("EnvMaterializeKit_readOptionalTrimmedTextFile handles missing and blank files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-materialize-values-"));
  try {
    const filePath = path.join(tempDir, "value.txt");
    assert.equal(EnvMaterializeKit_readOptionalTrimmedTextFile({ filePath }), null);
    fs.writeFileSync(filePath, "  \n", "utf8");
    assert.equal(EnvMaterializeKit_readOptionalTrimmedTextFile({ filePath }), null);
    fs.writeFileSync(filePath, "  /repo/root \n", "utf8");
    assert.equal(
      EnvMaterializeKit_readOptionalTrimmedTextFile({ filePath }),
      "/repo/root",
    );
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test("EnvMaterializeKit_readOptionalNestedJsonScalar follows object fields", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-materialize-json-"));
  try {
    const filePath = path.join(tempDir, "metadata.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        labels: { blank: " ", name: " alpha " },
        ports: { app: 4011 },
      }),
      "utf8",
    );

    assert.equal(
      EnvMaterializeKit_readOptionalNestedJsonScalar({
        fieldPath: ["ports", "app"],
        filePath,
      }),
      "4011",
    );
    assert.equal(
      EnvMaterializeKit_readOptionalNestedJsonScalar({
        fieldPath: ["labels", "name"],
        filePath,
      }),
      "alpha",
    );
    assert.equal(
      EnvMaterializeKit_readOptionalNestedJsonScalar({
        fieldPath: ["labels", "blank"],
        filePath,
      }),
      null,
    );
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

test("EnvMaterializeKit scalar resolvers keep historical precedence", () => {
  assert.equal(
    EnvMaterializeKit_resolveFirstNonEmptyString({
      defaultValue: "fallback",
      values: [undefined, "  first ", "second"],
    }),
    "first",
  );
  assert.equal(
    EnvMaterializeKit_resolveFirstNonEmptyString({
      defaultValue: "fallback",
      values: [" "],
    }),
    "fallback",
  );
  assert.equal(
    EnvMaterializeKit_resolvePositiveInteger({
      defaultValue: 80,
      values: [null, "0", " 4011abc ", 9000],
    }),
    4011,
  );
});

test("EnvMaterializeKit_resolveMappedFallbackValue resolves direct before mapped fallback", () => {
  assert.equal(
    EnvMaterializeKit_resolveMappedFallbackValue({
      directSources: [new Map([["LOCAL_KEY", " direct "]])],
      fallbackKeyByKey: { LOCAL_KEY: "HOSTED_KEY" },
      fallbackSource: new Map([["HOSTED_KEY", "hosted"]]),
      key: "LOCAL_KEY",
    }),
    "direct",
  );
  assert.equal(
    EnvMaterializeKit_resolveMappedFallbackValue({
      directSources: [new Map([["LOCAL_KEY", " "]])],
      fallbackKeyByKey: { LOCAL_KEY: "HOSTED_KEY" },
      fallbackSource: new Map([["HOSTED_KEY", " hosted "]]),
      key: "LOCAL_KEY",
    }),
    "hosted",
  );
  assert.equal(
    EnvMaterializeKit_resolveMappedFallbackValue({
      directSources: [],
      fallbackKeyByKey: {},
      fallbackSource: new Map([["HOSTED_KEY", "hosted"]]),
      key: "LOCAL_KEY",
    }),
    undefined,
  );
});

test("EnvMaterializeKit_removeTrailingPathSegment strips only exact trailing segment", () => {
  assert.equal(
    EnvMaterializeKit_removeTrailingPathSegment({
      candidatePath: "/tmp/root/generated",
      segmentName: "generated",
    }),
    "/tmp/root",
  );
  assert.equal(
    EnvMaterializeKit_removeTrailingPathSegment({
      candidatePath: "/tmp/root/generated-assets",
      segmentName: "generated",
    }),
    "/tmp/root/generated-assets",
  );
});

test("EnvMaterializeKit_withTemporaryProcessEnv restores process env after callback", () => {
  const originalValue = process.env.ENV_MATERIALIZE_KIT_TEST_VALUE;
  process.env.ENV_MATERIALIZE_KIT_TEST_VALUE = "original";

  const callbackValue = EnvMaterializeKit_withTemporaryProcessEnv({
    callback: () => process.env.ENV_MATERIALIZE_KIT_TEST_VALUE,
    envSnapshot: { ENV_MATERIALIZE_KIT_TEST_VALUE: "temporary" },
  });

  assert.equal(callbackValue, "temporary");
  assert.equal(process.env.ENV_MATERIALIZE_KIT_TEST_VALUE, "original");

  if (originalValue === undefined) {
    delete process.env.ENV_MATERIALIZE_KIT_TEST_VALUE;
  } else {
    process.env.ENV_MATERIALIZE_KIT_TEST_VALUE = originalValue;
  }
});
