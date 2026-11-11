import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EnvMaterializeKit_writeTargetFile } from "./write-target-file.js";
import { EnvMaterializeKit_formatResultLines } from "./format-results.js";
import { EnvMaterializeKit_isCheckModeFailureResult } from "./cli-runner.js";

void test("check mode returns only file status and never mutates synthetic targets", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "env-kit-check-"));
  try {
    const filePath = path.join(directory, "nested", "synthetic-target");
    const options = {
      desiredContent: "SYNTHETIC_KEY=synthetic-desired-value\n",
      filePath,
      mode: "check" as const,
      referenceFilePath: path.join(directory, "unused-reference"),
      syncPolicy: { managedUrlKeys: [], placeholderExactValues: [], placeholderSubstrings: [] },
    };
    const missing = EnvMaterializeKit_writeTargetFile(options);
    assert.deepEqual(missing, { changed: false, filePath, status: "missing" });
    assert.equal(fs.existsSync(path.dirname(filePath)), false);
    assert.equal(EnvMaterializeKit_isCheckModeFailureResult(missing), true);

    fs.mkdirSync(path.dirname(filePath));
    for (const content of ["SYNTHETIC_KEY=synthetic-current-value\n", options.desiredContent]) {
      fs.writeFileSync(filePath, content);
      const before = fs.statSync(filePath);
      const result = EnvMaterializeKit_writeTargetFile(options);
      const matches = content === options.desiredContent;
      assert.deepEqual(result, { changed: false, filePath, status: matches ? "unchanged" : "drift" });
      assert.equal(EnvMaterializeKit_isCheckModeFailureResult(result), !matches);
      assert.equal(fs.readFileSync(filePath, "utf8"), content);
      assert.equal(fs.statSync(filePath).mtimeMs, before.mtimeMs);
      assert.deepEqual(EnvMaterializeKit_formatResultLines([result]), [`[env-materialize] ${result.status} ${filePath}`]);
      assert.equal(JSON.stringify(result).includes("synthetic-current-value"), false);
      assert.equal(JSON.stringify(result).includes("synthetic-desired-value"), false);
    }
    assert.deepEqual(fs.readdirSync(directory), ["nested"]);
    assert.deepEqual(fs.readdirSync(path.dirname(filePath)), ["synthetic-target"]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
