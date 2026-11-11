/**
 * @fileoverview Owns Node `node:test` regression coverage for pure OpenTUI env-materialize wizard helpers:
 * profile discovery roots, navigation option rows, mode/logical-environment/target/machine-profile selects, selected-index lookup, route indexes, and materializer stdout/stderr summarization.
 *
 * The helpers live in `./opentui-wizard-model.js`; this suite asserts their contracts without rendering OpenTUI UI.
 * Flow: build inputs -> call model helper -> assert option shapes, indexes, routes, or summarized subprocess lines.
 *
 * @testing Node test: cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/opentui-wizard-model.unit.test.ts
 * @testing Browser manual: run `npm run env:workspace:cli:opentui` from the repo root on a TTY, step through workspace/mode/logical-environment/targets/profile/preview/run/result, and confirm option labels plus continue/back/run/restart/quit copy match the expectations encoded in these assertions.
 *
 * @see packages/env-materialize-kit/src/opentui-wizard-model.ts - Stateless OpenTUI wizard model helpers (menus, route ordering, discovery paths, output summarization) whose behavior is asserted by this suite.
 * @see scripts/env-materialize/ui/cli-opentui/app.tsx - OpenTUI TTY wizard that consumes those helpers to render wizard steps and option rows referenced by the strings under test.
 * @see docs/COMMANDS.md - Command catalog entry for `npm run env:workspace:cli:opentui` used for manual verification after changing wizard copy or navigation modeled here.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions,
  EnvMaterializeKit_buildOpenTuiLogicalEnvironmentOptions,
  EnvMaterializeKit_buildOpenTuiMachineProfileOptions,
  EnvMaterializeKit_buildOpenTuiModeOptions,
  EnvMaterializeKit_buildOpenTuiResultOptions,
  EnvMaterializeKit_buildOpenTuiRunBackQuitOptions,
  EnvMaterializeKit_buildOpenTuiTargetsOptions,
  EnvMaterializeKit_findOpenTuiSelectedOptionIndex,
  EnvMaterializeKit_openTuiRouteIndex,
  EnvMaterializeKit_resolveOpenTuiProfileDiscoveryRoot,
  EnvMaterializeKit_summarizeOpenTuiMaterializerOutput,
} from "./opentui-wizard-model.js";

void test("OpenTUI wizard model resolves profile discovery root", () => {
  assert.equal(
    EnvMaterializeKit_resolveOpenTuiProfileDiscoveryRoot({
      fallbackRoot: "/repo",
      rawPath: " ./profiles ",
    }),
    path.resolve("./profiles"),
  );
  assert.equal(
    EnvMaterializeKit_resolveOpenTuiProfileDiscoveryRoot({
      fallbackRoot: "/repo",
      rawPath: " ",
    }),
    "/repo",
  );
});

void test("OpenTUI wizard model builds navigation options", () => {
  assert.deepEqual(
    EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
      continueLabel: "Continue to mode",
    }),
    [
      { description: "Continue to mode", name: "Continue", value: "continue" },
      { description: "Previous screen", name: "Back", value: "back" },
      { description: "Exit", name: "Quit", value: "quit" },
    ],
  );
  assert.deepEqual(EnvMaterializeKit_buildOpenTuiRunBackQuitOptions(), [
    { description: "Run materializer subprocess", name: "Run", value: "run" },
    { description: "Edit options", name: "Back", value: "back" },
    { description: "Exit", name: "Quit", value: "quit" },
  ]);
  assert.deepEqual(EnvMaterializeKit_buildOpenTuiResultOptions(), [
    {
      description: "Start over from workspace",
      name: "Restart",
      value: "restart",
    },
    { description: "Exit", name: "Quit", value: "quit" },
  ]);
});

void test("OpenTUI wizard model builds select options", () => {
  assert.deepEqual(
    EnvMaterializeKit_buildOpenTuiModeOptions({ modes: ["check", "restore"] }),
    [
      { description: "Mode: check", name: "check", value: "check" },
      { description: "Mode: restore", name: "restore", value: "restore" },
    ],
  );
  assert.deepEqual(
    EnvMaterializeKit_buildOpenTuiLogicalEnvironmentOptions({
      logicalEnvironmentIds: ["local", "staging"],
    }),
    [
      {
        description: "Logical environment: local",
        name: "local",
        value: "local",
      },
      {
        description: "Logical environment: staging",
        name: "staging",
        value: "staging",
      },
    ],
  );
  assert.deepEqual(EnvMaterializeKit_buildOpenTuiTargetsOptions(), [
    { description: "local-edge + packages", name: "all", value: "all" },
    { description: "local-edge only", name: "local-edge", value: "local-edge" },
    { description: "packages only", name: "packages", value: "packages" },
  ]);
  assert.deepEqual(
    EnvMaterializeKit_buildOpenTuiMachineProfileOptions({
      emptyDescription: "No machine profile",
      emptyName: "(none)",
      profiles: ["laptop"],
    }),
    [
      { description: "No machine profile", name: "(none)", value: "" },
      { description: "laptop", name: "laptop", value: "laptop" },
    ],
  );
});

void test("OpenTUI wizard model finds selected option and route indexes", () => {
  const options = EnvMaterializeKit_buildOpenTuiTargetsOptions();
  assert.equal(
    EnvMaterializeKit_findOpenTuiSelectedOptionIndex({
      options,
      selectedValue: "packages",
    }),
    2,
  );
  assert.equal(
    EnvMaterializeKit_findOpenTuiSelectedOptionIndex({
      options,
      selectedValue: "missing",
    }),
    0,
  );
  assert.equal(EnvMaterializeKit_openTuiRouteIndex({ route: "workspace" }), 0);
  assert.equal(EnvMaterializeKit_openTuiRouteIndex({ route: "preview" }), 6);
});

void test("OpenTUI wizard model summarizes materializer output", () => {
  assert.equal(
    EnvMaterializeKit_summarizeOpenTuiMaterializerOutput({
      stderr: "[env-materialize] warning b\n",
      stdout: "[env-materialize] ok a\nnoise\n",
    }),
    "[env-materialize] ok a\n[env-materialize] warning b",
  );
  assert.equal(
    EnvMaterializeKit_summarizeOpenTuiMaterializerOutput({
      stderr: "",
      stdout: "plain stdout\n",
    }),
    "plain stdout",
  );
  assert.equal(
    EnvMaterializeKit_summarizeOpenTuiMaterializerOutput({
      stderr: "plain error\n",
      stdout: "",
    }),
    "(no [env-materialize] lines in stdout)",
  );
});
