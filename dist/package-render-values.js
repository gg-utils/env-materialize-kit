/**
 * @fileoverview Product-neutral seed merge helpers for package env rendering.
 *
 * Flow: raw seed maps + configured filters + scoped override labels -> accumulated env values.
 *
 * @testing Node test runner (tsx): cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/package-render-values.unit.test.ts
 *
 * @see packages/env-materialize-kit/src/package-render-values.unit.test.ts - Node test module that locks scoped-override parsing and filtered raw-seed merge behavior owned by this helper surface.
 * @see packages/env-materialize-kit/src/index.ts - Kit barrel that re-exports these merge helpers on the public @gg-utils/env-materialize-kit aggregate entrypoint.
 * @see env-materialize.config.ts - Root env-materialize configuration that calls EnvMaterializeKit_applyRawPackageSeedValues while assembling per-package rendered env values.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Parses a configured scoped seed override key into its target package and inner key. */
export function EnvMaterializeKit_parseScopedSeedOverrideKey(options) {
    if (!options.key.startsWith(options.scopedOverride.prefix)) {
        return null;
    }
    const separatorIndex = options.key.indexOf(options.scopedOverride.separator, options.scopedOverride.prefix.length);
    if (separatorIndex < 0) {
        throw new Error(`[env-materialize] Invalid scoped override key ${options.key}. ` +
            `Expected ${options.scopedOverride.prefix}<LABEL>` +
            `${options.scopedOverride.separator}<KEY>.`);
    }
    const label = options.key.slice(options.scopedOverride.prefix.length, separatorIndex);
    const targetKey = options.key
        .slice(separatorIndex + options.scopedOverride.separator.length)
        .trim();
    const packageId = options.scopedOverride.packageIdByLabel.get(label);
    if (packageId === undefined) {
        throw new Error(`[env-materialize] Unsupported scoped override label: ${label}.`);
    }
    if (targetKey.length === 0) {
        throw new Error(`[env-materialize] Invalid scoped override key ${options.key}. ` +
            "Missing target env key.");
    }
    return {
        packageId,
        targetKey,
    };
}
/** Merges one raw seed map into a package env value map using configured filters. */
export function EnvMaterializeKit_applyRawPackageSeedValues(options) {
    for (const [key, value] of options.sourceValues.entries()) {
        if (options.metadataKeys.has(key)) {
            continue;
        }
        if (options.ignoredKeyPrefixes.some((prefix) => key.startsWith(prefix))) {
            continue;
        }
        if (options.ignoredKeys.has(key)) {
            continue;
        }
        if (value.trim().length === 0) {
            continue;
        }
        const scopedOverride = EnvMaterializeKit_parseScopedSeedOverrideKey({
            key,
            scopedOverride: options.scopedOverride,
        });
        if (scopedOverride !== null) {
            if (scopedOverride.packageId === options.packageId) {
                options.valuesByKey.set(scopedOverride.targetKey, value);
            }
            continue;
        }
        options.valuesByKey.set(key, value);
    }
}
/** Reads a non-empty string map value, returning null for missing or blank values. */
export function EnvMaterializeKit_getNonEmptyStringMapValue(options) {
    const value = options.source.get(options.key);
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }
    return value;
}
/** Sets one map entry only when the value is present. */
export function EnvMaterializeKit_setMapValueIfPresent(options) {
    if (typeof options.value === "string") {
        options.valuesByKey.set(options.key, options.value);
    }
}
//# sourceMappingURL=package-render-values.js.map