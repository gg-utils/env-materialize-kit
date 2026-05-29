/**
 * @fileoverview Product-neutral helper primitives for env-materialize UI adapters.
 *
 * Flow: form field strings + configured target defaults + mutation results -> CLI values and
 * summary lines.
 *
 * @example
 * ```typescript
 * import {
 *   EnvMaterializeKit_formatMutationSummaryLines,
 *   EnvMaterializeKit_targetsFromChoice,
 * } from "./ui-helpers.js";
 *
 * const targets = EnvMaterializeKit_targetsFromChoice({
 *   choice: "all",
 *   defaultTargets: ["app", "worker"],
 * });
 * const lines = EnvMaterializeKit_formatMutationSummaryLines([
 *   { changed: true, filePath: "/tmp/.env.app", status: "wrote" },
 * ]);
 * ```
 *
 * @testing Node test: cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/ui-helpers.unit.test.ts
 *
 * @see packages/env-materialize-kit/src/ink-wizard-model.ts - Ink wizard view model that imports `EnvMaterializeKit_TargetsChoice` from this module when mapping wizard target selections to selector rows.
 * @see packages/env-materialize-kit/src/ui-helpers.unit.test.ts - Node test suite that asserts field parsing, path resolution, target expansion, and mutation summary formatting owned here.
 * @see packages/env-materialize-kit/README.md - Package README that documents the `./ui-helpers` export surface and how kit UI helpers fit the env-materialize CLI stack.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** UI target chooser value where `all` expands to configured target defaults. */
export type EnvMaterializeKit_TargetsChoice<Target extends string> = "all" | Target;
/** Minimal mutation result shape needed for UI summaries. */
export type EnvMaterializeKit_MutationSummaryInput = {
    changed: boolean;
    filePath: string;
    status: string;
};
/** Expands an `all` target chooser to default targets, otherwise returns the selected target. */
export declare function EnvMaterializeKit_targetsFromChoice<Target extends string>(options: {
    choice: EnvMaterializeKit_TargetsChoice<Target>;
    defaultTargets: readonly Target[];
}): Target[];
/** Parses a blank-or-positive-integer UI form field. */
export declare function EnvMaterializeKit_parseOptionalPositiveIntegerField(options: {
    label: string;
    rawValue: string;
}): number | undefined;
/** Returns a trimmed non-empty string field value, or `undefined` for blanks. */
export declare function EnvMaterializeKit_resolveOptionalTrimmedStringField(rawValue: string): string | undefined;
/** Resolves a path-like UI field relative to the caller cwd, or omits blank input. */
export declare function EnvMaterializeKit_resolveOptionalPathField(options: {
    currentWorkingDirectory: string;
    rawValue: string;
}): string | undefined;
/** Formats write results into stable summary lines for CLI and preview screens. */
export declare function EnvMaterializeKit_formatMutationSummaryLines(results: readonly EnvMaterializeKit_MutationSummaryInput[]): string[];
//# sourceMappingURL=ui-helpers.d.ts.map