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
  value: string | null | undefined,
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
export function EnvMaterializeKit_buildValueMap(options: {
  entries: readonly EnvMaterializeKit_ValueEntry[];
}): Map<string, string> {
  const valuesByKey = new Map<string, string>();
  EnvMaterializeKit_applyValueEntries({
    entries: options.entries,
    valuesByKey,
  });
  return valuesByKey;
}

/** Applies optional entries to an existing value map. */
export function EnvMaterializeKit_applyValueEntries(options: {
  entries: readonly EnvMaterializeKit_ValueEntry[];
  valuesByKey: Map<string, string>;
}): void {
  for (const [key, value] of options.entries) {
    if (typeof value === "string" && value.length > 0) {
      options.valuesByKey.set(key, value);
    }
  }
}

/** Applies direct source-map projections, skipping missing or blank source values. */
export function EnvMaterializeKit_applyMapValueProjections(options: {
  projections: readonly EnvMaterializeKit_MapValueProjection[];
  sourceValues: ReadonlyMap<string, string>;
  valuesByKey: Map<string, string>;
}): void {
  for (const projection of options.projections) {
    const value = options.sourceValues.get(projection.sourceKey);
    if (typeof value === "string" && value.trim().length > 0) {
      options.valuesByKey.set(projection.targetKey, value);
    }
  }
}

/** Applies exact-value conditional projections from a source map. */
export function EnvMaterializeKit_applyConditionalMapValueProjections(options: {
  projections: readonly EnvMaterializeKit_ConditionalMapValueProjection[];
  sourceValues: ReadonlyMap<string, string>;
  valuesByKey: Map<string, string>;
}): void {
  for (const projection of options.projections) {
    const value = options.sourceValues.get(projection.sourceKey);
    for (const projectionCase of projection.cases) {
      if (value === projectionCase.sourceValue) {
        EnvMaterializeKit_applyValueEntries({
          entries: projectionCase.entries,
          valuesByKey: options.valuesByKey,
        });
      }
    }
  }
}

/** Resolves one key from ordered source maps using first non-empty trimmed value semantics. */
export function EnvMaterializeKit_resolveProjectedMapValue(options: {
  key: string;
  sourceValues: readonly ReadonlyMap<string, string>[];
}): string | undefined {
  for (const sourceValueMap of options.sourceValues) {
    const value = sourceValueMap.get(options.key);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

/** Resolves same-name key projections from ordered source maps onto a value map. */
export function EnvMaterializeKit_applyResolvedMapValueProjections(options: {
  keys: readonly string[];
  sourceValues: readonly ReadonlyMap<string, string>[];
  valuesByKey: Map<string, string>;
}): void {
  for (const key of options.keys) {
    const value = EnvMaterializeKit_resolveProjectedMapValue({
      key,
      sourceValues: options.sourceValues,
    });
    if (value !== undefined) {
      options.valuesByKey.set(key, value);
    }
  }
}

/**
 * Collects present values for configured keys from ordered source maps, with later maps winning.
 */
export function EnvMaterializeKit_collectMapValues<Key extends string>(options: {
  keys: readonly Key[];
  sourceValues: readonly ReadonlyMap<string, string>[];
}): Map<Key, string> {
  const valuesByKey = new Map<Key, string>();

  for (const sourceMap of options.sourceValues) {
    for (const key of options.keys) {
      const value = sourceMap.get(key);
      if (typeof value !== "string" || value.trim().length === 0) {
        continue;
      }
      valuesByKey.set(key, value);
    }
  }

  return valuesByKey;
}
