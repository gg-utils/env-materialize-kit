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
/** Parsed scoped override key routed to one target package. */
export type EnvMaterializeKit_ScopedSeedOverride<PackageId extends string> = {
    packageId: PackageId;
    targetKey: string;
};
/** Config for parsing scoped seed override keys. */
export type EnvMaterializeKit_ScopedSeedOverrideConfig<PackageId extends string> = {
    packageIdByLabel: ReadonlyMap<string, PackageId>;
    prefix: string;
    separator: string;
};
/** Options for merging one raw seed map into a target package value map. */
export type EnvMaterializeKit_ApplyRawPackageSeedValues_Options<PackageId extends string> = {
    ignoredKeyPrefixes: readonly string[];
    ignoredKeys: ReadonlySet<string>;
    metadataKeys: ReadonlySet<string>;
    packageId: PackageId;
    scopedOverride: EnvMaterializeKit_ScopedSeedOverrideConfig<PackageId>;
    sourceValues: ReadonlyMap<string, string>;
    valuesByKey: Map<string, string>;
};
/** Parses a configured scoped seed override key into its target package and inner key. */
export declare function EnvMaterializeKit_parseScopedSeedOverrideKey<PackageId extends string>(options: {
    key: string;
    scopedOverride: EnvMaterializeKit_ScopedSeedOverrideConfig<PackageId>;
}): EnvMaterializeKit_ScopedSeedOverride<PackageId> | null;
/** Merges one raw seed map into a package env value map using configured filters. */
export declare function EnvMaterializeKit_applyRawPackageSeedValues<PackageId extends string>(options: EnvMaterializeKit_ApplyRawPackageSeedValues_Options<PackageId>): void;
/** Reads a non-empty string map value, returning null for missing or blank values. */
export declare function EnvMaterializeKit_getNonEmptyStringMapValue(options: {
    key: string;
    source: ReadonlyMap<string, string>;
}): string | null;
/** Sets one map entry only when the value is present. */
export declare function EnvMaterializeKit_setMapValueIfPresent(options: {
    key: string;
    value: string | null;
    valuesByKey: Map<string, string>;
}): void;
//# sourceMappingURL=package-render-values.d.ts.map