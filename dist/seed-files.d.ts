/**
 * @fileoverview Product-neutral helpers for optional env seed files and machine-profile selection.
 *
 * Flow: explicit directories/files + existing values -> optional seed maps and selected profile.
 *
 * @testing Node test unit: npm run test --prefix packages/env-materialize-kit from repository root runs the tsx-backed Node test harness that includes target-files.unit.test.ts.
 *
 * @see packages/env-materialize-core/src/env-document.ts - Dotenv document reader used when optional seed paths exist so key/value maps stay aligned with env-document parsing rules.
 * @see env-materialize.config.ts - Root materialize config that wires EnvMaterializeKit_loadSeedFiles with project-specific required seed, machine override, and defaults paths.
 * @see packages/env-materialize-kit/src/target-files.unit.test.ts - Node test regression module that exercises EnvMaterializeKit_loadSeedFiles alongside provider-aligned target contracts.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Options for listing machine profile directory names from an explicit directory path. */
export type EnvMaterializeKit_ListMachineProfileNames_Options = {
    machineOverridesDirPath: string;
};
/** Options for selecting an active machine profile from explicit candidates and env values. */
export type EnvMaterializeKit_ResolveMachineProfile_Options = {
    developerSlugKey: string;
    existingValues: ReadonlyMap<string, string>;
    explicitMachineProfile?: string;
    machineProfileNames: readonly string[];
};
/** Options for reading an optional dotenv-style seed file. */
export type EnvMaterializeKit_ReadOptionalEnvFile_Options = {
    filePath: string;
};
/** Required seed payload supplied by a project-owned loader callback. */
export type EnvMaterializeKit_RequiredSeedFile<ScopedPackageId extends string> = {
    scopedOverrideValuesByPackageId: Map<ScopedPackageId, Map<string, string>>;
    valuesByKey: Map<string, string>;
};
/** Options for loading a required seed plus optional machine and default seed files. */
export type EnvMaterializeKit_LoadSeedFiles_Options<ScopedPackageId extends string> = {
    developerSlugKey: string;
    existingValues: ReadonlyMap<string, string>;
    explicitMachineProfile?: string;
    fileExists?: (filePath: string) => boolean;
    loadRequiredSeedFile: (options: {
        filePath: string;
    }) => EnvMaterializeKit_RequiredSeedFile<ScopedPackageId>;
    machineOverrideFilePathForProfile: (options: {
        machineProfile: string;
    }) => string;
    machineOverridesDirPath: string;
    requiredSeedFileDescription: string;
    requiredSeedFilePath: string;
    seedDefaultsFilePath: string;
};
/** Loaded seed maps and metadata returned by the package-owned seed loader. */
export type EnvMaterializeKit_LoadSeedFilesResult<ScopedPackageId extends string> = {
    machineOverrideFilePath: string | null;
    machineOverrideValues: Map<string, string>;
    machineProfile: string | null;
    requiredSeedFile: EnvMaterializeKit_RequiredSeedFile<ScopedPackageId>;
    requiredSeedFilePath: string;
    seedDefaultValues: Map<string, string>;
};
/** Lists sorted, non-hidden directory names under `machineOverridesDirPath`. */
export declare function EnvMaterializeKit_listMachineProfileNames(options: EnvMaterializeKit_ListMachineProfileNames_Options): string[];
/** Resolves the active machine profile name, or null when no profile can be inferred. */
export declare function EnvMaterializeKit_resolveMachineProfile(options: EnvMaterializeKit_ResolveMachineProfile_Options): string | null;
/** Reads a dotenv-style file into values, or an empty map when the file does not exist. */
export declare function EnvMaterializeKit_readOptionalEnvFile(options: EnvMaterializeKit_ReadOptionalEnvFile_Options): Map<string, string>;
/** Loads one required seed file plus optional machine override and default seed maps. */
export declare function EnvMaterializeKit_loadSeedFiles<ScopedPackageId extends string>(options: EnvMaterializeKit_LoadSeedFiles_Options<ScopedPackageId>): EnvMaterializeKit_LoadSeedFilesResult<ScopedPackageId>;
