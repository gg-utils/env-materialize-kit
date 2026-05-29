/**
 * @fileoverview Product-neutral file and value helpers for env materialization contexts.
 *
 * Flow: optional file inputs + scalar precedence lists + temporary environment snapshots ->
 * deterministic values for project adapters.
 *
 * @testing Node test: npm run env-materialize-kit:test
 *
 * @see packages/env-materialize-kit/src/workspace-values.unit.test.ts - Node test module that asserts optional text/JSON reads, precedence chains, mapped fallbacks, trailing path cleanup, positive-integer resolution, and temporary process.env overlays for the helpers exported from this file.
 * @see env-materialize.config.ts - Root env-materialize adapter that imports these helpers when wiring workspace seed reads, scalar resolution, path normalization, and temporary process.env snapshots for consumer target rendering.
 * @see packages/env-materialize-kit/src/index.ts - Package barrel that re-exports this module so consumers can reach the same helpers through the aggregate `@gg-utils/env-materialize-kit` entry surface.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Reads a text file when it exists, trims it, and returns null for missing or blank files. */
export declare function EnvMaterializeKit_readOptionalTrimmedTextFile(options: {
    filePath: string;
}): string | null;
/** Reads a nested JSON string or finite number value from an optional JSON file. */
export declare function EnvMaterializeKit_readOptionalNestedJsonScalar(options: {
    fieldPath: readonly string[];
    filePath: string;
}): string | null;
/** Chooses the first non-empty trimmed string from a precedence list, then default value. */
export declare function EnvMaterializeKit_resolveFirstNonEmptyString(options: {
    defaultValue?: string;
    values: readonly (string | null | undefined)[];
}): string;
/** Resolves a key from direct sources first, then through a fallback-key map and source map. */
export declare function EnvMaterializeKit_resolveMappedFallbackValue(options: {
    directSources: readonly ReadonlyMap<string, string>[];
    fallbackKeyByKey: Readonly<Record<string, string>>;
    fallbackSource: ReadonlyMap<string, string>;
    key: string;
}): string | undefined;
/** Chooses the first strictly positive integer from numeric or string candidates. */
export declare function EnvMaterializeKit_resolvePositiveInteger(options: {
    defaultValue: number;
    values: readonly (number | string | null | undefined)[];
}): number;
/** Removes a trailing path segment when a candidate path ends with that segment. */
export declare function EnvMaterializeKit_removeTrailingPathSegment(options: {
    candidatePath: string;
    segmentName: string;
}): string;
/** Runs a callback while `process.env` is temporarily overlaid with caller-provided values. */
export declare function EnvMaterializeKit_withTemporaryProcessEnv<T>(options: {
    callback: () => T;
    envSnapshot: Record<string, string>;
}): T;
//# sourceMappingURL=workspace-values.d.ts.map