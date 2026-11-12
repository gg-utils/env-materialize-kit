/**
 * @fileoverview Key-level check and write for env files that a tool manages only in part.
 *
 * Many env files mix keys a tool owns (hostnames, ports, origins) with keys it must not
 * touch (database URLs, secrets typed by hand). This module compares and writes only the
 * managed keys. Every other line stays byte for byte. Results carry key names and statuses
 * only, never values, so they are safe to print and log.
 *
 * Check mode is read-only and reports which managed keys would be added or changed. Write
 * mode computes the same diff, then writes only when something changes. A key listed as
 * preserved with no desired value (for example a secret the seeds do not hold) is left as
 * it is and reported as kept.
 *
 * Flow: desired values + preserved key names + current file -> name-only diff -> optional write.
 *
 * @example
 * ```typescript
 * const result = EnvMaterializeKit_checkManagedEnvFile({
 *   filePath: "/app/.env.local",
 *   desiredValues: new Map([["APP_ORIGIN", "https://app.example.test"]]),
 *   preservedKeys: ["SESSION_SECRET"],
 * });
 * for (const line of EnvMaterializeKit_formatManagedKeyResult(result)) console.log(line);
 * ```
 *
 * @testing Node test unit: npm test runs src/managed-keys.unit.test.ts.
 * @see src/value-table.ts - Produces the desired values.
 * @see src/write-target-file.ts - Whole-file write modes for files a tool owns entirely.
 * @see src/managed-keys.unit.test.ts - Tests for the diff, write merge and value-free output.
 */
/** File access for managed env files, injectable so tests need no disk. */
export type EnvMaterializeKit_ManagedFileSystem = {
    /** Returns the UTF-8 text of a file, or null when it does not exist. */
    readTextFile: (filePath: string) => string | null;
    /** Writes UTF-8 text, creating parent folders; `mode` applies only when creating the file. */
    writeTextFile: (filePath: string, content: string, options: {
        mode: number;
    }) => void;
};
/** Name-only comparison of desired managed values with a file's current values. */
export type EnvMaterializeKit_ManagedKeyDiff = {
    /** Managed keys absent from the file, sorted. */
    added: string[];
    /** Managed keys whose current value differs from the desired value, sorted. */
    changed: string[];
    /** Managed keys whose current value already matches, sorted. */
    unchanged: string[];
    /** Preserved keys with no desired value, left as they are, sorted. */
    kept: string[];
};
/** Status of one managed env file. */
export type EnvMaterializeKit_ManagedFileStatus = "missing" | "drift" | "unchanged" | "created" | "updated";
/** Value-free result for one managed env file. */
export type EnvMaterializeKit_ManagedFileResult = {
    /** Path of the env file. */
    filePath: string;
    /** Check statuses are `missing`, `drift` and `unchanged`; write adds `created` and `updated`. */
    status: EnvMaterializeKit_ManagedFileStatus;
    /** Whether the file was written. Always false in check mode. */
    written: boolean;
    /** Name-only diff. */
    diff: EnvMaterializeKit_ManagedKeyDiff;
};
/** Inputs shared by check and write. */
export type EnvMaterializeKit_ManagedEnvFileOptions = {
    /** Path of the env file. */
    filePath: string;
    /** Desired values for managed keys. Secrets may appear here when the seeds hold them. */
    desiredValues: ReadonlyMap<string, string>;
    /** Keys to leave as they are when they have no desired value, such as secrets. */
    preservedKeys?: readonly string[];
    /** File access; defaults to `node:fs`. */
    fileSystem?: EnvMaterializeKit_ManagedFileSystem;
};
/**
 * Returns the node file system adapter used when no test double is injected.
 *
 * @returns File access backed by `node:fs`.
 */
export declare function EnvMaterializeKit_nodeManagedFileSystem(): EnvMaterializeKit_ManagedFileSystem;
/**
 * Compares desired managed values with current values by name.
 *
 * @param options - Current values, desired values and preserved keys.
 * @param options.currentValues - Values parsed from the file, or null when it is absent.
 * @param options.desiredValues - Desired values for managed keys.
 * @param options.preservedKeys - Keys left as they are when they have no desired value.
 * @returns Sorted key names per category; never values.
 * @example
 * ```typescript
 * EnvMaterializeKit_diffManagedKeys({
 *   currentValues: new Map([["A", "1"]]),
 *   desiredValues: new Map([["A", "2"], ["B", "3"]]),
 * }); // { added: ["B"], changed: ["A"], unchanged: [], kept: [] }
 * ```
 */
export declare function EnvMaterializeKit_diffManagedKeys(options: {
    currentValues: ReadonlyMap<string, string> | null;
    desiredValues: ReadonlyMap<string, string>;
    preservedKeys?: readonly string[];
}): EnvMaterializeKit_ManagedKeyDiff;
/**
 * Renders the next file content by changing only added and changed managed keys. Every
 * other line, including comments, quoting and unmanaged keys, is kept as it was.
 *
 * @param options - Current content and desired values.
 * @param options.currentContent - Current file text, or null when the file is absent.
 * @param options.desiredValues - Desired values for managed keys.
 * @param options.preservedKeys - Keys left as they are when they have no desired value.
 * @returns The next content and the name-only diff.
 * @throws Error when a desired value holds a line break.
 */
export declare function EnvMaterializeKit_renderManagedEnvContent(options: {
    currentContent: string | null;
    desiredValues: ReadonlyMap<string, string>;
    preservedKeys?: readonly string[];
}): {
    content: string;
    diff: EnvMaterializeKit_ManagedKeyDiff;
};
/**
 * Checks a managed env file without writing anything.
 *
 * @param options - File path, desired values, preserved keys and optional file system.
 * @returns `missing`, `drift` or `unchanged`, with the name-only diff.
 * @throws Error when a desired value holds a line break, or when reading fails.
 * @example
 * ```typescript
 * EnvMaterializeKit_checkManagedEnvFile({ filePath: ".env.local", desiredValues: new Map() });
 * ```
 */
export declare function EnvMaterializeKit_checkManagedEnvFile(options: EnvMaterializeKit_ManagedEnvFileOptions): EnvMaterializeKit_ManagedFileResult;
/**
 * Writes managed keys into an env file, creating it with owner-only permissions when absent.
 * Nothing is written when every managed key already matches.
 *
 * @param options - File path, desired values, preserved keys and optional file system.
 * @returns `created`, `updated` or `unchanged`, with the name-only diff.
 * @throws Error when a desired value holds a line break, or when reading or writing fails.
 * @example
 * ```typescript
 * EnvMaterializeKit_writeManagedEnvFile({
 *   filePath: "/tmp/copy/.env.local",
 *   desiredValues: new Map([["APP_ORIGIN", "https://app.example.test"]]),
 * });
 * ```
 */
export declare function EnvMaterializeKit_writeManagedEnvFile(options: EnvMaterializeKit_ManagedEnvFileOptions): EnvMaterializeKit_ManagedFileResult;
/**
 * Formats a managed file result as printable lines: status and path, then key names per
 * category. It never prints values.
 *
 * @param result - Result from check or write.
 * @param label - Optional target label printed before the path.
 * @returns Lines ready to print.
 * @example
 * ```typescript
 * EnvMaterializeKit_formatManagedKeyResult(result, "web");
 * // ["[env-materialize] unchanged web /app/.env.local", "  unchanged: APP_ORIGIN"]
 * ```
 */
export declare function EnvMaterializeKit_formatManagedKeyResult(result: EnvMaterializeKit_ManagedFileResult, label?: string): string[];
