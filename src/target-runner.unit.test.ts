/**
 * @fileoverview Verifies ordered render/write delegation for env-materialize-kit target-file iteration (`EnvMaterializeKit_runTargetFiles`).
 *
 * This file owns regression coverage for stable traversal order, injected render callbacks for local-edge versus package targets, and aggregated per-target results when writes are stubbed in check mode.
 * Flow: stub render + write callbacks -> invoke `EnvMaterializeKit_runTargetFiles` -> assert callback sequencing and collected results.
 *
 * @testing Node.js test runner unit: cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/target-runner.unit.test.ts
 *
 * @see packages/env-materialize-kit/src/target-runner.ts - Package-owned iterator under test that renders each resolved target and forwards writes through injected callbacks while preserving traversal order.
 * @see packages/env-materialize-kit/src/target-files.ts - Discriminated local-edge and package env target definitions that determine which render branch runs for each entry exercised in this suite.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EnvMaterializeKit_runTargetFiles } from "./target-runner.js";

void test("EnvMaterializeKit_runTargetFiles renders and writes targets in resolved order", () => {
  const calls: string[] = [];

  const result = EnvMaterializeKit_runTargetFiles({
    mode: "check",
    renderLocalEdgeTarget: ({ target }) => {
      calls.push(`render:${target.id}`);
      return {
        content: "LOCAL_EDGE=1\n",
      };
    },
    renderPackageTarget: ({ target }) => {
      calls.push(`render:${target.packageId}`);
      return {
        content: `${target.packageId}=1\n`,
      };
    },
    targetFiles: [
      {
        filePath: "/workspace/.env.local-edge",
        id: "local-edge",
        referenceFilePath: "/reference/local-edge.env",
        targetType: "local-edge",
      },
      {
        filePath: "/workspace/package-a/.env",
        id: "package-a",
        packageId: "package-a",
        referenceFilePath: "/workspace/package-a/.env.example",
        targetType: "package-env",
      },
    ],
    writeTargetFile: (options) => {
      calls.push(`write:${options.filePath}:${options.desiredContent.trim()}`);
      return {
        filePath: options.filePath,
        mode: options.mode,
      };
    },
  });

  assert.deepEqual(calls, [
    "render:local-edge",
    "write:/workspace/.env.local-edge:LOCAL_EDGE=1",
    "render:package-a",
    "write:/workspace/package-a/.env:package-a=1",
  ]);
  assert.deepEqual(result.results, [
    {
      filePath: "/workspace/.env.local-edge",
      mode: "check",
    },
    {
      filePath: "/workspace/package-a/.env",
      mode: "check",
    },
  ]);
});
