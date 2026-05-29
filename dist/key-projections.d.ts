/**
 * @fileoverview Product-neutral key/value projection helpers for env renderers.
 *
 * Flow: configured value entries + source maps + projection rules -> rendered env value map.
 *
 * @testing Package: `npm run env-materialize-kit:test`.
 *
 * @see packages/env-materialize-kit/src/key-projections.unit.test.ts - Node test module that locks value-map seeding, direct and conditional map projections, first-hit resolution, and collect semantics for the helpers owned here.
 * @see env-materialize.config.ts - Root env-materialize config that applies these projection helpers while merging source maps into per-target rendered env value maps.
 * @see packages/env-materialize-kit/src/index.ts - Package barrel that re-exports this module for `@gg-utils/env-materialize-kit` consumers wiring env materialization from the workspace root.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** One optional key/value entry that can seed or augment an env value map. */
export type EnvMaterializeKit_ValueEntry = readonly [
    key: string,
    value: string | null | undefined
];
/** Direct projection from one source key to one target key. */
export type EnvMaterializeKit_MapValueProjection = {
    sourceKey: string;
    targetKey: string;
};
/** Conditional projection entries to write when a source key equals `sourceValue`. */
export type EnvMaterializeKit_ConditionalMapValueProjectionCase = {
    entries: readonly EnvMaterializeKit_ValueEntry[];
    sourceValue: string;
};
/** Conditional source-key projection with one or more exact-value cases. */
export type EnvMaterializeKit_ConditionalMapValueProjection = {
    cases: readonly EnvMaterializeKit_ConditionalMapValueProjectionCase[];
    sourceKey: string;
};
/** Builds a value map from entries with present, non-empty values. */
export declare function EnvMaterializeKit_buildValueMap(options: {
    entries: readonly EnvMaterializeKit_ValueEntry[];
}): Map<string, string>;
/** Applies optional entries to an existing value map. */
export declare function EnvMaterializeKit_applyValueEntries(options: {
    entries: readonly EnvMaterializeKit_ValueEntry[];
    valuesByKey: Map<string, string>;
}): void;
/** Applies direct source-map projections, skipping missing or blank source values. */
export declare function EnvMaterializeKit_applyMapValueProjections(options: {
    projections: readonly EnvMaterializeKit_MapValueProjection[];
    sourceValues: ReadonlyMap<string, string>;
    valuesByKey: Map<string, string>;
}): void;
/** Applies exact-value conditional projections from a source map. */
export declare function EnvMaterializeKit_applyConditionalMapValueProjections(options: {
    projections: readonly EnvMaterializeKit_ConditionalMapValueProjection[];
    sourceValues: ReadonlyMap<string, string>;
    valuesByKey: Map<string, string>;
}): void;
/** Resolves one key from ordered source maps using first non-empty trimmed value semantics. */
export declare function EnvMaterializeKit_resolveProjectedMapValue(options: {
    key: string;
    sourceValues: readonly ReadonlyMap<string, string>[];
}): string | undefined;
/** Resolves same-name key projections from ordered source maps onto a value map. */
export declare function EnvMaterializeKit_applyResolvedMapValueProjections(options: {
    keys: readonly string[];
    sourceValues: readonly ReadonlyMap<string, string>[];
    valuesByKey: Map<string, string>;
}): void;
/**
 * Collects present values for configured keys from ordered source maps, with later maps winning.
 */
export declare function EnvMaterializeKit_collectMapValues<Key extends string>(options: {
    keys: readonly Key[];
    sourceValues: readonly ReadonlyMap<string, string>[];
}): Map<Key, string>;
//# sourceMappingURL=key-projections.d.ts.map