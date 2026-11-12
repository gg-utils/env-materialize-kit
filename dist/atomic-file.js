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
 * Parent folder policy: by default a write is refused when any folder between the
 * destination's root and the file is a symlink, so a swapped folder cannot redirect the
 * write elsewhere. The root is `rootPath` when given (the root itself may be a symlink);
 * without it every ancestor is checked and only top-level system aliases such as `/tmp` or
 * `/var` on macOS are tolerated. Pass `allowSymlinkedParents: true` to opt out. The check runs
 * before the parent folders are created, after, and again just before the rename.
 *
 * Flow: validate destination and parents -> temp file (exclusive) -> write + fsync -> check
 * parents -> rename -> fsync folder.
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
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { EnvMaterializeKit_assertNoSymlinkedParents } from "./contained-paths.js";
/**
 * Flushes a folder so a rename inside it is durable. Some platforms refuse `fsync` on a
 * folder; that is ignored because the rename itself has already happened.
 *
 * @param directoryPath - Folder to flush.
 * @example
 * ```typescript
 * EnvMaterializeKit_fsyncDirectoryBestEffort("/app");
 * ```
 */
function EnvMaterializeKit_fsyncDirectoryBestEffort(directoryPath) {
    let fd;
    try {
        fd = fs.openSync(directoryPath, "r");
        fs.fsyncSync(fd);
    }
    catch {
        // Durability of the folder entry is best effort; the file content is already flushed.
    }
    finally {
        if (fd !== undefined) {
            fs.closeSync(fd);
        }
    }
}
/**
 * Writes a whole buffer to a descriptor, looping over short writes.
 *
 * @param fd - Open descriptor.
 * @param content - Bytes to write.
 * @example
 * ```typescript
 * EnvMaterializeKit_writeAllToDescriptor(fd, Buffer.from("A=1\n"));
 * ```
 */
function EnvMaterializeKit_writeAllToDescriptor(fd, content) {
    let offset = 0;
    while (offset < content.length) {
        offset += fs.writeSync(fd, content, offset, content.length - offset);
    }
}
/**
 * Returns the file operations backed by `node:fs`.
 *
 * @returns Real file operations.
 * @example
 * ```typescript
 * const operations = EnvMaterializeKit_nodeAtomicFileOperations();
 * ```
 */
export function EnvMaterializeKit_nodeAtomicFileOperations() {
    return {
        lstat: (filePath) => fs.lstatSync(filePath, { throwIfNoEntry: false }),
        mkdir: (directoryPath) => {
            fs.mkdirSync(directoryPath, { recursive: true });
        },
        openExclusive: (filePath, mode) => fs.openSync(filePath, "wx", mode),
        writeAll: EnvMaterializeKit_writeAllToDescriptor,
        fchmod: (fd, mode) => {
            fs.fchmodSync(fd, mode);
        },
        fsync: (fd) => {
            fs.fsyncSync(fd);
        },
        close: (fd) => {
            fs.closeSync(fd);
        },
        rename: (fromPath, toPath) => {
            fs.renameSync(fromPath, toPath);
        },
        remove: (filePath) => {
            fs.rmSync(filePath, { force: true });
        },
        fsyncDirectory: EnvMaterializeKit_fsyncDirectoryBestEffort,
    };
}
/**
 * Writes text atomically: temp file beside the destination, fsync, rename. The destination
 * keeps its permission bits; a new file gets `options.mode` (0o600 by default).
 *
 * @param filePath - Destination path. Parent folders are created when absent.
 * @param content - UTF-8 text to write.
 * Unless `options.allowSymlinkedParents` is true, the write is refused when a folder between
 * `options.rootPath` (or the top of the file system) and the file is a symlink.
 *
 * @param options - Mode for a new file, the destination's root and the parent folder policy.
 * @param operations - File operations; defaults to `node:fs`.
 * @throws Error naming the path when the destination is a symlink or not a regular file,
 * when a parent folder is a symlink and that is not allowed, or when any step fails. The temp file is removed on failure and the destination is untouched.
 * @example
 * ```typescript
 * EnvMaterializeKit_writeTextFileAtomically("/app/.env.local", "A=1\n", { mode: 0o600, rootPath: "/app" });
 * ```
 */
export function EnvMaterializeKit_writeTextFileAtomically(filePath, content, options = {}, operations = EnvMaterializeKit_nodeAtomicFileOperations()) {
    const checkParents = () => {
        if (options.allowSymlinkedParents !== true) {
            EnvMaterializeKit_assertNoSymlinkedParents({
                filePath,
                ...(options.rootPath === undefined ? {} : { rootPath: options.rootPath }),
            });
        }
    };
    checkParents();
    const existing = operations.lstat(filePath);
    if (existing?.isSymbolicLink() === true) {
        throw new Error(`[env-materialize] Refusing to write through a symlink: ${filePath}`);
    }
    if (existing !== undefined && !existing.isFile()) {
        throw new Error(`[env-materialize] Refusing to write over something that is not a file: ${filePath}`);
    }
    const mode = existing === undefined ? (options.mode ?? 0o600) : existing.mode & 0o7777;
    const directory = path.dirname(filePath);
    operations.mkdir(directory);
    checkParents();
    const tempPath = path.join(directory, `.${path.basename(filePath)}.${String(process.pid)}.${randomBytes(6).toString("hex")}.tmp`);
    const fd = operations.openExclusive(tempPath, mode);
    let renamed = false;
    try {
        try {
            operations.writeAll(fd, Buffer.from(content, "utf8"));
            operations.fchmod(fd, mode);
            operations.fsync(fd);
        }
        finally {
            operations.close(fd);
        }
        checkParents();
        operations.rename(tempPath, filePath);
        renamed = true;
    }
    finally {
        if (!renamed) {
            operations.remove(tempPath);
        }
    }
    operations.fsyncDirectory(directory);
}
