/** @fileoverview Synthetic key coverage and CLI privacy regressions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { checkKeys } from "./check-keys.js";

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
    assert.throws(() => checkKeys(join(dir, marker), target), error => {
      assert.equal(String(error).includes(marker), false);
      assert.equal(String(error), "Error: Unable to read key names.");
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
    for (const args of [[marker], ["--optional"], ["--template", join(dir, marker), "--target", target], ["--template", dir, "--target", target]]) {
      const result = run(args);
      assert.equal(result.status, 2);
      assert.equal((result.stdout + result.stderr).includes(marker), false);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
