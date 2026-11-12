/**
 * @fileoverview Tests for key-level check and write of partly managed env files.
 * @see src/managed-keys.ts - Module under test.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

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
    "",
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

void test("multi-line values are refused by key name only", () => {
  const { fileSystem } = memory({});
  assert.throws(() => EnvMaterializeKit_writeManagedEnvFile({
    filePath: "/x", fileSystem, desiredValues: new Map([["BAD", "line-one\nsynthetic-line-two"]]),
  }), (error: unknown) => error instanceof Error && error.message.includes("BAD") && !error.message.includes("synthetic-line-two"));
});
