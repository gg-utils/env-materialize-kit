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
import fs from "node:fs";
import { EnvMaterialize_readEnvDocument } from "@gg-utils/env-materialize-core/env-document";
/** Lists sorted, non-hidden directory names under `machineOverridesDirPath`. */
export function EnvMaterializeKit_listMachineProfileNames(options) {
    if (!fs.existsSync(options.machineOverridesDirPath)) {
        return [];
    }
    return fs
        .readdirSync(options.machineOverridesDirPath, {
        withFileTypes: true,
    })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name)
        .sort();
}
/** Resolves the active machine profile name, or null when no profile can be inferred. */
export function EnvMaterializeKit_resolveMachineProfile(options) {
    if (typeof options.explicitMachineProfile === "string") {
        return options.explicitMachineProfile;
    }
    if (options.machineProfileNames.length === 0) {
        return null;
    }
    const developerSlug = options.existingValues.get(options.developerSlugKey);
    if (typeof developerSlug === "string" &&
        options.machineProfileNames.includes(developerSlug)) {
        return developerSlug;
    }
    if (options.machineProfileNames.length === 1) {
        return options.machineProfileNames[0] ?? null;
    }
    return null;
}
/** Reads a dotenv-style file into values, or an empty map when the file does not exist. */
export function EnvMaterializeKit_readOptionalEnvFile(options) {
    if (!fs.existsSync(options.filePath)) {
        return new Map();
    }
    return EnvMaterialize_readEnvDocument(options.filePath).valuesByKey;
}
/** Loads one required seed file plus optional machine override and default seed maps. */
export function EnvMaterializeKit_loadSeedFiles(options) {
    const fileExists = options.fileExists ?? fs.existsSync;
    if (!fileExists(options.requiredSeedFilePath)) {
        throw new Error(`[env-materialize] Missing ${options.requiredSeedFileDescription}: ` +
            options.requiredSeedFilePath);
    }
    const machineProfile = EnvMaterializeKit_resolveMachineProfile({
        developerSlugKey: options.developerSlugKey,
        existingValues: options.existingValues,
        ...(options.explicitMachineProfile === undefined ? {} : { explicitMachineProfile: options.explicitMachineProfile }),
        machineProfileNames: EnvMaterializeKit_listMachineProfileNames({
            machineOverridesDirPath: options.machineOverridesDirPath,
        }),
    });
    const machineOverrideFilePath = machineProfile === null
        ? null
        : options.machineOverrideFilePathForProfile({ machineProfile });
    return {
        machineOverrideFilePath,
        machineOverrideValues: machineOverrideFilePath === null
            ? new Map()
            : EnvMaterializeKit_readOptionalEnvFile({
                filePath: machineOverrideFilePath,
            }),
        machineProfile,
        requiredSeedFile: options.loadRequiredSeedFile({
            filePath: options.requiredSeedFilePath,
        }),
        requiredSeedFilePath: options.requiredSeedFilePath,
        seedDefaultValues: EnvMaterializeKit_readOptionalEnvFile({
            filePath: options.seedDefaultsFilePath,
        }),
    };
}
