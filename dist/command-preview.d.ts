/**
 * @fileoverview Product-neutral shell quoting and command-preview formatting helpers.
 *
 * Flow: configured command prefix + argv tokens -> pasteable shell command preview.
 *
 * @testing Node test runner: npm run env-materialize-kit:test
 *
 * @see packages/env-materialize-kit/src/index.ts - Kit barrel re-exports this module as `@gg-utils/env-materialize-kit/command-preview` for scripts and UI surfaces.
 * @see scripts/env-materialize/ui/lib/format-env-command.ts - Env-materialize Ink UI adapter that calls `EnvMaterializeKit_formatCommandPreview` to render pasteable argv lines.
 * @see packages/env-materialize-kit/src/command-preview.unit.test.ts - Node test module that locks shell-quoting escapes and prefix plus argv joining behavior.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Returns a shell-safe single-quoted string, or empty quotes for an empty token. */
export declare function EnvMaterializeKit_shellQuote(value: string): string;
/** Formats a configured command prefix plus shell-quoted argv into one preview line. */
export declare function EnvMaterializeKit_formatCommandPreview(options: {
    argv: readonly string[];
    commandPrefix: readonly string[];
}): string;
//# sourceMappingURL=command-preview.d.ts.map