/**
 * @fileoverview Verifies `EnvMaterializeKit_parseUiLaunchOptions` and `EnvMaterializeKit_formatUiHelpText`
 * for env-materialize interactive UI launchers.
 *
 * This file owns Node `node:test` regression coverage for `--cwd` / `--help` argv parsing and for
 * stable help text that Ink/OpenTUI adapters surface to operators.
 * Flow: build argv + cwd -> assert parsed `{ helpRequested, projectRoot }`; format help -> assert
 * canonical invocation snippets and option lines.
 *
 * @testing Node test (tsx): cd packages/env-materialize-kit && npm run test -- src/ui-launcher.unit.test.ts
 *
 * @see packages/env-materialize-kit/src/ui-launcher.ts - Shared launcher module whose parse and help-formatting contracts are asserted here.
 * @see scripts/env-materialize/ui/cli-ink/env-ink-launch-options.ts - Root Ink CLI adapter that forwards argv into `EnvMaterializeKit_parseUiLaunchOptions` before the UI boots, matching the parsing paths covered here.
 * @see packages/env-materialize-kit/src/index.ts - Package barrel re-exporting `./ui-launcher.js` so downstream CLIs resolve the same helpers exercised by these tests.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EnvMaterializeKit_formatUiHelpText,
  EnvMaterializeKit_parseUiLaunchOptions,
} from "./ui-launcher.js";

test("EnvMaterializeKit_parseUiLaunchOptions parses cwd and help", () => {
  assert.deepEqual(
    EnvMaterializeKit_parseUiLaunchOptions({
      argv: ["--cwd", "/repo"],
      cwd: "/cwd",
      errorPrefix: "env",
    }),
    { helpRequested: false, projectRoot: "/repo" },
  );
  assert.equal(
    EnvMaterializeKit_parseUiLaunchOptions({
      argv: ["--help"],
      cwd: "/cwd",
      errorPrefix: "env",
    }).helpRequested,
    true,
  );
});

test("EnvMaterializeKit_formatUiHelpText mentions canonical env command", () => {
  const helpText = EnvMaterializeKit_formatUiHelpText({
    invocation: "npm run env:workspace:cli:test",
    title: "Env materialize test",
  });
  assert.match(helpText, /env:workspace:cli:test/u);
  assert.match(helpText, /npm run env:workspace/u);
  assert.match(helpText, /--cwd/u);
});
