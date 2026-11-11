/**
 * @fileoverview Reusable launcher parsing and spawn helpers for env-materialize UIs.
 *
 * Script adapters provide surface-specific help copy and project-relative CLI paths; this package
 * module owns the shared `--cwd` parser and generic `npx tsx` child wrapper used by Ink/OpenTUI.
 *
 * @testing Node test (tsx): cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/ui-launcher.unit.test.ts
 * @see packages/env-materialize-kit/src/ui-launcher.unit.test.ts - Node `node:test` module asserting `EnvMaterializeKit_parseUiLaunchOptions` and `EnvMaterializeKit_formatUiHelpText` contracts owned by this launcher surface.
 * @see packages/env-materialize-kit/src/ink-app.tsx - Ink wizard renderer importing `EnvMaterializeKit_startInkCliTaskProcess` to stream workspace CLI stdout/stderr into the interactive env-materialize UI.
 * @see scripts/env-materialize/ui/cli-ink/env-ink-launch-options.ts - Root Ink CLI adapter forwarding argv into `EnvMaterializeKit_parseUiLaunchOptions` from `@gg-utils/env-materialize-kit/ui-launcher` before the UI boots.
 * @see packages/env-materialize-kit/src/index.ts - Package barrel re-exporting `./ui-launcher.js` so `@gg-utils/env-materialize-kit` consumers resolve the shared launcher helpers from one entry surface.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
import { type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
/** Parsed launcher flags shared by env-materialize UI wrappers. */
export type EnvMaterializeKit_UiLaunchOptions = {
    helpRequested: boolean;
    projectRoot: string;
};
/** Parses `--help`/`-h` and `--cwd <path>` flags for env-materialize UI launchers. */
export declare function EnvMaterializeKit_parseUiLaunchOptions(options: {
    argv: readonly string[];
    cwd: string;
    errorPrefix: string;
}): EnvMaterializeKit_UiLaunchOptions;
/** Formats stable help text for env-materialize UI launchers. */
export declare function EnvMaterializeKit_formatUiHelpText(options: {
    invocation: string;
    title: string;
}): string;
/** Optional stdout/stderr sinks for env-materialize UI child processes. */
export type EnvMaterializeKit_UiSpawnHandlers = {
    onStderrChunk?: (chunk: string) => void;
    onStdoutChunk?: (chunk: string) => void;
};
/** Spawns `npx tsx <script>` from a project root and accumulates stdout/stderr until exit. */
export declare function EnvMaterializeKit_spawnNpxTsxOnce(options: {
    argv: readonly string[];
    handlers?: EnvMaterializeKit_UiSpawnHandlers;
    projectRoot: string;
    scriptRelativePath: string;
}): {
    promise: Promise<{
        status: number;
        stderr: string;
        stdout: string;
    }>;
    cancel: () => void;
};
/** Source stream for a captured Ink subprocess output line. */
export type EnvMaterializeKit_InkCliSessionLineSource = "stdout" | "stderr";
/** A captured Ink subprocess output line with its originating stream. */
export type EnvMaterializeKit_InkCliSessionLine = {
    readonly source: EnvMaterializeKit_InkCliSessionLineSource;
    readonly text: string;
};
/** Final result for a cancelable Ink subprocess run. */
export type EnvMaterializeKit_InkCliTaskExecutionResult = {
    readonly endedAt: string;
    readonly exitCode: number | null;
    readonly lines: readonly EnvMaterializeKit_InkCliSessionLine[];
    readonly signal: string | null;
    readonly startedAt: string;
    readonly status: "cancelled" | "failed" | "succeeded";
};
/** Spawned process shape when stdin is ignored and stdout/stderr are readable streams. */
type EnvMaterializeKit_InkSpawnedProcess = ChildProcessByStdio<null, Readable, Readable>;
/** Injectable spawn surface matching Node streaming stdio for tests and adapters. */
interface EnvMaterializeKit_InkSpawnProcess {
    (command: string, args: string[], options: {
        cwd: string;
        detached: boolean;
        env: NodeJS.ProcessEnv;
        stdio: ["ignore", "pipe", "pipe"];
    }): EnvMaterializeKit_InkSpawnedProcess;
}
/** Hooks invoked as the bridged subprocess starts and emits output lines. */
type EnvMaterializeKit_InkCliTaskCallbacks = {
    readonly onLine: (line: EnvMaterializeKit_InkCliSessionLine) => void;
    readonly onStarted: (startedAt: string) => void;
};
/** Spawns a cancelable child process for Ink apps and streams stdout/stderr as line records. */
export declare function EnvMaterializeKit_startInkCliTaskProcess(options: {
    readonly args: readonly string[];
    readonly callbacks: EnvMaterializeKit_InkCliTaskCallbacks;
    readonly command: string;
    readonly dependencies?: {
        readonly spawnProcess?: EnvMaterializeKit_InkSpawnProcess;
    };
    readonly env?: NodeJS.ProcessEnv;
    readonly projectRoot: string;
}): {
    readonly cancel: () => void;
    readonly lines: readonly EnvMaterializeKit_InkCliSessionLine[];
    readonly promise: Promise<EnvMaterializeKit_InkCliTaskExecutionResult>;
    readonly startedAt: string;
};
export {};
