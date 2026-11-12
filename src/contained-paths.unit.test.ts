/**
 * @fileoverview Tests for contained reads and the parent-folder symlink check, including
 * swaps replayed between the containment check, the open and the verify.
 * @see src/contained-paths.ts - Module under test.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { mock } from "node:test";

import {
  EnvMaterializeKit_assertNoSymlinkedParents,
  EnvMaterializeKit_readContainedTextFile,
} from "./contained-paths.js";
import { EnvMaterializeKit_createDirectorySeedSource } from "./seed-sources.js";

const OUTSIDE_MARKER = "OUTSIDE_SYNTHETIC_MARKER";

/** Folders for one swap scenario. */
type SwapLayout = {
  /** Seed root. */
  root: string;
  /** Folder outside the root holding the decoy file. */
  outside: string;
  /** In-root folder that the swap replaces with a symlink. */
  inside: string;
};

/**
 * Builds a root with `env/local.env` and an outside folder with a decoy `local.env`, runs the
 * body, then removes everything.
 * @param body - Code to run with the layout.
 */
function withSwapLayout(body: (layout: SwapLayout) => void): void {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "env-kit-contained-"));
  try {
    const root = path.join(base, "root");
    const outside = path.join(base, "outside");
    const inside = path.join(root, "env");
    fs.mkdirSync(inside, { recursive: true });
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(inside, "local.env"), "INSIDE=1\n");
    fs.writeFileSync(path.join(outside, "local.env"), `SECRET=${OUTSIDE_MARKER}\n`);
    body({ root, outside, inside });
  } finally {
    mock.restoreAll();
    fs.rmSync(base, { recursive: true, force: true });
  }
}

/**
 * Replaces the in-root folder with a symlink to the outside folder.
 * @param layout - Swap layout.
 */
function swapFolderForOutsideLink(layout: SwapLayout): void {
  fs.renameSync(layout.inside, `${layout.inside}.moved`);
  fs.symlinkSync(layout.outside, layout.inside);
}

/**
 * Asserts a refusal names the relative path only: no outside path and no outside value.
 * @param error - Thrown value.
 * @param layout - Swap layout.
 * @returns True so it can serve as an `assert.throws` validator.
 */
function isRefusalByPathOnly(error: unknown, layout: SwapLayout): boolean {
  assert.ok(error instanceof Error);
  assert.match(error.message, /env\/local\.env/u);
  assert.ok(!error.message.includes(layout.outside), "no outside path in the message");
  assert.ok(!error.message.includes(OUTSIDE_MARKER), "no outside value in the message");
  return true;
}

void test("a contained read returns the text, or null for a missing file", () => {
  withSwapLayout(({ root }) => {
    assert.equal(
      EnvMaterializeKit_readContainedTextFile({ rootPath: root, relativePath: "env/local.env" }),
      "INSIDE=1\n",
    );
    assert.equal(
      EnvMaterializeKit_readContainedTextFile({ rootPath: root, relativePath: "env/none.env" }),
      null,
    );
  });
});

void test("a folder swapped for an outside symlink after the check is refused and never read", () => {
  withSwapLayout((layout) => {
    const reads = mock.method(fs, "readFileSync");
    assert.throws(
      () =>
        EnvMaterializeKit_readContainedTextFile({
          rootPath: layout.root,
          relativePath: "env/local.env",
          hooks: { afterCheck: () => { swapFolderForOutsideLink(layout); } },
        }),
      (error: unknown) => isRefusalByPathOnly(error, layout),
    );
    assert.equal(reads.mock.callCount(), 0, "nothing was read");
  });
});

void test("a folder swapped for an outside symlink after the open is refused and never read", () => {
  withSwapLayout((layout) => {
    const reads = mock.method(fs, "readFileSync");
    assert.throws(
      () =>
        EnvMaterializeKit_readContainedTextFile({
          rootPath: layout.root,
          relativePath: "env/local.env",
          hooks: { afterOpen: () => { swapFolderForOutsideLink(layout); } },
        }),
      (error: unknown) => isRefusalByPathOnly(error, layout),
    );
    assert.equal(reads.mock.callCount(), 0, "nothing was read");
  });
});

void test("a file swapped for an outside symlink after the check is refused by O_NOFOLLOW", () => {
  withSwapLayout((layout) => {
    const reads = mock.method(fs, "readFileSync");
    const target = path.join(layout.inside, "local.env");
    assert.throws(
      () =>
        EnvMaterializeKit_readContainedTextFile({
          rootPath: layout.root,
          relativePath: "env/local.env",
          hooks: {
            afterCheck: () => {
              fs.rmSync(target);
              fs.symlinkSync(path.join(layout.outside, "local.env"), target);
            },
          },
        }),
      (error: unknown) => isRefusalByPathOnly(error, layout),
    );
    assert.equal(reads.mock.callCount(), 0, "nothing was read");
  });
});

void test("a file replaced after the open fails the device and inode check", () => {
  withSwapLayout((layout) => {
    const target = path.join(layout.inside, "local.env");
    assert.throws(
      () =>
        EnvMaterializeKit_readContainedTextFile({
          rootPath: layout.root,
          relativePath: "env/local.env",
          hooks: {
            afterOpen: () => {
              fs.writeFileSync(`${target}.next`, "INSIDE=2\n");
              fs.renameSync(`${target}.next`, target);
            },
          },
        }),
      (error: unknown) => isRefusalByPathOnly(error, layout),
    );
  });
});

void test("the default directory seed source refuses the swap and never reads outside", () => {
  withSwapLayout((layout) => {
    const reads = mock.method(fs, "readFileSync");
    const source = EnvMaterializeKit_createDirectorySeedSource({
      rootPath: layout.root,
      containmentHooks: { afterCheck: () => { swapFolderForOutsideLink(layout); } },
    });
    assert.throws(
      () => source.readEnvFile("env/local.env"),
      (error: unknown) => isRefusalByPathOnly(error, layout),
    );
    assert.equal(reads.mock.callCount(), 0, "nothing was read");
  });
});

void test("a root reached through a symlink still reads; symlinked parents below it are refused", () => {
  withSwapLayout((layout) => {
    const linkedRoot = `${layout.root}.link`;
    fs.symlinkSync(layout.root, linkedRoot);
    assert.equal(
      EnvMaterializeKit_readContainedTextFile({ rootPath: linkedRoot, relativePath: "env/local.env" }),
      "INSIDE=1\n",
    );
    const linkedFolder = path.join(layout.root, "linked");
    fs.symlinkSync(layout.inside, linkedFolder);
    assert.throws(() => {
      EnvMaterializeKit_assertNoSymlinkedParents({
        filePath: path.join(linkedRoot, "linked", "a.env"),
        rootPath: linkedRoot,
      });
    }, /symlinked folder/u);
    assert.doesNotThrow(() => {
      EnvMaterializeKit_assertNoSymlinkedParents({
        filePath: path.join(linkedRoot, "env", "a.env"),
        rootPath: linkedRoot,
      });
    });
    assert.throws(() => {
      EnvMaterializeKit_assertNoSymlinkedParents({
        filePath: path.join(linkedFolder, "a.env"),
      });
    }, /symlinked folder/u);
  });
});
