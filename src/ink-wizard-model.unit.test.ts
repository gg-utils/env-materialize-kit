/**
 * @fileoverview Owns Node `node:test` regression coverage for pure Ink env-materialize wizard helpers:
 * profile discovery roots, selection indexes, target labels, mutation summaries, session labels, legends, and step navigation.
 *
 * The helpers are implemented in `./ink-wizard-model.js`; this suite asserts their contracts without rendering Ink UI.
 * Flow: build inputs -> call model helper -> assert labels, indexes, lines, or next/prev steps.
 *
 * @testing Node test: cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/ink-wizard-model.unit.test.ts
 * @testing Browser manual: run `npm run env:workspace:cli:ink` from the repo root on a TTY, step through workspace/mode/advanced/review/session, and confirm legend strings plus Esc/step-back gating match the expectations encoded in these assertions.
 *
 * @see packages/env-materialize-kit/src/ink-wizard-model.ts - Stateless Ink wizard model helpers (discovery roots, legends, step graph) whose behavior is asserted by this suite.
 * @see scripts/env-materialize/ui/cli-ink/app.tsx - Ink TTY wizard that consumes those helpers to render steps, legends, and key hints referenced by the strings under test.
 * @see docs/COMMANDS.md - Command catalog entry for `npm run env:workspace:cli:ink` used for manual verification after changing wizard copy or navigation modeled here.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  EnvMaterializeKit_findMachineProfileLabelIndex,
  EnvMaterializeKit_findSelectedValueIndex,
  EnvMaterializeKit_formatInkMutationRunSummaryLines,
  EnvMaterializeKit_getInkSessionDoneStatusLabel,
  EnvMaterializeKit_getInkWizardLegendLines,
  EnvMaterializeKit_InkTargetChoiceLabels,
  EnvMaterializeKit_resolveInkProfileDiscoveryRoot,
  EnvMaterializeKit_resolveNextInkWizardStep,
  EnvMaterializeKit_resolvePreviousInkWizardStep,
  EnvMaterializeKit_targetChoiceSelectedIndex,
} from "./ink-wizard-model.js";

test("Ink wizard model resolves profile discovery roots", () => {
  assert.equal(
    EnvMaterializeKit_resolveInkProfileDiscoveryRoot({
      fallbackRoot: "/fallback",
      privateNotesWorkspacePath: " ./private ",
      workspacePath: "./workspace",
    }),
    path.resolve("./private"),
  );
  assert.equal(
    EnvMaterializeKit_resolveInkProfileDiscoveryRoot({
      fallbackRoot: "/fallback",
      privateNotesWorkspacePath: " ",
      workspacePath: "./workspace",
    }),
    path.resolve("./workspace"),
  );
  assert.equal(
    EnvMaterializeKit_resolveInkProfileDiscoveryRoot({
      fallbackRoot: "/fallback",
      privateNotesWorkspacePath: " ",
      workspacePath: " ",
    }),
    "/fallback",
  );
});

test("Ink wizard model computes selected indexes", () => {
  assert.equal(
    EnvMaterializeKit_findSelectedValueIndex({
      selectedValue: "second",
      values: ["first", "second"],
    }),
    1,
  );
  assert.equal(
    EnvMaterializeKit_findSelectedValueIndex({
      selectedValue: "missing",
      values: ["first", "second"],
    }),
    0,
  );
  assert.equal(
    EnvMaterializeKit_findMachineProfileLabelIndex({
      emptyLabel: "(none)",
      labels: ["(none)", "laptop"],
      machineProfile: "",
    }),
    0,
  );
  assert.equal(
    EnvMaterializeKit_findMachineProfileLabelIndex({
      emptyLabel: "(none)",
      labels: ["(none)", "laptop"],
      machineProfile: "laptop",
    }),
    1,
  );
});

test("Ink wizard model maps target choices and labels", () => {
  assert.deepEqual(EnvMaterializeKit_InkTargetChoiceLabels, [
    "all (local-edge + packages)",
    "local-edge only",
    "packages only",
  ]);
  assert.equal(
    EnvMaterializeKit_targetChoiceSelectedIndex({ targetsChoice: "all" }),
    0,
  );
  assert.equal(
    EnvMaterializeKit_targetChoiceSelectedIndex({
      targetsChoice: "local-edge",
    }),
    1,
  );
  assert.equal(
    EnvMaterializeKit_targetChoiceSelectedIndex({ targetsChoice: "packages" }),
    2,
  );
});

test("Ink wizard model formats mutation and result labels", () => {
  assert.deepEqual(
    EnvMaterializeKit_formatInkMutationRunSummaryLines([
      { filePath: "/tmp/a.env", status: "unchanged" },
      { filePath: "/tmp/b.env", status: "created" },
    ]),
    [
      "[env-materialize] unchanged /tmp/a.env",
      "[env-materialize] created /tmp/b.env",
    ],
  );
  assert.equal(
    EnvMaterializeKit_getInkSessionDoneStatusLabel("succeeded"),
    "Completed",
  );
  assert.equal(
    EnvMaterializeKit_getInkSessionDoneStatusLabel("cancelled"),
    "Cancelled",
  );
  assert.equal(
    EnvMaterializeKit_getInkSessionDoneStatusLabel("failed"),
    "Failed",
  );
});

test("Ink wizard model resolves legend lines", () => {
  assert.deepEqual(
    EnvMaterializeKit_getInkWizardLegendLines({
      buildError: null,
      step: "review",
    }),
    [
      "Enter run | Esc back | Ctrl+C quit",
      "Preflight uses EnvMaterialize_run in check mode before the mutating npm run.",
    ],
  );
  assert.deepEqual(
    EnvMaterializeKit_getInkWizardLegendLines({
      buildError: "bad port",
      step: "review",
    })[0],
    "Fix invalid fields (e.g. ports) before running.",
  );
  assert.deepEqual(
    EnvMaterializeKit_getInkWizardLegendLines({
      buildError: null,
      step: "session",
    }),
    [
      "Live run in progress. Press q to cancel.",
      "Escape is disabled until the process finishes.",
    ],
  );
});

test("Ink wizard model resolves next and previous steps", () => {
  assert.equal(
    EnvMaterializeKit_resolvePreviousInkWizardStep({
      currentStep: "workspace",
    }),
    "mode",
  );
  assert.equal(
    EnvMaterializeKit_resolvePreviousInkWizardStep({ currentStep: "mode" }),
    null,
  );
  assert.equal(
    EnvMaterializeKit_resolveNextInkWizardStep({ currentStep: "advanced" }),
    "review",
  );
  assert.equal(
    EnvMaterializeKit_resolveNextInkWizardStep({ currentStep: "review" }),
    null,
  );
});
