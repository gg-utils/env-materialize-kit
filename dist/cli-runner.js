/**
 * @fileoverview Reusable CLI run loop for config-driven env materialization commands.
 *
 * Flow: raw argv + project parser + project runner -> formatted stdout lines and stable exit code.
 * The package owns help handling, result printing, and check-mode drift/missing failure policy while
 * project configs continue to own accepted flags, usage text, and file-rendering behavior.
 *
 * @testing CLI: npm run env-materialize-kit:test
 *
 * @see packages/env-materialize-kit/src/cli-runner.unit.test.ts - Node test module that asserts help, happy-path printing, and check-mode exit codes for EnvMaterializeKit_runCli.
 * @see env-materialize.config.ts - Platform env-materialize config that injects parse/run/format delegates into EnvMaterializeKit_runCli for the root materialization workflow.
 * @see packages/env-materialize-kit/src/write-target-file.ts - Target mutation result contract whose drift and missing statuses drive check-mode failures in this run loop.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Returns true when a check-mode result should make the CLI fail. */
export function EnvMaterializeKit_isCheckModeFailureResult(result) {
    return result.status === "drift" || result.status === "missing";
}
/** Runs a config-bound env-materialize CLI and returns the desired process exit code. */
export function EnvMaterializeKit_runCli(options) {
    const parseResult = options.parseCliArgs({
        argv: options.argv,
        currentWorkingDirectory: options.currentWorkingDirectory,
    });
    if (parseResult.kind === "help") {
        options.writeLine(options.usageText);
        return 0;
    }
    const runResult = options.run(parseResult.options);
    for (const line of options.formatResultLines(runResult.results)) {
        options.writeLine(line);
    }
    if (parseResult.options.mode === "check" &&
        runResult.results.some(EnvMaterializeKit_isCheckModeFailureResult)) {
        return 1;
    }
    return 0;
}
