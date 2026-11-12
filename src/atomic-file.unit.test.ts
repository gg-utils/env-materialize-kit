/**
 * @fileoverview Tests for atomic, symlink-refusing text file writes.
 * @see src/atomic-file.ts - Module under test.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EnvMaterializeKit_nodeAtomicFileOperations,
  EnvMaterializeKit_writeTextFileAtomically,
} from "./atomic-file.js";

/**
 * Runs a body with a fresh temporary folder and removes it afterwards.
 * @param body - Code to run with the folder path.
 */
function withDirectory(body: (directory: string) => void): void {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "env-kit-atomic-"));
  try {
    body(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

void test("a new file is created owner-only in a new folder, with no temp file left", () => {
  withDirectory((directory) => {
    const filePath = path.join(directory, "nested", "deeper", "file.env");
    EnvMaterializeKit_writeTextFileAtomically(filePath, "A=1\n");
    assert.equal(fs.readFileSync(filePath, "utf8"), "A=1\n");
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
    assert.deepEqual(fs.readdirSync(path.dirname(filePath)), ["file.env"]);
  });
});

void test("a failed write leaves the destination untouched and removes the temp file", () => {
  withDirectory((directory) => {
    const filePath = path.join(directory, "file.env");
    fs.writeFileSync(filePath, "ORIGINAL=1\n", { mode: 0o600 });
    for (const failing of ["writeAll", "fsync", "rename"] as const) {
      const operations = EnvMaterializeKit_nodeAtomicFileOperations();
      operations[failing] = () => {
        throw new Error(`synthetic ${failing} failure`);
      };
      assert.throws(() => {
        EnvMaterializeKit_writeTextFileAtomically(filePath, "NEW=1\n", {}, operations);
      }, new RegExp(`synthetic ${failing} failure`, "u"));
      assert.equal(fs.readFileSync(filePath, "utf8"), "ORIGINAL=1\n", `after ${failing} failure`);
      assert.deepEqual(fs.readdirSync(directory), ["file.env"], `no temp file after ${failing} failure`);
    }
  });
});

void test("symlinked destinations and non-files are refused before anything is written", () => {
  withDirectory((directory) => {
    const target = path.join(directory, "target.env");
    fs.writeFileSync(target, "A=1\n");
    const link = path.join(directory, "link.env");
    fs.symlinkSync(target, link);
    assert.throws(() => {
      EnvMaterializeKit_writeTextFileAtomically(link, "A=2\n");
    }, /symlink/u);
    const dangling = path.join(directory, "dangling.env");
    fs.symlinkSync(path.join(directory, "missing.env"), dangling);
    assert.throws(() => {
      EnvMaterializeKit_writeTextFileAtomically(dangling, "A=2\n");
    }, /symlink/u);
    assert.equal(fs.existsSync(path.join(directory, "missing.env")), false);
    fs.mkdirSync(path.join(directory, "folder.env"));
    assert.throws(() => {
      EnvMaterializeKit_writeTextFileAtomically(path.join(directory, "folder.env"), "A=2\n");
    }, /not a file/u);
    assert.equal(fs.readFileSync(target, "utf8"), "A=1\n");
  });
});

void test("a symlinked parent folder is refused by default and allowed with the option", () => {
  withDirectory((directory) => {
    const real = path.join(directory, "real");
    const linked = path.join(directory, "linked");
    fs.mkdirSync(real);
    fs.symlinkSync(real, linked);
    const filePath = path.join(linked, "nested", "file.env");
    assert.throws(() => {
      EnvMaterializeKit_writeTextFileAtomically(filePath, "A=1\n", { rootPath: directory });
    }, /Refusing to write below a symlinked folder/u);
    assert.throws(() => {
      EnvMaterializeKit_writeTextFileAtomically(filePath, "A=1\n");
    }, /Refusing to write below a symlinked folder/u);
    assert.deepEqual(fs.readdirSync(real), [], "nothing was created through the link");
    EnvMaterializeKit_writeTextFileAtomically(filePath, "A=1\n", {
      rootPath: directory,
      allowSymlinkedParents: true,
    });
    assert.equal(fs.readFileSync(path.join(real, "nested", "file.env"), "utf8"), "A=1\n");
  });
});

void test("a destination root that is itself a symlink is accepted", () => {
  withDirectory((directory) => {
    const real = path.join(directory, "checkout");
    const linkedRoot = path.join(directory, "checkout-link");
    fs.mkdirSync(real);
    fs.symlinkSync(real, linkedRoot);
    EnvMaterializeKit_writeTextFileAtomically(path.join(linkedRoot, ".local", "f.env"), "A=1\n", {
      rootPath: linkedRoot,
    });
    assert.equal(fs.readFileSync(path.join(real, ".local", "f.env"), "utf8"), "A=1\n");
  });
});
