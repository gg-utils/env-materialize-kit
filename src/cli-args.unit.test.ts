/**
 * @fileoverview Verifies env-materialize CLI argv parsing, target expansion, option serialization,
 * and additional-option value collection for the `@gg-utils/env-materialize-kit` package.
 *
 * This file owns regression coverage for `EnvMaterializeKit_parseCliArgs` and related helpers used
 * by root env-materialize tooling.
 * Flow: build argv or options -> parse or serialize -> assert normalized maps and error messages.
 *
 * @testing Node test unit: npm run test --prefix packages/env-materialize-kit from repository root runs the tsx-backed Node test harness that includes cli-args.unit.test.ts.
 *
 * @see packages/env-materialize-kit/src/cli-args.ts - Shared CLI argv parser, serializers, and typed option maps whose contracts are asserted here.
 * @see env-materialize.config.ts - Root materializer config that calls the same parse entrypoint guarded by this suite.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  EnvMaterializeKit_collectCliAdditionalOptionValueMaps,
  EnvMaterializeKit_parseCliArgs,
  EnvMaterializeKit_parseCliTargets,
  EnvMaterializeKit_serializeCliOptionsToArgv,
  type EnvMaterializeKit_CliAdditionalOption,
} from "./cli-args.js";

const additionalOptions: readonly EnvMaterializeKit_CliAdditionalOption[] = [
  {
    flag: "--machine-profile",
    key: "machineProfile",
    kind: "string",
    valueNormalization: "trim-if-nonempty",
  },
  {
    flag: "--private-notes-workspace",
    key: "privateNotesWorkspacePath",
    kind: "string",
    valueNormalization: "resolve-path-if-nonempty",
  },
  {
    flag: "--port",
    key: "port",
    kind: "positive-integer",
  },
];

const logicalEnvironmentIds = ["local", "development"] as const;
const modes = ["check", "restore-defaults"] as const;
const targets = ["local-edge", "packages"] as const;

type LogicalEnvironmentId = (typeof logicalEnvironmentIds)[number];
type Mode = (typeof modes)[number];
type Target = (typeof targets)[number];

function isLogicalEnvironmentId(value: string): value is LogicalEnvironmentId {
  return logicalEnvironmentIds.some(
    (logicalEnvironmentId) => logicalEnvironmentId === value,
  );
}

function isMode(value: string): value is Mode {
  return modes.some((mode) => mode === value);
}

function isTarget(value: string): value is Target {
  return targets.some((target) => target === value);
}

function parseTestArgs(argv: readonly string[]) {
  return EnvMaterializeKit_parseCliArgs({
    additionalOptions,
    argv,
    currentWorkingDirectory: "/workspace/root",
    defaultMode: "restore-defaults",
    defaultTargets: targets,
    isLogicalEnvironmentId,
    isMode,
    isTarget,
    logicalEnvironmentLabels: logicalEnvironmentIds,
    modeLabels: modes,
  });
}

test("EnvMaterializeKit_parseCliArgs parses standard and additional options", () => {
  const result = parseTestArgs([
    "--workspace",
    "../app",
    "--logical-environment",
    "local",
    "--mode",
    "check",
    "--targets",
    "packages,local-edge,packages",
    "--machine-profile",
    " laptop ",
    "--private-notes-workspace",
    "../notes",
    "--port",
    "4011",
  ]);

  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") {
    return;
  }

  assert.equal(result.options.workspacePath, path.resolve("/workspace/app"));
  assert.equal(result.options.logicalEnvironmentId, "local");
  assert.equal(result.options.mode, "check");
  assert.deepEqual(result.options.targets, ["packages", "local-edge"]);
  assert.equal(
    result.options.stringOptionValuesByKey.get("machineProfile"),
    "laptop",
  );
  assert.equal(
    result.options.stringOptionValuesByKey.get("privateNotesWorkspacePath"),
    path.resolve("/workspace/notes"),
  );
  assert.equal(result.options.positiveIntegerOptionValuesByKey.get("port"), 4011);
});

test("EnvMaterializeKit_parseCliArgs returns help only for unconsumed help flags", () => {
  assert.deepEqual(parseTestArgs(["--help"]), { kind: "help" });

  const result = parseTestArgs([
    "--logical-environment",
    "local",
    "--machine-profile",
    "--help",
  ]);

  assert.equal(result.kind, "parsed");
  if (result.kind !== "parsed") {
    return;
  }
  assert.equal(result.options.stringOptionValuesByKey.get("machineProfile"), "--help");
});

test("EnvMaterializeKit_parseCliArgs rejects unsupported literals and numeric values", () => {
  assert.throws(
    () => parseTestArgs(["--logical-environment", "unknown"]),
    /--logical-environment must be one of: local, development/u,
  );
  assert.throws(
    () => parseTestArgs(["--logical-environment", "local", "--mode", "bad"]),
    /--mode must be one of: check, restore-defaults/u,
  );
  assert.throws(
    () => parseTestArgs(["--logical-environment", "local", "--targets", "bad"]),
    /Unsupported target\(s\): bad/u,
  );
  assert.throws(
    () => parseTestArgs(["--logical-environment", "local", "--port", "0"]),
    /--port must be a positive integer/u,
  );
  assert.throws(
    () => parseTestArgs(["--logical-environment", "local", "--unknown"]),
    /Unknown argument '--unknown'/u,
  );
});

test("EnvMaterializeKit_parseCliTargets keeps all-token behavior compatible", () => {
  assert.deepEqual(
    EnvMaterializeKit_parseCliTargets({
      defaultTargets: targets,
      isTarget,
      rawValue: "",
    }),
    ["local-edge", "packages"],
  );
  assert.deepEqual(
    EnvMaterializeKit_parseCliTargets({
      defaultTargets: targets,
      isTarget,
      rawValue: "all,bad",
    }),
    ["local-edge", "packages"],
  );
});

test(
  "EnvMaterializeKit_serializeCliOptionsToArgv serializes additional flags in definition order",
  () => {
    const argv = EnvMaterializeKit_serializeCliOptionsToArgv({
      additionalOptions,
      defaultTargets: targets,
      logicalEnvironmentId: "development",
      mode: "check",
      positiveIntegerOptionValuesByKey: new Map([["port", 9011]]),
      stringOptionValuesByKey: new Map([
        ["machineProfile", "alpha"],
        ["privateNotesWorkspacePath", "/notes"],
      ]),
      targets: ["packages"],
      workspacePath: "/workspace",
    });

    assert.deepEqual(argv, [
      "--workspace",
      "/workspace",
      "--logical-environment",
      "development",
      "--mode",
      "check",
      "--targets",
      "packages",
      "--machine-profile",
      "alpha",
      "--private-notes-workspace",
      "/notes",
      "--port",
      "9011",
    ]);
  },
);

test("EnvMaterializeKit_collectCliAdditionalOptionValueMaps filters configured values", () => {
  const valueMaps = EnvMaterializeKit_collectCliAdditionalOptionValueMaps({
    additionalOptions,
    positiveIntegerOptionValuesByKey: new Map([["port", 4011]]),
    stringOptionValuesByKey: new Map([
      ["machineProfile", " alpha "],
      ["privateNotesWorkspacePath", "/notes"],
      ["unused", "ignored"],
    ]),
  });

  assert.deepEqual([...valueMaps.stringOptionValuesByKey], [
    ["machineProfile", "alpha"],
    ["privateNotesWorkspacePath", "/notes"],
  ]);
  assert.deepEqual([...valueMaps.positiveIntegerOptionValuesByKey], [
    ["port", 4011],
  ]);
});
