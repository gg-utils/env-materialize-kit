/**
 * @fileoverview Path containment that holds while the tree changes underneath it.
 *
 * A check of canonical paths followed by a separate open is a race: a folder or file can be
 * swapped for a symlink between the two. Node has no `openat`, so reads here bind the check
 * to the opened file instead. The canonical in-root path is opened with `O_NOFOLLOW`, then,
 * with the descriptor held, every directory on that path is checked with `lstat` (none may
 * be a symlink) and the descriptor's device and inode must equal those of the in-root path.
 * Only then is the file read, and only through that descriptor. A swap before the open makes
 * the post-open checks fail; a swap back after the open makes the identity check fail.
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
 * @see src/contained-paths.unit.test.ts - Swap tests between the check, the open and the verify.
 */

import fs from "node:fs";
import path from "node:path";

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
export function EnvMaterializeKit_isPathInside(rootPath: string, candidate: string): boolean {
  const relative = path.relative(rootPath, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

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
 * Lists a path and each of its ancestors, root first.
 *
 * @param absolutePath - Absolute path.
 * @returns Paths from `/` down to `absolutePath`.
 * @example
 * ```typescript
 * EnvMaterializeKit_pathChain("/a/b"); // ["/", "/a", "/a/b"]
 * ```
 */
function EnvMaterializeKit_pathChain(absolutePath: string): string[] {
  const chain: string[] = [];
  let current = path.resolve(absolutePath);
  for (;;) {
    chain.unshift(current);
    const parent = path.dirname(current);
    if (parent === current) {
      return chain;
    }
    current = parent;
  }
}

/**
 * Refuses a destination when a folder between its root and the file is a symlink. Folders
 * that do not exist yet are skipped; call again after creating them.
 *
 * @param options - Destination and optional root.
 * @throws Error naming the destination when a parent folder is a symlink, or when the
 * destination is not inside the given root.
 * @example
 * ```typescript
 * EnvMaterializeKit_assertNoSymlinkedParents({ filePath: "/repo/.local/clients.json", rootPath: "/repo" });
 * ```
 */
export function EnvMaterializeKit_assertNoSymlinkedParents(
  options: EnvMaterializeKit_SymlinkedParentsOptions,
): void {
  const parent = path.dirname(path.resolve(options.filePath));
  let chain = EnvMaterializeKit_pathChain(parent);
  if (options.rootPath !== undefined) {
    const root = path.resolve(options.rootPath);
    if (!EnvMaterializeKit_isPathInside(root, parent)) {
      throw new Error(`[env-materialize] Destination is outside its root: ${options.filePath}`);
    }
    chain = chain.filter((entry) => entry !== root && EnvMaterializeKit_isPathInside(root, entry));
  }
  for (const entry of chain) {
    const stats = fs.lstatSync(entry, { throwIfNoEntry: false });
    if (stats === undefined) {
      return;
    }
    if (!stats.isSymbolicLink()) {
      continue;
    }
    const topLevelAlias = options.rootPath === undefined && path.dirname(entry) === path.parse(entry).root;
    if (!topLevelAlias) {
      throw new Error(
        `[env-materialize] Refusing to write below a symlinked folder: ${options.filePath}`,
      );
    }
  }
}

/**
 * Reads a text file that must stay inside a root, safe against a folder or file being
 * swapped for a symlink during the read. The file is opened with `O_NOFOLLOW`, every folder
 * on its canonical path is checked with `lstat` after the open, and the descriptor must be
 * the same file (device and inode) as the in-root path. Only then is it read, through that
 * descriptor, which is always closed.
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
export function EnvMaterializeKit_readContainedTextFile(
  options: EnvMaterializeKit_ContainedReadOptions,
): string | null {
  const { relativePath } = options;
  if (path.isAbsolute(relativePath)) {
    throw new Error(`[env-materialize] Seed path must be relative: ${relativePath}`);
  }
  const rootPath = path.resolve(options.rootPath);
  const lexical = path.resolve(rootPath, relativePath);
  if (!EnvMaterializeKit_isPathInside(rootPath, lexical)) {
    throw new Error(`[env-materialize] Seed path escapes the source root: ${relativePath}`);
  }
  const escaped = (): Error =>
    new Error(
      `[env-materialize] Seed path resolves outside the source root through a symlink: ${relativePath}`,
    );
  const realRoot = EnvMaterializeKit_realPathOfNearestExisting(rootPath);
  const canonical = EnvMaterializeKit_realPathOfNearestExisting(lexical);
  if (!EnvMaterializeKit_isPathInside(realRoot, canonical)) {
    throw escaped();
  }
  options.hooks?.afterCheck?.();
  let fd: number;
  try {
    fd = fs.openSync(canonical, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    if (code === "ELOOP") {
      throw escaped();
    }
    throw error;
  }
  try {
    options.hooks?.afterOpen?.();
    for (const entry of EnvMaterializeKit_pathChain(path.dirname(canonical))) {
      if (fs.lstatSync(entry, { throwIfNoEntry: false })?.isSymbolicLink() !== false) {
        throw escaped();
      }
    }
    const opened = fs.fstatSync(fd);
    const atPath = fs.lstatSync(canonical, { throwIfNoEntry: false });
    if (
      atPath === undefined ||
      !opened.isFile() ||
      !atPath.isFile() ||
      opened.dev !== atPath.dev ||
      opened.ino !== atPath.ino
    ) {
      throw new Error(`[env-materialize] Seed file changed while it was read: ${relativePath}`);
    }
    return fs.readFileSync(fd, "utf8");
  } finally {
    fs.closeSync(fd);
  }
}
