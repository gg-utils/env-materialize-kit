/**
 * @fileoverview Unit tests for the reusable env-materialize-kit CLI run loop (`EnvMaterializeKit_runCli`) and the `EnvMaterializeKit_isCheckModeFailureResult` helper used for check-mode exit decisions.
 *
 * This file owns regression coverage for help-only runs, formatted `writeLine` output, successful non-check runs, and check-mode failure exit codes against stubbed `parseCliArgs` and `run` implementations.
 * Flow: stub argv parsing and run callback -> invoke `EnvMaterializeKit_runCli` -> assert printed lines, exit codes, and predicate behavior.
 *
 * @testing Node.js test runner unit: cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/cli-runner.unit.test.ts
 *
 * @see packages/env-materialize-kit/src/cli-runner.ts - Shared CLI runner that owns the dependency-injected orchestration contract, help short-circuit, result printing, and exit-code rules exercised by these tests.
 * @see packages/env-materialize-kit/src/write-target-file.ts - Declares the target mutation result type used when stubbing `formatResultLines` output for status-line assertions in this suite.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EnvMaterializeKit_isCheckModeFailureResult,
  EnvMaterializeKit_runCli,
  type EnvMaterializeKit_ParseRunCliArgsResult,
} from "./cli-runner.js";
import type { EnvMaterializeKit_Mode } from "./modes.js";
import type { EnvMaterializeKit_TargetMutationResult } from "./write-target-file.js";

type TestCliOptions = {
  mode: EnvMaterializeKit_Mode;
  workspacePath: string;
};

type TestMutationResult = EnvMaterializeKit_TargetMutationResult;

function parseTestArgs(options: {
  argv: readonly string[];
  currentWorkingDirectory: string;
}): EnvMaterializeKit_ParseRunCliArgsResult<TestCliOptions> {
  if (options.argv.includes("--help")) {
    return { kind: "help" };
  }

  return {
    kind: "options",
    options: {
      mode: options.argv.includes("--check") ? "check" : "restore-defaults",
      workspacePath: options.currentWorkingDirectory,
    },
  };
}

function formatResultLines(results: readonly TestMutationResult[]): readonly string[] {
  return results.map((result) => `${result.status}:${result.filePath}`);
}

void test("EnvMaterializeKit_runCli prints usage for help without running", () => {
  const lines: string[] = [];
  let runCount = 0;

  const exitCode = EnvMaterializeKit_runCli({
    argv: ["--help"],
    currentWorkingDirectory: "/repo",
    formatResultLines,
    parseCliArgs: parseTestArgs,
    run: () => {
      runCount += 1;
      return { results: [] };
    },
    usageText: "Usage: env-materialize",
    writeLine: (line) => lines.push(line),
  });

  assert.equal(exitCode, 0);
  assert.equal(runCount, 0);
  assert.deepEqual(lines, ["Usage: env-materialize"]);
});

void test("EnvMaterializeKit_runCli prints results and succeeds for non-check runs", () => {
  const lines: string[] = [];
  const exitCode = EnvMaterializeKit_runCli({
    argv: [],
    currentWorkingDirectory: "/repo",
    formatResultLines,
    parseCliArgs: parseTestArgs,
    run: () => ({
      results: [{ changed: true, filePath: "/repo/.env", status: "updated" }],
    }),
    usageText: "Usage",
    writeLine: (line) => lines.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(lines, ["updated:/repo/.env"]);
});

void test("EnvMaterializeKit_runCli fails check mode on drift or missing targets", () => {
  const exitCode = EnvMaterializeKit_runCli({
    argv: ["--check"],
    currentWorkingDirectory: "/repo",
    formatResultLines,
    parseCliArgs: parseTestArgs,
    run: () => ({
      results: [{ changed: false, filePath: "/repo/.env", status: "drift" }],
    }),
    usageText: "Usage",
    writeLine: () => undefined,
  });

  assert.equal(exitCode, 1);
  assert.equal(
    EnvMaterializeKit_isCheckModeFailureResult({
      changed: false,
      filePath: "/repo/.env",
      status: "missing",
    }),
    true,
  );
});
