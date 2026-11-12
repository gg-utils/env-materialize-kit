/**
 * @fileoverview Tests for key-level check and write of partly managed env files.
 * @see src/managed-keys.ts - Module under test.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseEnv } from "node:util";

import {
  EnvMaterializeKit_checkManagedEnvFile,
  EnvMaterializeKit_diffManagedKeys,
  EnvMaterializeKit_formatManagedKeyResult,
  EnvMaterializeKit_writeManagedEnvFile,
  type EnvMaterializeKit_ManagedFileSystem,
} from "./managed-keys.js";

/**
 * Builds an in-memory managed file system and a write log.
 * @param initial - Path to file text.
 * @returns The file system, its files and the list of writes.
 */
function memory(initial: Record<string, string>): {
  fileSystem: EnvMaterializeKit_ManagedFileSystem; files: Map<string, string>; writes: string[];
} {
  const files = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    files, writes,
    fileSystem: {
      readTextFile: (filePath) => files.get(filePath) ?? null,
      writeTextFile: (filePath, content) => { writes.push(filePath); files.set(filePath, content); },
    },
  };
}

const current = [
  "# comment kept",
  "APP_ORIGIN=\"https://old.example.test\"",
  "DATABASE_URL=postgres://synthetic-unmanaged-value",
  "SESSION_SECRET=synthetic-secret-current",
  "PORT=3000",
  "",
].join("\n");

void test("diff reports names per category and keeps preserved keys without desired values", () => {
  const diff = EnvMaterializeKit_diffManagedKeys({
    currentValues: new Map([["A", "1"], ["B", "2"]]),
    desiredValues: new Map([["A", "1"], ["B", "3"], ["C", "4"]]),
    preservedKeys: ["S", "C"],
  });
  assert.deepEqual(diff, { added: ["C"], changed: ["B"], unchanged: ["A"], kept: ["S"] });
});

void test("check mode is read-only, compares quoted values by meaning and prints no values", () => {
  const { fileSystem, writes } = memory({ "/app/.env.local": current });
  const desiredValues = new Map([["APP_ORIGIN", "https://new.example.test"], ["PORT", "3000"], ["NEW_KEY", "synthetic-new"]]);
  const result = EnvMaterializeKit_checkManagedEnvFile({
    filePath: "/app/.env.local", desiredValues, preservedKeys: ["SESSION_SECRET"], fileSystem,
  });
  assert.equal(result.status, "drift");
  assert.deepEqual(result.diff, { added: ["NEW_KEY"], changed: ["APP_ORIGIN"], unchanged: ["PORT"], kept: ["SESSION_SECRET"] });
  assert.deepEqual(writes, []);
  const printed = JSON.stringify(result) + EnvMaterializeKit_formatManagedKeyResult(result, "app").join("\n");
  for (const value of ["old.example.test", "new.example.test", "synthetic-new", "synthetic-secret-current", "synthetic-unmanaged-value"]) {
    assert.equal(printed.includes(value), false, `output must not contain a value (${value.length} chars)`);
  }
  const same = EnvMaterializeKit_checkManagedEnvFile({
    filePath: "/app/.env.local", desiredValues: new Map([["APP_ORIGIN", "https://old.example.test"]]), fileSystem,
  });
  assert.equal(same.status, "unchanged");
  assert.equal(EnvMaterializeKit_checkManagedEnvFile({ filePath: "/absent", desiredValues, fileSystem }).status, "missing");
});

void test("write mode changes only managed keys and keeps every other line", () => {
  const { fileSystem, files, writes } = memory({ "/app/.env.local": current });
  const result = EnvMaterializeKit_writeManagedEnvFile({
    filePath: "/app/.env.local", fileSystem, preservedKeys: ["SESSION_SECRET"],
    desiredValues: new Map([["APP_ORIGIN", "https://new.example.test"], ["PORT", "3000"], ["NEW_KEY", "synthetic-new"]]),
  });
  assert.equal(result.status, "updated");
  assert.deepEqual(writes, ["/app/.env.local"]);
  assert.equal(files.get("/app/.env.local"), [
    "# comment kept",
    "APP_ORIGIN=https://new.example.test",
    "DATABASE_URL=postgres://synthetic-unmanaged-value",
    "SESSION_SECRET=synthetic-secret-current",
    "PORT=3000",
    "NEW_KEY=synthetic-new",
    "",
  ].join("\n"));
  const again = EnvMaterializeKit_writeManagedEnvFile({
    filePath: "/app/.env.local", fileSystem, preservedKeys: ["SESSION_SECRET"],
    desiredValues: new Map([["APP_ORIGIN", "https://new.example.test"], ["NEW_KEY", "synthetic-new"]]),
  });
  assert.equal(again.status, "unchanged");
  assert.equal(writes.length, 1);
});

void test("write mode creates an absent file with owner-only permissions", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "env-kit-managed-"));
  try {
    const filePath = path.join(directory, "nested", ".env.local");
    const result = EnvMaterializeKit_writeManagedEnvFile({ filePath, desiredValues: new Map([["B", "2"], ["A", "1"]]) });
    assert.equal(result.status, "created");
    assert.equal(fs.readFileSync(filePath, "utf8"), "A=1\nB=2\n");
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

void test("a partial write keeps every unmanaged byte: CRLF, export, duplicates, comments, multiline", () => {
  const before = [
    "# header comment",
    "",
    "  export APP_ORIGIN = \"https://old.example.test\"  # inline note",
    "UNMANAGED=first",
    "UNMANAGED=second",
    "export   SPACED  =  kept as is   ",
    "MULTI_SECRET=\"synthetic-line-one",
    "OTHER_KEY=inside-the-secret",
    "synthetic-line-three\"",
    "",
    "PORT=3000",
    "TAIL=no-final-newline",
  ].join("\r\n");
  const { fileSystem, files } = memory({ "/app/.env": before });
  const result = EnvMaterializeKit_writeManagedEnvFile({
    filePath: "/app/.env", fileSystem, preservedKeys: ["MULTI_SECRET"],
    desiredValues: new Map([["APP_ORIGIN", "https://new.example.test"], ["PORT", "3000"], ["ADDED", "two words"]]),
  });
  assert.equal(result.status, "updated");
  const after = files.get("/app/.env") ?? "";
  const expected = before.replace(
    "  export APP_ORIGIN = \"https://old.example.test\"  # inline note",
    "  export APP_ORIGIN = https://new.example.test  # inline note",
  ) + "\r\nADDED='two words'\r\n";
  assert.equal(after, expected);
  const parsed = parseEnv(after);
  assert.equal(parsed["MULTI_SECRET"], "synthetic-line-one\nOTHER_KEY=inside-the-secret\nsynthetic-line-three");
  assert.equal(parsed["UNMANAGED"], "second");
  assert.equal(parsed["ADDED"], "two words");
  assert.equal(EnvMaterializeKit_checkManagedEnvFile({
    filePath: "/app/.env", fileSystem, preservedKeys: ["MULTI_SECRET"],
    desiredValues: new Map([["APP_ORIGIN", "https://new.example.test"], ["PORT", "3000"], ["ADDED", "two words"]]),
  }).status, "unchanged");
});

void test("a managed key assigned twice or inside a multiline value is refused by name only", () => {
  const cases: [string, string][] = [
    ["APP_ORIGIN=synthetic-a\nexport APP_ORIGIN=synthetic-b\n", "assigned more than once"],
    ["SECRET=\"synthetic-one\nAPP_ORIGIN=synthetic-hidden\nsynthetic-two\"\n", "inside a multiline value"],
  ];
  for (const [content, reason] of cases) {
    const { fileSystem, writes } = memory({ "/app/.env": content });
    for (const run of [EnvMaterializeKit_checkManagedEnvFile, EnvMaterializeKit_writeManagedEnvFile]) {
      assert.throws(
        () => run({ filePath: "/app/.env", fileSystem, desiredValues: new Map([["APP_ORIGIN", "synthetic-new"]]) }),
        (error: unknown) =>
          error instanceof Error && error.message.includes("APP_ORIGIN") && error.message.includes(reason) &&
          !error.message.includes("synthetic"),
      );
    }
    assert.deepEqual(writes, []);
  }
});

void test("written values round-trip through util.parseEnv: #, quotes, newlines, =, spaces", () => {
  const desiredValues = new Map([
    ["HASH", "synthetic #hash"],
    ["SINGLE", "it's synthetic"],
    ["DOUBLE", "say \"synthetic\""],
    ["NEWLINE", "synthetic-one\nsynthetic-two"],
    ["EQUALS", "a=b=c"],
    ["SPACES", "  padded  "],
  ]);
  const { fileSystem, files } = memory({ "/app/.env": "HASH=old\nSINGLE='old'\nKEEP=1\n" });
  EnvMaterializeKit_writeManagedEnvFile({ filePath: "/app/.env", fileSystem, desiredValues });
  const parsed = parseEnv(files.get("/app/.env") ?? "");
  for (const [key, value] of desiredValues) {
    assert.equal(parsed[key], value, `round trip of ${key}`);
  }
  assert.equal(parsed["KEEP"], "1");
  assert.equal(
    EnvMaterializeKit_checkManagedEnvFile({ filePath: "/app/.env", fileSystem, desiredValues }).status,
    "unchanged",
  );
});

void test("a value no quoting can carry is refused by key name only", () => {
  const { fileSystem, writes } = memory({});
  assert.throws(() => EnvMaterializeKit_writeManagedEnvFile({
    filePath: "/x", fileSystem, desiredValues: new Map([["BAD", "synthetic\rcarriage"]]),
  }), (error: unknown) => error instanceof Error && error.message.includes("BAD") && !error.message.includes("synthetic"));
  assert.deepEqual(writes, []);
});

void test("the default writer replaces atomically, keeps the mode and refuses symlinks", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "env-kit-managed-"));
  try {
    const filePath = path.join(directory, ".env.local");
    fs.writeFileSync(filePath, "A=1\nKEEP=1\n", { mode: 0o640 });
    fs.chmodSync(filePath, 0o640);
    const hardlink = path.join(directory, "hardlink");
    fs.linkSync(filePath, hardlink);
    const inodeBefore = fs.statSync(filePath).ino;
    EnvMaterializeKit_writeManagedEnvFile({ filePath, desiredValues: new Map([["A", "2"]]) });
    assert.equal(fs.readFileSync(filePath, "utf8"), "A=2\nKEEP=1\n");
    assert.notEqual(fs.statSync(filePath).ino, inodeBefore, "a new inode means rename, not an in-place write");
    assert.equal(fs.readFileSync(hardlink, "utf8"), "A=1\nKEEP=1\n");
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o640);
    assert.deepEqual(fs.readdirSync(directory).filter((name) => name.endsWith(".tmp")), []);
    const outside = path.join(directory, "outside.env");
    fs.writeFileSync(outside, "A=1\n");
    const link = path.join(directory, "link.env");
    fs.symlinkSync(outside, link);
    assert.throws(
      () => EnvMaterializeKit_writeManagedEnvFile({ filePath: link, desiredValues: new Map([["A", "2"]]) }),
      /symlink/u,
    );
    assert.equal(fs.readFileSync(outside, "utf8"), "A=1\n");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
