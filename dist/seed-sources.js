/**
 * @fileoverview Pluggable seed sources and ordered seed layers for env materialization.
 *
 * A seed source is where private seed files live: a folder in the workspace today, maybe a
 * private repository checkout or a vault export later. Adapters describe their seed layout
 * as an ordered list of layers (for example a logical environment, shared defaults, then a
 * machine override). Loading reads each layer through the source, and merging applies them
 * in order so later layers win. Switching where seeds live is a change of source config,
 * not of adapter code.
 *
 * Flow: source config -> seed source -> ordered layer definitions -> loaded layers -> merged
 * values with the id of the layer that supplied each key.
 *
 * @example
 * ```typescript
 * const source = EnvMaterializeKit_createDirectorySeedSource({ rootPath: "/workspace/.seeds" });
 * const layers = EnvMaterializeKit_loadSeedLayers({
 *   source,
 *   layers: [
 *     { id: "environment", relativePath: "environments/local.env", required: true },
 *     { id: "machine", relativePath: "machines/laptop/overrides.env", required: false },
 *   ],
 * });
 * const merged = EnvMaterializeKit_mergeSeedLayers(layers);
 * ```
 *
 * @testing Node test unit: npm test runs src/seed-sources.unit.test.ts.
 * @see src/seed-files.ts - Older fixed-layout seed loader; this module generalizes its layering.
 * @see src/value-table.ts - Resolves rendered keys from the merged seed values.
 * @see src/seed-sources.unit.test.ts - Tests for sources, layering and machine profiles.
 */
import fs from "node:fs";
import path from "node:path";
import { EnvMaterialize_parseEnvDocument } from "@gg-utils/env-materialize-core/env-document";
import { EnvMaterializeKit_resolveMachineProfile } from "./seed-files.js";
/** Error raised when a required seed layer is absent. Its message names paths, never values. */
export class EnvMaterializeKit_MissingSeedLayerError extends Error {
    /** Id of the missing layer. */
    layerId;
    /**
     * Creates the error for one missing required layer.
     *
     * @param options - The layer id, its relative path and the source description.
     * @param options.layerId - Id of the missing layer.
     * @param options.relativePath - Path of the layer relative to the source.
     * @param options.sourceDescription - Printable location of the seed source.
     */
    constructor(options) {
        super(`[env-materialize] Missing required seed layer ${options.layerId}: ` +
            `${options.relativePath} in ${options.sourceDescription}`);
        this.name = "EnvMaterializeKit_MissingSeedLayerError";
        this.layerId = options.layerId;
    }
}
/**
 * Returns the node file system adapter used when no test double is injected.
 *
 * @returns File access backed by `node:fs`.
 */
export function EnvMaterializeKit_nodeSeedFileSystem() {
    return {
        readTextFile: (absolutePath) => fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null,
        listDirectoryNames: (absolutePath) => fs.existsSync(absolutePath)
            ? fs
                .readdirSync(absolutePath, { withFileTypes: true })
                .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
                .map((entry) => entry.name)
                .sort()
            : [],
    };
}
/**
 * Resolves a source-relative path and refuses paths that escape the source root, so a
 * layout typo can never read a file outside the seed folder.
 *
 * @param rootPath - Absolute root of the source.
 * @param relativePath - Path relative to the root.
 * @returns The absolute path inside the root.
 * @throws Error when the path is absolute or escapes the root.
 */
function EnvMaterializeKit_resolveInsideRoot(rootPath, relativePath) {
    if (path.isAbsolute(relativePath)) {
        throw new Error(`[env-materialize] Seed path must be relative: ${relativePath}`);
    }
    const resolved = path.resolve(rootPath, relativePath);
    const relative = path.relative(rootPath, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`[env-materialize] Seed path escapes the source root: ${relativePath}`);
    }
    return resolved;
}
/**
 * Creates a seed source backed by a folder on this machine.
 *
 * @param options - The folder and optional file system double.
 * @param options.rootPath - Absolute path of the seed folder.
 * @param options.fileSystem - File access; defaults to `node:fs`.
 * @returns A seed source of kind `directory`.
 * @example
 * ```typescript
 * const source = EnvMaterializeKit_createDirectorySeedSource({ rootPath: "/workspace/.seeds" });
 * source.readEnvFile("environments/local.env");
 * ```
 */
export function EnvMaterializeKit_createDirectorySeedSource(options) {
    const fileSystem = options.fileSystem ?? EnvMaterializeKit_nodeSeedFileSystem();
    const rootPath = path.resolve(options.rootPath);
    return {
        kind: "directory",
        description: rootPath,
        readEnvFile: (relativePath) => {
            const text = fileSystem.readTextFile(EnvMaterializeKit_resolveInsideRoot(rootPath, relativePath));
            return text === null ? null : EnvMaterialize_parseEnvDocument(text).valuesByKey;
        },
        listDirectories: (relativePath) => fileSystem.listDirectoryNames(EnvMaterializeKit_resolveInsideRoot(rootPath, relativePath)),
    };
}
/**
 * Builds a seed source from config using a registry of factories per kind. Adding a new
 * kind of source means registering one more factory; selecting it is a config change.
 *
 * @param options - The config and the registry.
 * @param options.config - Source config whose `kind` selects the factory.
 * @param options.factories - Factories keyed by kind.
 * @returns The built source.
 * @throws Error when no factory is registered for the kind.
 * @example
 * ```typescript
 * const source = EnvMaterializeKit_createSeedSource({
 *   config: { kind: "directory", path: "/private/seeds" },
 *   factories: new Map([["directory", (config) =>
 *     EnvMaterializeKit_createDirectorySeedSource({ rootPath: String(config["path"]) })]]),
 * });
 * ```
 */
export function EnvMaterializeKit_createSeedSource(options) {
    const factory = options.factories.get(options.config.kind);
    if (factory === undefined) {
        const known = [...options.factories.keys()].sort().join(", ");
        throw new Error(`[env-materialize] Unknown seed source kind ${options.config.kind}. Known kinds: ${known}`);
    }
    return factory(options.config);
}
/**
 * Loads ordered seed layers through a source.
 *
 * @param options - The source and the layer definitions.
 * @param options.source - Where seed files are read from.
 * @param options.layers - Layers in precedence order, lowest first.
 * @returns Loaded layers in the same order.
 * @throws EnvMaterializeKit_MissingSeedLayerError when a required layer is absent.
 */
export function EnvMaterializeKit_loadSeedLayers(options) {
    return options.layers.map((definition) => {
        const values = options.source.readEnvFile(definition.relativePath);
        if (values === null && definition.required) {
            throw new EnvMaterializeKit_MissingSeedLayerError({
                layerId: definition.id,
                relativePath: definition.relativePath,
                sourceDescription: options.source.description,
            });
        }
        return {
            id: definition.id,
            relativePath: definition.relativePath,
            present: values !== null,
            valuesByKey: values ?? new Map(),
        };
    });
}
/**
 * Merges loaded layers in order. Later layers win, and a blank value never overrides a
 * value from an earlier layer, so a machine override can leave a key empty to inherit it.
 *
 * @param layers - Loaded layers, lowest precedence first.
 * @returns Final values and the id of the layer that supplied each one.
 */
export function EnvMaterializeKit_mergeSeedLayers(layers) {
    const valuesByKey = new Map();
    const layerIdByKey = new Map();
    for (const layer of layers) {
        for (const [key, value] of layer.valuesByKey) {
            if (value.trim().length === 0) {
                continue;
            }
            valuesByKey.set(key, value);
            layerIdByKey.set(key, layer.id);
        }
    }
    return { valuesByKey, layerIdByKey };
}
/**
 * Selects the machine profile whose overrides apply: the explicit one when given, else the
 * only profile folder when exactly one exists, else none.
 *
 * @param options - The source, the overrides folder and an optional explicit profile.
 * @param options.source - Where seed files are read from.
 * @param options.machineOverridesPath - Folder, relative to the source, holding one folder per machine.
 * @param options.explicitMachineProfile - Profile chosen by the caller, if any.
 * @returns The selected profile and every profile found.
 * @throws Error when the explicit profile has no folder, so a typo is not silently ignored.
 */
export function EnvMaterializeKit_selectSeedMachineProfile(options) {
    const machineProfileNames = options.source.listDirectories(options.machineOverridesPath);
    if (options.explicitMachineProfile !== undefined &&
        !machineProfileNames.includes(options.explicitMachineProfile)) {
        throw new Error(`[env-materialize] No machine override folder ${options.explicitMachineProfile} ` +
            `under ${options.machineOverridesPath} in ${options.source.description}`);
    }
    const machineProfile = EnvMaterializeKit_resolveMachineProfile({
        developerSlugKey: "",
        existingValues: new Map(),
        ...(options.explicitMachineProfile === undefined
            ? {}
            : { explicitMachineProfile: options.explicitMachineProfile }),
        machineProfileNames,
    });
    return { machineProfile, machineProfileNames };
}
