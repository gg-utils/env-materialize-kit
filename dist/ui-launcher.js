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
import { spawn } from "node:child_process";
import path from "node:path";
/** Parses `--help`/`-h` and `--cwd <path>` flags for env-materialize UI launchers. */
export function EnvMaterializeKit_parseUiLaunchOptions(options) {
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
export function EnvMaterializeKit_formatUiHelpText(options) {
    return `Usage: ${options.invocation} -- [options]

${options.title}. Non-interactive automation should use:
  npm run env:workspace -- --mode <mode> --workspace <path> --logical-environment <id> [options]

Options:
  --cwd <path>   Default workspace path and working directory for spawned npm (default: process.cwd())
  --help         Show this help output.
`;
}
/** Spawns `npx tsx <script>` from a project root and accumulates stdout/stderr until exit. */
export function EnvMaterializeKit_spawnNpxTsxOnce(options) {
    const scriptAbs = path.join(options.projectRoot, options.scriptRelativePath);
    const child = spawn("npx", ["tsx", scriptAbs, ...options.argv], {
        cwd: options.projectRoot,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        stdout += text;
        options.handlers?.onStdoutChunk?.(text);
    });
    child.stderr?.on("data", (chunk) => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        stderr += text;
        options.handlers?.onStderrChunk?.(text);
    });
    const promise = new Promise((resolve, reject) => {
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
/** Wraps emitted text with its originating stream channel. */
function EnvMaterializeKit_createInkLine(source, text) {
    return { source, text };
}
/** Emits complete newline-terminated lines and retains a trailing partial fragment. */
function EnvMaterializeKit_appendInkChunkLines(options) {
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
function EnvMaterializeKit_flushInkBufferedLine(options) {
    const trimmed = options.buffer.replace(/\r$/, "");
    if (trimmed.length === 0) {
        return;
    }
    const line = EnvMaterializeKit_createInkLine(options.source, trimmed);
    options.lines.push(line);
    options.emitLine(line);
}
/** Sends `signal` to the child, using process-group kill when available. */
function EnvMaterializeKit_stopInkChildProcess(options) {
    try {
        if (options.useProcessGroup && typeof options.child.pid === "number") {
            process.kill(-options.child.pid, options.signal);
            return;
        }
        options.child.kill(options.signal);
    }
    catch (error) {
        const code = error instanceof Error && "code" in error ? String(error.code) : null;
        if (code === "ESRCH") {
            return;
        }
        throw error;
    }
}
/** Spawns a cancelable child process for Ink apps and streams stdout/stderr as line records. */
export function EnvMaterializeKit_startInkCliTaskProcess(options) {
    const spawnProcess = options.dependencies?.spawnProcess ??
        ((command, args, spawnOptions) => spawn(command, args, spawnOptions));
    const useProcessGroup = process.platform !== "win32";
    const child = spawnProcess(options.command, [...options.args], {
        cwd: options.projectRoot,
        detached: useProcessGroup,
        env: options.env ?? process.env,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const lines = [];
    const startedAt = new Date().toISOString();
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let cancelled = false;
    let closed = false;
    let forceKillTimer = null;
    options.callbacks.onStarted(startedAt);
    const promise = new Promise((resolve, reject) => {
        child.stdout.on("data", (chunk) => {
            stdoutBuffer = EnvMaterializeKit_appendInkChunkLines({
                chunk: chunk.toString(),
                existingBuffer: stdoutBuffer,
                lines,
                emitLine: options.callbacks.onLine,
                source: "stdout",
            });
        });
        child.stderr.on("data", (chunk) => {
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
    });
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
