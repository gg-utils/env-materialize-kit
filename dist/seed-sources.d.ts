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
import { type EnvMaterializeKit_ContainedReadOptions, type EnvMaterializeKit_ContainmentHooks, EnvMaterializeKit_isPathInside, EnvMaterializeKit_realPathOfNearestExisting } from "./contained-paths.js";
export { EnvMaterializeKit_isPathInside, EnvMaterializeKit_realPathOfNearestExisting };
/** Minimal file access a directory seed source needs, injectable so tests need no disk. */
export type EnvMaterializeKit_SeedFileSystem = {
    /** Returns the UTF-8 text of a file, or null when the file does not exist. */
    readTextFile: (absolutePath: string) => string | null;
    /** Returns the sorted names of non-hidden child directories, or an empty list when absent. */
    listDirectoryNames: (absolutePath: string) => string[];
    /**
     * Returns the canonical path with every symlink resolved. For a path that does not exist,
     * resolves its nearest existing ancestor and appends the rest. Containment checks compare
     * these paths, so a symlink cannot lead a read outside the seed root. A double without it
     * is treated as having no symlinks.
     */
    realPath?: (absolutePath: string) => string;
    /**
     * Reads a file that must stay inside a root, holding against a folder or file swapped for
     * a symlink during the read (see `EnvMaterializeKit_readContainedTextFile`). When present,
     * seed reads use it instead of `readTextFile`. The node adapter provides it; a custom port
     * that reads real files should pass `EnvMaterializeKit_readContainedTextFile` here.
     */
    readContainedTextFile?: (options: EnvMaterializeKit_ContainedReadOptions) => string | null;
};
/**
 * A place seed files are read from. Implementations never expose values through
 * `description`, which is safe to print.
 */
export type EnvMaterializeKit_SeedSource = {
    /** Stable kind of the source, for example `directory`. */
    readonly kind: string;
    /** Printable location of the source, such as a folder path. It never contains values. */
    readonly description: string;
    /** Reads one dotenv-style seed file by its path relative to the source, or null when absent. */
    readEnvFile: (relativePath: string) => Map<string, string> | null;
    /** Lists child directory names at a relative path, sorted, or an empty list when absent. */
    listDirectories: (relativePath: string) => string[];
};
/** Config that selects and parameterizes one seed source kind. */
export type EnvMaterializeKit_SeedSourceConfig = {
    /** Registered kind of the source to build. */
    kind: string;
    /** Kind-specific settings, such as a folder path. */
    [setting: string]: unknown;
};
/** Builds a seed source from its config; registered per kind by the adapter. */
export type EnvMaterializeKit_SeedSourceFactory = (config: EnvMaterializeKit_SeedSourceConfig) => EnvMaterializeKit_SeedSource;
/** One layer of a seed layout, read in the order given. */
export type EnvMaterializeKit_SeedLayerDefinition = {
    /** Stable id of the layer, reported as the origin of each key it supplies. */
    id: string;
    /** Path of the layer's file relative to the seed source. */
    relativePath: string;
    /** Whether loading fails when the file is absent. */
    required: boolean;
};
/** A loaded seed layer. */
export type EnvMaterializeKit_SeedLayer = {
    /** Id of the layer definition. */
    id: string;
    /** Path of the layer's file relative to the seed source. */
    relativePath: string;
    /** Whether the file existed. */
    present: boolean;
    /** Values read from the file; empty when the file is absent. */
    valuesByKey: ReadonlyMap<string, string>;
};
/** Merged values from ordered seed layers. */
export type EnvMaterializeKit_MergedSeedValues = {
    /** Final value per key; later layers win and blank values never override. */
    valuesByKey: Map<string, string>;
    /** Id of the layer that supplied each final value. */
    layerIdByKey: Map<string, string>;
};
/**
 * Error raised when a required seed layer is absent. Its message names paths, never values.
 *
 * @example
 * ```typescript
 * try { EnvMaterializeKit_loadSeedLayers({ source, layers }); }
 * catch (error) { if (error instanceof EnvMaterializeKit_MissingSeedLayerError) console.error(error.layerId); }
 * ```
 */
export declare class EnvMaterializeKit_MissingSeedLayerError extends Error {
    /** Id of the missing layer. */
    readonly layerId: string;
    /**
     * Creates the error for one missing required layer.
     *
     * @param options - The layer id, its relative path and the source description.
     * @param options.layerId - Id of the missing layer.
     * @param options.relativePath - Path of the layer relative to the source.
     * @param options.sourceDescription - Printable location of the seed source.
     */
    constructor(options: {
        layerId: string;
        relativePath: string;
        sourceDescription: string;
    });
}
/**
 * Returns the node file system adapter used when no test double is injected.
 *
 * @returns File access backed by `node:fs`, including symlink resolution.
 * @example
 * ```typescript
 * const fileSystem = EnvMaterializeKit_nodeSeedFileSystem();
 * fileSystem.listDirectoryNames("/workspace/.seeds/machines");
 * ```
 */
export declare function EnvMaterializeKit_nodeSeedFileSystem(): EnvMaterializeKit_SeedFileSystem;
/**
 * Creates a seed source backed by a folder on this machine. Seed files are read with Node's
 * dotenv grammar (`util.parseEnv`). Every path is checked against the root before reading,
 * lexically and with symlinks resolved. With the node adapter (the default), reads also hold
 * against a folder or file swapped for a symlink between the check and the read, and a
 * listing is checked again after it was taken.
 *
 * @param options - The folder and optional file system double.
 * @param options.rootPath - Absolute path of the seed folder.
 * @param options.fileSystem - File access; defaults to `node:fs`.
 * @param options.containmentHooks - Test seams passed to contained reads; leave out in real use.
 * @returns A seed source of kind `directory`.
 * @example
 * ```typescript
 * const source = EnvMaterializeKit_createDirectorySeedSource({ rootPath: "/workspace/.seeds" });
 * source.readEnvFile("environments/local.env");
 * ```
 */
export declare function EnvMaterializeKit_createDirectorySeedSource(options: {
    rootPath: string;
    fileSystem?: EnvMaterializeKit_SeedFileSystem;
    containmentHooks?: EnvMaterializeKit_ContainmentHooks;
}): EnvMaterializeKit_SeedSource;
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
export declare function EnvMaterializeKit_createSeedSource(options: {
    config: EnvMaterializeKit_SeedSourceConfig;
    factories: ReadonlyMap<string, EnvMaterializeKit_SeedSourceFactory>;
}): EnvMaterializeKit_SeedSource;
/**
 * Loads ordered seed layers through a source.
 *
 * @param options - The source and the layer definitions.
 * @param options.source - Where seed files are read from.
 * @param options.layers - Layers in precedence order, lowest first.
 * @returns Loaded layers in the same order.
 * @throws EnvMaterializeKit_MissingSeedLayerError when a required layer is absent.
 * @example
 * ```typescript
 * const layers = EnvMaterializeKit_loadSeedLayers({
 *   source,
 *   layers: [{ id: "environment", relativePath: "environments/local.env", required: true }],
 * });
 * layers[0]?.present; // true
 * ```
 */
export declare function EnvMaterializeKit_loadSeedLayers(options: {
    source: EnvMaterializeKit_SeedSource;
    layers: readonly EnvMaterializeKit_SeedLayerDefinition[];
}): EnvMaterializeKit_SeedLayer[];
/**
 * Merges loaded layers in order. Later layers win, and a blank value never overrides a
 * value from an earlier layer, so a machine override can leave a key empty to inherit it.
 *
 * @param layers - Loaded layers, lowest precedence first.
 * @returns Final values and the id of the layer that supplied each one.
 * @example
 * ```typescript
 * const merged = EnvMaterializeKit_mergeSeedLayers([
 *   { id: "base", relativePath: "base.env", present: true, valuesByKey: new Map([["A", "1"], ["B", "2"]]) },
 *   { id: "machine", relativePath: "m.env", present: true, valuesByKey: new Map([["A", "3"], ["B", ""]]) },
 * ]);
 * merged.valuesByKey; // Map { "A" => "3", "B" => "2" }
 * merged.layerIdByKey.get("A"); // "machine"
 * ```
 */
export declare function EnvMaterializeKit_mergeSeedLayers(layers: readonly EnvMaterializeKit_SeedLayer[]): EnvMaterializeKit_MergedSeedValues;
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
 * @example
 * ```typescript
 * EnvMaterializeKit_selectSeedMachineProfile({ source, machineOverridesPath: "machines" });
 * // { machineProfile: "laptop", machineProfileNames: ["laptop"] } when only one folder exists
 * ```
 */
export declare function EnvMaterializeKit_selectSeedMachineProfile(options: {
    source: EnvMaterializeKit_SeedSource;
    machineOverridesPath: string;
    explicitMachineProfile?: string;
}): {
    machineProfile: string | null;
    machineProfileNames: string[];
};
