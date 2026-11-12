/**
 * @fileoverview Path containment for a trusted tree, with checks that catch a single
 * symlink swap.
 *
 * A check of canonical paths followed by a separate open leaves a window: a folder or file
 * can be swapped for a symlink between the two. Node has no `openat`, so reads here re-check
 * after the open instead. The canonical in-root path is opened with `O_NOFOLLOW`, then, with
 * the descriptor held, every directory on that path is checked with `lstat` (none may be a
 * symlink) and the descriptor's device and inode must equal those of the in-root path. Only
 * then is the file read, and only through that descriptor. A single swap before the open
 * makes the post-open checks fail; a single swap back after the open makes the identity
 * check fail.
 *
 * Trust model: the tree must be trusted, meaning no other actor with the same file system
 * permissions changes it while a read or write runs. The checks run one after another, so a
 * concurrent actor that swaps a folder several times, timed between them, can still lead a
 * read outside the root (see the three-swap test). They are a defence against a stray or
 * one-shot symlink, not a sandbox. If Node gains a native `openat` path, real directory
 * handles can replace these checks.
 *
 * Writers use `EnvMaterializeKit_assertNoSymlinkedParents` to refuse a destination whose
 * parent folders include a symlink.
 *
 * Flow: lexical check -> canonical check -> open (O_NOFOLLOW) -> lstat every directory ->
 * compare device and inode -> read through the descriptor -> close.
 *
 * @example
 * ```typescript
 * const text = EnvMaterializeKit_readContainedTextFile({ rootPath: "/seeds", relativePath: "env/local.env" });
 * ```
 *
 * @testing Node test unit: npm test runs src/contained-paths.unit.test.ts.
 * @see src/seed-sources.ts - Default seed reads go through `EnvMaterializeKit_readContainedTextFile`.
 * @see src/atomic-file.ts - Uses `EnvMaterializeKit_assertNoSymlinkedParents` before writing.
 * @see src/contained-paths.unit.test.ts - Swap tests between the check, the open and the verify,
 * and the three-swap test that documents the limit of the trust model.
 */
/** Test seams called at the points where a swap could happen. */
export type EnvMaterializeKit_ContainmentHooks = {
    /** Called after the canonical path was checked and before it is opened. */
    afterCheck?: () => void;
    /** Called after the file was opened and before it is verified. */
    afterOpen?: () => void;
};
/** Inputs for one contained read. */
export type EnvMaterializeKit_ContainedReadOptions = {
    /** Root the file must stay inside. It may itself be reached through a symlink. */
    rootPath: string;
    /** Path relative to the root. */
    relativePath: string;
    /** Test seams; leave out in real use. */
    hooks?: EnvMaterializeKit_ContainmentHooks;
};
/** Inputs for the parent-folder symlink check. */
export type EnvMaterializeKit_SymlinkedParentsOptions = {
    /** Destination file. */
    filePath: string;
    /**
     * Root the destination belongs to, such as a checkout. Folders strictly below it are
     * checked; the root itself may be a symlink. When omitted, every ancestor is checked, and
     * only top-level system aliases (a symlink directly under `/`, such as `/tmp` or `/var` on
     * macOS) are tolerated.
     */
    rootPath?: string;
};
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
export declare function EnvMaterializeKit_isPathInside(rootPath: string, candidate: string): boolean;
/**
 * Resolves every symlink in a path. For a path that does not exist, resolves the nearest
 * existing ancestor and appends the remaining segments.
 *
 * @param absolutePath - Absolute path.
 * @returns The canonical path.
 * @throws Error from `fs.realpathSync` other than a missing entry.
 * @example
 * ```typescript
 * EnvMaterializeKit_realPathOfNearestExisting("/tmp/seeds/missing.env"); // "/private/tmp/seeds/missing.env" on macOS
 * ```
 */
export declare function EnvMaterializeKit_realPathOfNearestExisting(absolutePath: string): string;
/**
 * Refuses a destination when a folder between its root and the file is a symlink. Folders
 * that do not exist yet are skipped; call again after creating them. This is a point-in-time
 * check: it assumes a trusted tree that no other actor with the same permissions changes
 * concurrently, since a folder can be swapped right after it returns.
 *
 * @param options - Destination and optional root.
 * @throws Error naming the destination when a parent folder is a symlink, or when the
 * destination is not inside the given root.
 * @example
 * ```typescript
 * EnvMaterializeKit_assertNoSymlinkedParents({ filePath: "/repo/.local/clients.json", rootPath: "/repo" });
 * ```
 */
export declare function EnvMaterializeKit_assertNoSymlinkedParents(options: EnvMaterializeKit_SymlinkedParentsOptions): void;
/**
 * Reads a text file that must stay inside a root, refusing a folder or file swapped once
 * for a symlink during the read. The file is opened with `O_NOFOLLOW`, every folder on its
 * canonical path is checked with `lstat` after the open, and the descriptor must be the same
 * file (device and inode) as the in-root path. Only then is it read, through that
 * descriptor, which is always closed.
 *
 * Trust model: the tree must be trusted, meaning no other actor with the same file system
 * permissions mutates it concurrently. Several swaps timed between the sequential checks can
 * still read a file outside the root; Node has no `openat` to close that window. If Node
 * gains a native `openat` path, real directory handles can replace these checks.
 *
 * @param options - Root, relative path and optional test seams.
 * @returns The text, or null when the file does not exist.
 * @throws Error naming the relative path only when it is absolute, escapes the root
 * lexically or through a symlink, or changes between the check and the read.
 * @example
 * ```typescript
 * EnvMaterializeKit_readContainedTextFile({ rootPath: "/seeds", relativePath: "environments/local.env" });
 * ```
 */
export declare function EnvMaterializeKit_readContainedTextFile(options: EnvMaterializeKit_ContainedReadOptions): string | null;
