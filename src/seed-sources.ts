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

import { parseEnv } from "node:util";

import { EnvMaterializeKit_resolveMachineProfile } from "./seed-files.js";

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
export type EnvMaterializeKit_SeedSourceFactory = (
  config: EnvMaterializeKit_SeedSourceConfig,
) => EnvMaterializeKit_SeedSource;

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
export class EnvMaterializeKit_MissingSeedLayerError extends Error {
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
  constructor(options: { layerId: string; relativePath: string; sourceDescription: string }) {
    super(
      `[env-materialize] Missing required seed layer ${options.layerId}: ` +
        `${options.relativePath} in ${options.sourceDescription}`,
    );
    this.name = "EnvMaterializeKit_MissingSeedLayerError";
    this.layerId = options.layerId;
  }
}

/**
 * Reads a file as UTF-8, or returns null when it does not exist.
 *
 * @param absolutePath - File to read.
 * @returns The text, or null.
 * @example
 * ```typescript
 * EnvMaterializeKit_readSeedTextFile("/workspace/.seeds/environments/local.env");
 * ```
 */
function EnvMaterializeKit_readSeedTextFile(absolutePath: string): string | null {
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;
}

/**
 * Lists the sorted names of non-hidden child folders. Symlinked folders are not listed.
 *
 * @param absolutePath - Folder to list.
 * @returns Folder names, or an empty list when the folder is absent.
 * @example
 * ```typescript
 * EnvMaterializeKit_listSeedDirectoryNames("/workspace/.seeds/machines");
 * ```
 */
function EnvMaterializeKit_listSeedDirectoryNames(absolutePath: string): string[] {
  return fs.existsSync(absolutePath)
    ? fs
        .readdirSync(absolutePath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name)
        .sort()
    : [];
}

/**
 * Resolves every symlink in a path. For a path that does not exist, resolves the nearest
 * existing ancestor and appends the remaining segments.
 *
 * @param absolutePath - Absolute path.
 * @returns The canonical path.
 * @example
 * ```typescript
 * EnvMaterializeKit_realPathOfNearestExisting("/tmp/seeds/missing.env"); // "/private/tmp/seeds/missing.env" on macOS
 * ```
 */
export function EnvMaterializeKit_realPathOfNearestExisting(absolutePath: string): string {
  const pending: string[] = [];
  let current = path.resolve(absolutePath);
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(current), ...pending.reverse());
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const parent = path.dirname(current);
      if ((code !== "ENOENT" && code !== "ENOTDIR") || parent === current) {
        throw error;
      }
      pending.push(path.basename(current));
      current = parent;
    }
  }
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
export function EnvMaterializeKit_nodeSeedFileSystem(): EnvMaterializeKit_SeedFileSystem {
  return {
    readTextFile: EnvMaterializeKit_readSeedTextFile,
    listDirectoryNames: EnvMaterializeKit_listSeedDirectoryNames,
    realPath: EnvMaterializeKit_realPathOfNearestExisting,
  };
}

/**
 * Tells whether a path is the root itself or lies inside it.
 *
 * @param rootPath - Absolute root.
 * @param candidate - Absolute path to test.
 * @returns True when `candidate` is inside `rootPath`.
 * @example
 * ```typescript
 * EnvMaterializeKit_isPathInside("/seeds", "/seeds/a.env"); // true
 * EnvMaterializeKit_isPathInside("/seeds", "/seeds-other/a.env"); // false
 * ```
 */
export function EnvMaterializeKit_isPathInside(rootPath: string, candidate: string): boolean {
  const relative = path.relative(rootPath, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

/**
 * Resolves a source-relative path and refuses paths that escape the source root, both
 * lexically and after resolving symlinks, so neither a layout typo nor a symlink can read a
 * file outside the seed folder. The check runs before anything is read.
 *
 * @param options - Root, relative path and file access.
 * @param options.rootPath - Absolute root of the source.
 * @param options.relativePath - Path relative to the root.
 * @param options.fileSystem - File access whose `realPath` resolves symlinks.
 * @returns The absolute path inside the root.
 * @throws Error when the path is absolute or escapes the root, lexically or through a symlink.
 * @example
 * ```typescript
 * EnvMaterializeKit_resolveInsideRoot({ rootPath: "/seeds", relativePath: "a.env", fileSystem });
 * ```
 */
function EnvMaterializeKit_resolveInsideRoot(options: {
  rootPath: string;
  relativePath: string;
  fileSystem: EnvMaterializeKit_SeedFileSystem;
}): string {
  const { rootPath, relativePath, fileSystem } = options;
  if (path.isAbsolute(relativePath)) {
    throw new Error(`[env-materialize] Seed path must be relative: ${relativePath}`);
  }
  const resolved = path.resolve(rootPath, relativePath);
  if (!EnvMaterializeKit_isPathInside(rootPath, resolved)) {
    throw new Error(`[env-materialize] Seed path escapes the source root: ${relativePath}`);
  }
  if (fileSystem.realPath !== undefined) {
    const realRoot = fileSystem.realPath(rootPath);
    const realTarget = fileSystem.realPath(resolved);
    if (!EnvMaterializeKit_isPathInside(realRoot, realTarget)) {
      throw new Error(
        `[env-materialize] Seed path resolves outside the source root through a symlink: ${relativePath}`,
      );
    }
  }
  return resolved;
}

/**
 * Creates a seed source backed by a folder on this machine. Seed files are read with Node's
 * dotenv grammar (`util.parseEnv`). Every path is checked against the root before reading,
 * lexically and with symlinks resolved.
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
export function EnvMaterializeKit_createDirectorySeedSource(options: {
  rootPath: string;
  fileSystem?: EnvMaterializeKit_SeedFileSystem;
}): EnvMaterializeKit_SeedSource {
  const fileSystem = options.fileSystem ?? EnvMaterializeKit_nodeSeedFileSystem();
  const rootPath = path.resolve(options.rootPath);
  return {
    kind: "directory",
    description: rootPath,
    readEnvFile: (relativePath) => {
      const text = fileSystem.readTextFile(
        EnvMaterializeKit_resolveInsideRoot({ rootPath, relativePath, fileSystem }),
      );
      if (text === null) {
        return null;
      }
      const values = new Map<string, string>();
      for (const [key, value] of Object.entries(parseEnv(text))) {
        values.set(key, value ?? "");
      }
      return values;
    },
    listDirectories: (relativePath) =>
      fileSystem.listDirectoryNames(
        EnvMaterializeKit_resolveInsideRoot({ rootPath, relativePath, fileSystem }),
      ),
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
export function EnvMaterializeKit_createSeedSource(options: {
  config: EnvMaterializeKit_SeedSourceConfig;
  factories: ReadonlyMap<string, EnvMaterializeKit_SeedSourceFactory>;
}): EnvMaterializeKit_SeedSource {
  const factory = options.factories.get(options.config.kind);
  if (factory === undefined) {
    const known = [...options.factories.keys()].sort().join(", ");
    throw new Error(
      `[env-materialize] Unknown seed source kind ${options.config.kind}. Known kinds: ${known}`,
    );
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
 * @example
 * ```typescript
 * const layers = EnvMaterializeKit_loadSeedLayers({
 *   source,
 *   layers: [{ id: "environment", relativePath: "environments/local.env", required: true }],
 * });
 * layers[0]?.present; // true
 * ```
 */
export function EnvMaterializeKit_loadSeedLayers(options: {
  source: EnvMaterializeKit_SeedSource;
  layers: readonly EnvMaterializeKit_SeedLayerDefinition[];
}): EnvMaterializeKit_SeedLayer[] {
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
      valuesByKey: values ?? new Map<string, string>(),
    };
  });
}

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
export function EnvMaterializeKit_mergeSeedLayers(
  layers: readonly EnvMaterializeKit_SeedLayer[],
): EnvMaterializeKit_MergedSeedValues {
  const valuesByKey = new Map<string, string>();
  const layerIdByKey = new Map<string, string>();
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
 * @example
 * ```typescript
 * EnvMaterializeKit_selectSeedMachineProfile({ source, machineOverridesPath: "machines" });
 * // { machineProfile: "laptop", machineProfileNames: ["laptop"] } when only one folder exists
 * ```
 */
export function EnvMaterializeKit_selectSeedMachineProfile(options: {
  source: EnvMaterializeKit_SeedSource;
  machineOverridesPath: string;
  explicitMachineProfile?: string;
}): { machineProfile: string | null; machineProfileNames: string[] } {
  const machineProfileNames = options.source.listDirectories(options.machineOverridesPath);
  if (
    options.explicitMachineProfile !== undefined &&
    !machineProfileNames.includes(options.explicitMachineProfile)
  ) {
    throw new Error(
      `[env-materialize] No machine override folder ${options.explicitMachineProfile} ` +
        `under ${options.machineOverridesPath} in ${options.source.description}`,
    );
  }
  const machineProfile = EnvMaterializeKit_resolveMachineProfile({
    developerSlugKey: "",
    existingValues: new Map<string, string>(),
    ...(options.explicitMachineProfile === undefined
      ? {}
      : { explicitMachineProfile: options.explicitMachineProfile }),
    machineProfileNames,
  });
  return { machineProfile, machineProfileNames };
}
