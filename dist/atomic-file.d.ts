/**
 * @fileoverview Atomic, symlink-refusing text file writes.
 *
 * A write goes to an exclusive temporary file beside the destination, is flushed with
 * `fsync`, then renamed over the destination, so a crash or failed write leaves either the
 * old file or the new one, never a truncated mix. The destination keeps its permission bits;
 * a new file gets the mode the caller gives (owner-only by default). A destination that is a
 * symlink, or anything other than a regular file, is refused, so a write can never be
 * redirected to another file.
 *
 * Flow: validate destination -> temp file (exclusive) -> write + fsync -> rename -> fsync folder.
 *
 * @example
 * ```typescript
 * EnvMaterializeKit_writeTextFileAtomically("/app/.env.local", "A=1\n", { mode: 0o600 });
 * ```
 *
 * @testing Node test unit: npm test runs src/atomic-file.unit.test.ts.
 * @see src/managed-keys.ts - Default writer for managed env files.
 * @see src/atomic-file.unit.test.ts - Tests for rename, mode, symlink refusal and failure cleanup.
 */
import fs from "node:fs";
/** Options for one atomic write. */
export type EnvMaterializeKit_AtomicWriteOptions = {
    /** Permission bits for a new file. An existing file keeps its own. Defaults to 0o600. */
    mode?: number;
};
/** File operations the writer uses, injectable so tests can make one of them fail. */
export type EnvMaterializeKit_AtomicFileOperations = {
    /** `fs.lstatSync` with `throwIfNoEntry: false`. */
    lstat: (filePath: string) => fs.Stats | undefined;
    /** `fs.mkdirSync` with `recursive: true`. */
    mkdir: (directoryPath: string) => void;
    /** Opens a new file exclusively for writing and returns its descriptor. */
    openExclusive: (filePath: string, mode: number) => number;
    /** Writes the whole buffer to a descriptor. */
    writeAll: (fd: number, content: Buffer) => void;
    /** Sets permission bits on a descriptor. */
    fchmod: (fd: number, mode: number) => void;
    /** Flushes a descriptor to disk. */
    fsync: (fd: number) => void;
    /** Closes a descriptor. */
    close: (fd: number) => void;
    /** Renames a file, replacing the destination. */
    rename: (fromPath: string, toPath: string) => void;
    /** Removes a file, ignoring a missing one. */
    remove: (filePath: string) => void;
    /** Flushes a folder's entries to disk; best effort. */
    fsyncDirectory: (directoryPath: string) => void;
};
/**
 * Returns the file operations backed by `node:fs`.
 *
 * @returns Real file operations.
 * @example
 * ```typescript
 * const operations = EnvMaterializeKit_nodeAtomicFileOperations();
 * ```
 */
export declare function EnvMaterializeKit_nodeAtomicFileOperations(): EnvMaterializeKit_AtomicFileOperations;
/**
 * Writes text atomically: temp file beside the destination, fsync, rename. The destination
 * keeps its permission bits; a new file gets `options.mode` (0o600 by default).
 *
 * @param filePath - Destination path. Parent folders are created when absent.
 * @param content - UTF-8 text to write.
 * @param options - Mode for a new file.
 * @param operations - File operations; defaults to `node:fs`.
 * @throws Error naming the path when the destination is a symlink or not a regular file, or
 * when any step fails. The temp file is removed on failure and the destination is untouched.
 * @example
 * ```typescript
 * EnvMaterializeKit_writeTextFileAtomically("/app/.env.local", "A=1\n", { mode: 0o600 });
 * ```
 */
export declare function EnvMaterializeKit_writeTextFileAtomically(filePath: string, content: string, options?: EnvMaterializeKit_AtomicWriteOptions, operations?: EnvMaterializeKit_AtomicFileOperations): void;
