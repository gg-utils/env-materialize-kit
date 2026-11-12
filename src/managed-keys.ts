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

import fs from "node:fs";
import path from "node:path";

import {
  EnvMaterialize_parseEnvDocument,
  EnvMaterialize_renderDocument,
} from "@gg-utils/env-materialize-core/env-document";

/** File access for managed env files, injectable so tests need no disk. */
export type EnvMaterializeKit_ManagedFileSystem = {
  /** Returns the UTF-8 text of a file, or null when it does not exist. */
  readTextFile: (filePath: string) => string | null;
  /** Writes UTF-8 text, creating parent folders; `mode` applies only when creating the file. */
  writeTextFile: (filePath: string, content: string, options: { mode: number }) => void;
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
export type EnvMaterializeKit_ManagedFileStatus =
  | "missing"
  | "drift"
  | "unchanged"
  | "created"
  | "updated";

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
export function EnvMaterializeKit_nodeManagedFileSystem(): EnvMaterializeKit_ManagedFileSystem {
  return {
    readTextFile: (filePath) =>
      fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null,
    writeTextFile: (filePath, content, options) => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, { encoding: "utf8", mode: options.mode });
    },
  };
}

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
export function EnvMaterializeKit_diffManagedKeys(options: {
  currentValues: ReadonlyMap<string, string> | null;
  desiredValues: ReadonlyMap<string, string>;
  preservedKeys?: readonly string[];
}): EnvMaterializeKit_ManagedKeyDiff {
  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  for (const [key, desired] of options.desiredValues) {
    const current = options.currentValues?.get(key);
    if (current === undefined) {
      added.push(key);
    } else if (current === desired) {
      unchanged.push(key);
    } else {
      changed.push(key);
    }
  }
  const kept = (options.preservedKeys ?? []).filter((key) => !options.desiredValues.has(key));
  return {
    added: added.sort(),
    changed: changed.sort(),
    unchanged: unchanged.sort(),
    kept: [...new Set(kept)].sort(),
  };
}

/**
 * Refuses values that would break the line-based env format.
 *
 * @param desiredValues - Desired values to validate.
 * @throws Error naming the key, never the value, when a value holds a line break.
 */
function EnvMaterializeKit_assertSingleLineValues(desiredValues: ReadonlyMap<string, string>): void {
  for (const [key, value] of desiredValues) {
    if (/[\r\n]/u.test(value)) {
      throw new Error(`[env-materialize] Value for ${key} must be a single line`);
    }
  }
}

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
export function EnvMaterializeKit_renderManagedEnvContent(options: {
  currentContent: string | null;
  desiredValues: ReadonlyMap<string, string>;
  preservedKeys?: readonly string[];
}): { content: string; diff: EnvMaterializeKit_ManagedKeyDiff } {
  EnvMaterializeKit_assertSingleLineValues(options.desiredValues);
  const document = EnvMaterialize_parseEnvDocument(options.currentContent ?? "");
  const diff = EnvMaterializeKit_diffManagedKeys({
    currentValues: options.currentContent === null ? null : document.valuesByKey,
    desiredValues: options.desiredValues,
    ...(options.preservedKeys === undefined ? {} : { preservedKeys: options.preservedKeys }),
  });
  const updates = new Map<string, string>();
  for (const key of [...diff.added, ...diff.changed]) {
    updates.set(key, options.desiredValues.get(key) ?? "");
  }
  if (updates.size === 0 && options.currentContent !== null) {
    return { content: options.currentContent, diff };
  }
  const rendered = EnvMaterialize_renderDocument({ document, valuesByKey: updates });
  return { content: options.currentContent === null ? rendered.replace(/^\n+/u, "") : rendered, diff };
}

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
export function EnvMaterializeKit_checkManagedEnvFile(
  options: EnvMaterializeKit_ManagedEnvFileOptions,
): EnvMaterializeKit_ManagedFileResult {
  const fileSystem = options.fileSystem ?? EnvMaterializeKit_nodeManagedFileSystem();
  const currentContent = fileSystem.readTextFile(options.filePath);
  const { diff } = EnvMaterializeKit_renderManagedEnvContent({
    currentContent,
    desiredValues: options.desiredValues,
    ...(options.preservedKeys === undefined ? {} : { preservedKeys: options.preservedKeys }),
  });
  const drift = diff.added.length > 0 || diff.changed.length > 0;
  return {
    filePath: options.filePath,
    status: currentContent === null ? "missing" : drift ? "drift" : "unchanged",
    written: false,
    diff,
  };
}

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
export function EnvMaterializeKit_writeManagedEnvFile(
  options: EnvMaterializeKit_ManagedEnvFileOptions,
): EnvMaterializeKit_ManagedFileResult {
  const fileSystem = options.fileSystem ?? EnvMaterializeKit_nodeManagedFileSystem();
  const currentContent = fileSystem.readTextFile(options.filePath);
  const { content, diff } = EnvMaterializeKit_renderManagedEnvContent({
    currentContent,
    desiredValues: options.desiredValues,
    ...(options.preservedKeys === undefined ? {} : { preservedKeys: options.preservedKeys }),
  });
  if (currentContent !== null && content === currentContent) {
    return { filePath: options.filePath, status: "unchanged", written: false, diff };
  }
  fileSystem.writeTextFile(options.filePath, content, { mode: 0o600 });
  return {
    filePath: options.filePath,
    status: currentContent === null ? "created" : "updated",
    written: true,
    diff,
  };
}

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
export function EnvMaterializeKit_formatManagedKeyResult(
  result: EnvMaterializeKit_ManagedFileResult,
  label?: string,
): string[] {
  const head = ["[env-materialize]", result.status, label, result.filePath]
    .filter((part) => part !== undefined)
    .join(" ");
  const lines = [head];
  for (const category of ["added", "changed", "unchanged", "kept"] as const) {
    const names = result.diff[category];
    if (names.length > 0) {
      lines.push(`  ${category}: ${names.join(", ")}`);
    }
  }
  return lines;
}
