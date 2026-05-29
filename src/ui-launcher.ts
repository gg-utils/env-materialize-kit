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

import { spawn, type ChildProcessByStdio } from "node:child_process";
import path from "node:path";
import type { Readable } from "node:stream";

/** Parsed launcher flags shared by env-materialize UI wrappers. */
export type EnvMaterializeKit_UiLaunchOptions = {
  helpRequested: boolean;
  projectRoot: string;
};

/** Parses `--help`/`-h` and `--cwd <path>` flags for env-materialize UI launchers. */
export function EnvMaterializeKit_parseUiLaunchOptions(options: {
  argv: readonly string[];
  cwd: string;
  errorPrefix: string;
}): EnvMaterializeKit_UiLaunchOptions {
  let projectRoot = options.cwd;

  for (let index = 0; index < options.argv.length; index += 1) {
    const current = options.argv[index];

    if (current === "--help" || current === "-h") {
      return { helpRequested: true, projectRoot };
    }

    if (current === "--cwd") {
      const nextValue = options.argv[index + 1];
      if (!nextValue) {
        throw new Error("--cwd requires a value.");
      }
      projectRoot = nextValue;
      index += 1;
      continue;
    }

    throw new Error(`${options.errorPrefix} Unknown option '${current}'.`);
  }

  return { helpRequested: false, projectRoot };
}

/** Formats stable help text for env-materialize UI launchers. */
export function EnvMaterializeKit_formatUiHelpText(options: {
  invocation: string;
  title: string;
}): string {
  return `Usage: ${options.invocation} -- [options]

${options.title}. Non-interactive automation should use:
  npm run env:workspace -- --mode <mode> --workspace <path> --logical-environment <id> [options]

Options:
  --cwd <path>   Default workspace path and working directory for spawned npm (default: process.cwd())
  --help         Show this help output.
`;
}

/** Optional stdout/stderr sinks for env-materialize UI child processes. */
export type EnvMaterializeKit_UiSpawnHandlers = {
  onStderrChunk?: (chunk: string) => void;
  onStdoutChunk?: (chunk: string) => void;
};

/** Spawns `npx tsx <script>` from a project root and accumulates stdout/stderr until exit. */
export function EnvMaterializeKit_spawnNpxTsxOnce(options: {
  argv: readonly string[];
  handlers?: EnvMaterializeKit_UiSpawnHandlers;
  projectRoot: string;
  scriptRelativePath: string;
}): {
  promise: Promise<{ status: number; stderr: string; stdout: string }>;
  cancel: () => void;
} {
  const scriptAbs = path.join(options.projectRoot, options.scriptRelativePath);
  const child = spawn("npx", ["tsx", scriptAbs, ...options.argv], {
    cwd: options.projectRoot,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    stdout += text;
    options.handlers?.onStdoutChunk?.(text);
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    stderr += text;
    options.handlers?.onStderrChunk?.(text);
  });

  const promise = new Promise<{
    status: number;
    stderr: string;
    stdout: string;
  }>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ status: code ?? 1, stderr, stdout });
    });
  });

  return {
    promise,
    cancel: () => {
      child.kill("SIGTERM");
    },
  };
}

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
type EnvMaterializeKit_InkSpawnedProcess = ChildProcessByStdio<
  null,
  Readable,
  Readable
>;

/** Injectable spawn surface matching Node streaming stdio for tests and adapters. */
interface EnvMaterializeKit_InkSpawnProcess {
  (
    command: string,
    args: string[],
    options: {
      cwd: string;
      detached: boolean;
      env: NodeJS.ProcessEnv;
      stdio: ["ignore", "pipe", "pipe"];
    },
  ): EnvMaterializeKit_InkSpawnedProcess;
}

/** Hooks invoked as the bridged subprocess starts and emits output lines. */
type EnvMaterializeKit_InkCliTaskCallbacks = {
  readonly onLine: (line: EnvMaterializeKit_InkCliSessionLine) => void;
  readonly onStarted: (startedAt: string) => void;
};

/** Wraps emitted text with its originating stream channel. */
function EnvMaterializeKit_createInkLine(
  source: EnvMaterializeKit_InkCliSessionLineSource,
  text: string,
): EnvMaterializeKit_InkCliSessionLine {
  return { source, text };
}

/** Emits complete newline-terminated lines and retains a trailing partial fragment. */
function EnvMaterializeKit_appendInkChunkLines(options: {
  readonly chunk: string;
  readonly existingBuffer: string;
  readonly lines: EnvMaterializeKit_InkCliSessionLine[];
  readonly emitLine: (line: EnvMaterializeKit_InkCliSessionLine) => void;
  readonly source: EnvMaterializeKit_InkCliSessionLineSource;
}): string {
  let buffer = options.existingBuffer + options.chunk;

  while (true) {
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex === -1) {
      break;
    }

    const rawLine = buffer.slice(0, newlineIndex).replace(/\r$/, "");
    buffer = buffer.slice(newlineIndex + 1);
    const line = EnvMaterializeKit_createInkLine(options.source, rawLine);
    options.lines.push(line);
    options.emitLine(line);
  }

  return buffer;
}

/** Emits one final line after stream close when the buffer still holds text. */
function EnvMaterializeKit_flushInkBufferedLine(options: {
  readonly buffer: string;
  readonly lines: EnvMaterializeKit_InkCliSessionLine[];
  readonly emitLine: (line: EnvMaterializeKit_InkCliSessionLine) => void;
  readonly source: EnvMaterializeKit_InkCliSessionLineSource;
}): void {
  const trimmed = options.buffer.replace(/\r$/, "");
  if (trimmed.length === 0) {
    return;
  }

  const line = EnvMaterializeKit_createInkLine(options.source, trimmed);
  options.lines.push(line);
  options.emitLine(line);
}

/** Sends `signal` to the child, using process-group kill when available. */
function EnvMaterializeKit_stopInkChildProcess(options: {
  readonly child: EnvMaterializeKit_InkSpawnedProcess;
  readonly signal: NodeJS.Signals;
  readonly useProcessGroup: boolean;
}): void {
  try {
    if (options.useProcessGroup && typeof options.child.pid === "number") {
      process.kill(-options.child.pid, options.signal);
      return;
    }

    options.child.kill(options.signal);
  } catch (error) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : null;
    if (code === "ESRCH") {
      return;
    }

    throw error;
  }
}

/** Spawns a cancelable child process for Ink apps and streams stdout/stderr as line records. */
export function EnvMaterializeKit_startInkCliTaskProcess(options: {
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
} {
  const spawnProcess =
    options.dependencies?.spawnProcess ??
    ((command, args, spawnOptions) => spawn(command, args, spawnOptions));
  const useProcessGroup = process.platform !== "win32";
  const child = spawnProcess(options.command, [...options.args], {
    cwd: options.projectRoot,
    detached: useProcessGroup,
    env: options.env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const lines: EnvMaterializeKit_InkCliSessionLine[] = [];
  const startedAt = new Date().toISOString();
  let stdoutBuffer = "";
  let stderrBuffer = "";
  let cancelled = false;
  let closed = false;
  let forceKillTimer: NodeJS.Timeout | null = null;

  options.callbacks.onStarted(startedAt);

  const promise = new Promise<EnvMaterializeKit_InkCliTaskExecutionResult>(
    (resolve, reject) => {
      child.stdout.on("data", (chunk: Buffer | string) => {
        stdoutBuffer = EnvMaterializeKit_appendInkChunkLines({
          chunk: chunk.toString(),
          existingBuffer: stdoutBuffer,
          lines,
          emitLine: options.callbacks.onLine,
          source: "stdout",
        });
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderrBuffer = EnvMaterializeKit_appendInkChunkLines({
          chunk: chunk.toString(),
          existingBuffer: stderrBuffer,
          lines,
          emitLine: options.callbacks.onLine,
          source: "stderr",
        });
      });

      child.once("error", (error) => {
        reject(error);
      });

      child.once("close", (exitCode, signal) => {
        closed = true;
        if (forceKillTimer) {
          clearTimeout(forceKillTimer);
          forceKillTimer = null;
        }
        EnvMaterializeKit_flushInkBufferedLine({
          buffer: stdoutBuffer,
          lines,
          emitLine: options.callbacks.onLine,
          source: "stdout",
        });
        EnvMaterializeKit_flushInkBufferedLine({
          buffer: stderrBuffer,
          lines,
          emitLine: options.callbacks.onLine,
          source: "stderr",
        });
        resolve({
          status: cancelled
            ? "cancelled"
            : exitCode === 0
              ? "succeeded"
              : "failed",
          exitCode,
          signal,
          lines,
          startedAt,
          endedAt: new Date().toISOString(),
        });
      });
    },
  );

  return {
    promise,
    lines,
    startedAt,
    cancel() {
      cancelled = true;
      if (closed) {
        return;
      }

      EnvMaterializeKit_stopInkChildProcess({
        child,
        signal: "SIGTERM",
        useProcessGroup,
      });
      forceKillTimer = setTimeout(() => {
        if (closed) {
          return;
        }
        EnvMaterializeKit_stopInkChildProcess({
          child,
          signal: "SIGKILL",
          useProcessGroup,
        });
      }, 2000);
      forceKillTimer.unref?.();
    },
  };
}
