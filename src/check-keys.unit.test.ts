/** @fileoverview Synthetic key coverage and CLI privacy regressions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { inspect } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { checkKeys } from "./check-keys.js";
import { EnvMaterializeKit_KeyInputError, EnvMaterializeKit_keyInputError } from "./key-input-error.js";

void test("reports sorted names, optional keys and deterministic extra filters", () => {
  const dir = mkdtempSync(join(tmpdir(), "keys-"));
  try {
    const template = join(dir, "template");
    const target = join(dir, "target");
    writeFileSync(template, 'Z=synthetic\nA=synthetic\nOPT=synthetic\n');
    writeFileSync(target, 'A=synthetic\nDEBUG_X=synthetic\nDEBUG_Y=synthetic\nLOCAL=synthetic\nEXTRA=synthetic\n');
    assert.deepEqual(checkKeys(template, target, { optional: ["OPT"], ignoreExtra: ["LOCAL", /^DEBUG_/g] }), {
      targetExists: true, missing: ["Z"], extra: ["EXTRA"], present: ["A"],
    });
    assert.deepEqual(checkKeys(template, join(dir, "absent")).missing, ["A", "OPT", "Z"]);
    assert.equal(checkKeys(template, join(dir, "absent")).targetExists, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

void test("fixture values never escape through results, output or errors", () => {
  const dir = mkdtempSync(join(tmpdir(), "keys-private-"));
  const marker = "fixture-private-sentinel";
  try {
    const template = join(dir, "template");
    const target = join(dir, "target");
    writeFileSync(template, `A=${marker}\nB="${marker}\nFAKE=${marker}"\n`);
    writeFileSync(target, `A=${marker}\n`);
    assert.equal(JSON.stringify(checkKeys(template, target)).includes(marker), false);
    assert.throws(() => checkKeys(join(dir, "absent-template"), target), error => {
      assert.equal(inspect(error).includes(marker), false);
      return true;
    });
    const run = (args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "src/check-keys-cli.ts", ...args], { encoding: "utf8" });
    for (const json of [[], ["--json"]]) {
      const result = run(["--template", template, "--target", target, ...json]);
      assert.equal(result.status, 1);
      assert.equal((result.stdout + result.stderr).includes(marker), false);
      assert.match(result.stdout, /B/);
    }
    assert.equal(run(["--template", template, "--target", target, "--optional", "B"]).status, 0);
    assert.equal(run(["--template", template, "--target", join(dir, "absent")]).status, 1);
    for (const args of [[marker], ["--optional"], ["--template", join(dir, "absent-template"), "--target", target], ["--template", dir, "--target", target]]) {
      const result = run(args);
      assert.equal(result.status, 2);
      assert.equal((result.stdout + result.stderr).includes(marker), false);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

void test("I/O errors keep the file system cause and the CLI prints it with the path", () => {
  const dir = mkdtempSync(join(tmpdir(), "keys-cause-"));
  const marker = "fixture-private-sentinel";
  try {
    const target = join(dir, "target");
    const absent = join(dir, "absent-template");
    writeFileSync(target, `A=${marker}\n`);
    assert.throws(() => checkKeys(absent, target), error => {
      assert.ok(error instanceof EnvMaterializeKit_KeyInputError);
      assert.equal(error.message, `Unable to read key names from ${absent}: ENOENT: no such file or directory, open '${absent}'`);
      assert.ok(error.cause instanceof Error);
      assert.equal("code" in error.cause && error.cause.code, "ENOENT");
      return true;
    });
    // A directory opens but cannot be read, so this failure happens while the target is scanned.
    assert.throws(() => checkKeys(target, dir), error => {
      assert.ok(error instanceof EnvMaterializeKit_KeyInputError);
      assert.match(error.message, /^Unable to read key names from .+: EISDIR: /);
      assert.equal("code" in (error.cause as Error) && (error.cause as NodeJS.ErrnoException).code, "EISDIR");
      assert.equal(inspect(error).includes(marker), false);
      return true;
    });
    const run = (args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "src/check-keys-cli.ts", ...args], { encoding: "utf8" });
    const missing = run(["--template", absent, "--target", target]);
    assert.equal(missing.status, 2);
    assert.equal(missing.stdout, "");
    assert.equal(missing.stderr, `Unable to read key names from ${absent}: ENOENT: no such file or directory, open '${absent}'\n`);
    const unreadable = run(["--template", target, "--target", dir]);
    assert.equal(unreadable.status, 2);
    assert.match(unreadable.stderr, /^Unable to read key names from .+: EISDIR: /);
    assert.equal((unreadable.stdout + unreadable.stderr).includes(marker), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

void test("an underlying error that quotes file content is never surfaced", () => {
  const marker = "fixture-private-sentinel";
  // Stands in for a scanner or library failure whose message was built from the file's bytes.
  const leaky = new TypeError(`unexpected token in A=${marker}`, { cause: new Error(marker) });
  const error = EnvMaterializeKit_keyInputError("Unable to read key names from", "/synthetic/.env", leaky);
  assert.equal(error.message, "Unable to read key names from /synthetic/.env: details withheld because the failure did not come from the file system");
  assert.equal(error.cause, undefined);
  assert.equal(inspect(error, { depth: null }).includes(marker), false);
  assert.equal(String(error.stack).includes(marker), false);
  assert.equal(JSON.stringify(error, Object.getOwnPropertyNames(error)).includes(marker), false);
  // An object that only looks like a file system error is not trusted either.
  const forged = Object.assign(new Error(marker), { code: "not-a-code", syscall: "read" });
  assert.equal(inspect(EnvMaterializeKit_keyInputError("Unable to read key names from", "/synthetic/.env", forged), { depth: null }).includes(marker), false);
});
