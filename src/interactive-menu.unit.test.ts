/**
 * @fileoverview Verifies the env-materialize-kit interactive console menu rendering, script dispatch, invalid-key handling, and read-eval loop for `EnvMaterializeKit_*` interactive menu helpers.
 *
 * This file owns regression coverage for `FakeSession`-backed assertions against `EnvMaterializeKit_printInteractiveMenu`, `EnvMaterializeKit_handleInteractiveMenuSelection`, and `EnvMaterializeKit_runInteractiveMenu` without touching a real TTY.
 * Flow: stub session plus menu config -> invoke print, handle, or run -> assert ordered session transcript lines, `runScript` calls, and exit or success paths.
 *
 * @testing Node.js test runner unit: cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/interactive-menu.unit.test.ts
 *
 * @see packages/env-materialize-kit/src/interactive-menu.ts - Package-owned menu loop, session contract, and selection dispatch whose rendering order, invalid-selection messaging, script delegation, and loop-until-exit behavior are asserted here.
 * @see scripts/env-materialize/ui/cli-interactive/main.ts - Env-materialize interactive CLI entrypoint that wires `EnvMaterializeKit_runInteractiveMenu` with workspace-specific menu config and production TTY session adapters.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EnvMaterializeKit_handleInteractiveMenuSelection,
  EnvMaterializeKit_printInteractiveMenu,
  EnvMaterializeKit_runInteractiveMenu,
  type EnvMaterializeKit_InteractiveMenuConfig,
  type EnvMaterializeKit_InteractiveMenuSession,
} from "./interactive-menu.js";

const config: EnvMaterializeKit_InteractiveMenuConfig = {
  headerFamily: "ENV WORKSPACE",
  headerFocus: "MAIN MENU",
  invalidSelectionMessage: "Choose a valid action.",
  items: [
    {
      description: "Validate files",
      key: "1",
      kind: "run-script",
      label: "Check workspace env",
      scriptName: "env:workspace:check",
    },
    {
      description: "Leave",
      exitMessage: "Leaving.",
      key: "2",
      kind: "exit",
      label: "Exit",
    },
  ],
  kicker: "  Workspace Operations",
  panelSubtitle: "Interactive wrapper.",
  panelTitle: "Env Workspace Console",
  promptText: "Choose [1-2]: ",
};

class FakeSession implements EnvMaterializeKit_InteractiveMenuSession {
  readonly lines: string[] = [];
  private readonly answers: string[];

  constructor(answers: readonly string[] = []) {
    this.answers = Array.from(answers);
  }

  clearScreen(): void {
    this.lines.push("clear");
  }

  printError(text: string): void {
    this.lines.push(`error:${text}`);
  }

  printHeader(family: string, focus: string): void {
    this.lines.push(`header:${family}:${focus}`);
  }

  printKicker(text: string): void {
    this.lines.push(`kicker:${text}`);
  }

  printMenuItem(number: string | number, label: string, description: string): void {
    this.lines.push(`item:${number}:${label}:${description}`);
  }

  printPanelTitle(title: string, subtitle = ""): void {
    this.lines.push(`panel:${title}:${subtitle}`);
  }

  printSectionBreak(): void {
    this.lines.push("break");
  }

  printSuccess(text: string): void {
    this.lines.push(`success:${text}`);
  }

  promptReadLine(promptText: string): Promise<string> {
    this.lines.push(`prompt:${promptText}`);
    return Promise.resolve(this.answers.shift() ?? "2");
  }

  writeLine(text = ""): void {
    this.lines.push(`line:${text}`);
  }
}

void test("EnvMaterializeKit_printInteractiveMenu renders configured rows", () => {
  const session = new FakeSession();

  EnvMaterializeKit_printInteractiveMenu({ config, session });

  assert.deepEqual(session.lines, [
    "clear",
    "header:ENV WORKSPACE:MAIN MENU",
    "panel:Env Workspace Console:Interactive wrapper.",
    "kicker:  Workspace Operations",
    "item:1:Check workspace env:Validate files",
    "item:2:Exit:Leave",
    "break",
    "line:",
  ]);
});

void test(
  "EnvMaterializeKit_handleInteractiveMenuSelection runs scripts and rejects unknown keys",
  async () => {
    const session = new FakeSession();
    const runs: string[] = [];

    assert.equal(
      await EnvMaterializeKit_handleInteractiveMenuSelection({
        action: "1",
        config,
        cwd: "/repo",
        runScript: (options) => {
          runs.push(`${options.cwd}:${options.scriptName}`);
          return Promise.resolve();
        },
        session,
      }),
      "continue",
    );

    assert.equal(
      await EnvMaterializeKit_handleInteractiveMenuSelection({
        action: "unknown",
        config,
        cwd: "/repo",
        runScript: () => Promise.resolve(),
        session,
      }),
      "continue",
    );

    assert.deepEqual(runs, ["/repo:env:workspace:check"]);
    assert.equal(session.lines.includes("error:Choose a valid action."), true);
  },
);

void test("EnvMaterializeKit_runInteractiveMenu loops until exit", async () => {
  const session = new FakeSession(["1", "2"]);
  const runs: string[] = [];

  await EnvMaterializeKit_runInteractiveMenu({
    config,
    cwd: "/repo",
    runScript: (options) => {
      runs.push(options.scriptName);
      return Promise.resolve();
    },
    session,
  });

  assert.deepEqual(runs, ["env:workspace:check"]);
  assert.equal(session.lines.includes("success:Leaving."), true);
});
