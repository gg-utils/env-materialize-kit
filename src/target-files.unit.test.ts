/**
 * @fileoverview Verifies config-driven env target resolution, mode and target literal guards,
 * formatted CLI result lines, optional seed loading, and sync writes for `@gg-utils/env-materialize-kit`.
 *
 * This file owns Node test regression coverage for `EnvMaterializeKit_resolveTargetFiles` stable
 * ordering, optional checkout skipping, missing-reference failures, `EnvMaterializeKit_writeTargetFile`
 * merge policy against reference templates, `EnvMaterializeKit_formatResultLines`, and the seed and
 * machine-profile helpers used by `EnvMaterializeKit_loadSeedFiles`.
 * Flow: construct injected workspace/package inputs or temp dirs -> invoke kit helpers -> assert
 * resolved paths, thrown errors, merged `.env` contents, CLI lines, and loaded seed maps.
 *
 * @testing Node test unit: npm run test --prefix packages/env-materialize-kit from repository root runs the tsx-backed Node test harness that includes target-files.unit.test.ts.
 *
 * @see packages/env-materialize-kit/src/target-files.ts - Target list resolution and `EnvMaterializeKit_resolveTargetFiles` contract asserted here for ordering, optional packages, and missing reference env files.
 * @see packages/env-materialize-kit/src/seed-files.ts - Machine profile discovery, optional env parsing, and `EnvMaterializeKit_loadSeedFiles` orchestration validated alongside target resolution in this suite.
 * @see packages/env-materialize-kit/src/write-target-file.ts - Target env writer whose `sync-missing-or-blank` merge rules, managed URL keys, and placeholder handling are exercised with real temp files here.
 * @see packages/env-materialize-kit/src/index.ts - Package barrel that re-exports mode and target guards, format helpers, seed APIs, and target primitives imported by this test module.
 *
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EnvMaterializeKit_isMode,
  EnvMaterializeKit_isTarget,
  EnvMaterializeKit_formatResultLines,
  EnvMaterializeKit_loadSeedFiles,
  EnvMaterializeKit_listMachineProfileNames,
  EnvMaterializeKit_readOptionalEnvFile,
  EnvMaterializeKit_resolveMachineProfile,
  EnvMaterializeKit_resolveTargetFiles,
  EnvMaterializeKit_writeTargetFile,
} from "./index.js";

void test("EnvMaterializeKit_resolveTargetFiles resolves selected groups in stable order", () => {
  const resolvedTargets = EnvMaterializeKit_resolveTargetFiles({
    fileExists: (filePath) => !filePath.includes("optional"),
    localEdgeReferenceFilePath: "/repo/scripts/local-edge/.env.example",
    packageDefinitions: [
      { id: "app-one", referenceEnvFileName: ".env.example" },
      {
        id: "optional-app",
        isOptionalCheckout: true,
        referenceEnvFileName: ".env.template",
      },
    ],
    targets: ["local-edge", "packages"],
    workspacePath: "/workspace",
  });

  assert.deepEqual(resolvedTargets, [
    {
      filePath: "/workspace/.env.local-edge",
      id: "local-edge",
      referenceFilePath: "/repo/scripts/local-edge/.env.example",
      targetType: "local-edge",
    },
    {
      filePath: "/workspace/app-one/.env",
      id: "app-one",
      packageId: "app-one",
      referenceFilePath: "/workspace/app-one/.env.example",
      targetType: "package-env",
    },
  ]);
});

void test("EnvMaterializeKit_resolveTargetFiles errors on missing required references", () => {
  assert.throws(
    () =>
      EnvMaterializeKit_resolveTargetFiles({
        fileExists: () => false,
        localEdgeReferenceFilePath: "/repo/local-edge.env",
        packageDefinitions: [
          { id: "required-app", referenceEnvFileName: ".env.example" },
        ],
        targets: ["packages"],
        workspacePath: "/workspace",
      }),
    /Missing reference env file for required-app/u,
  );
});

void test("EnvMaterializeKit mode and target guards identify known literals", () => {
  assert.equal(EnvMaterializeKit_isMode("check"), true);
  assert.equal(EnvMaterializeKit_isMode("unknown"), false);
  assert.equal(EnvMaterializeKit_isTarget("packages"), true);
  assert.equal(EnvMaterializeKit_isTarget("unknown"), false);
});

void test("EnvMaterializeKit_writeTargetFile applies explicit sync policy", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-materialize-kit-"));
  try {
    const targetFilePath = path.join(tempDir, ".env");
    const referenceFilePath = path.join(tempDir, ".env.example");
    fs.writeFileSync(
      referenceFilePath,
      "A=template\nB=template\nAPP_URL=http://localhost:3000\nCUSTOM=template\n",
      "utf8",
    );
    fs.writeFileSync(
      targetFilePath,
      "A=\nB=template\nAPP_URL=http://127.0.0.1:3000\nCUSTOM=operator\n",
      "utf8",
    );

    const result = EnvMaterializeKit_writeTargetFile({
      desiredContent:
        "A=desired\nB=desired-template\nAPP_URL=https://example.test\nCUSTOM=desired\n",
      filePath: targetFilePath,
      mode: "sync-missing-or-blank",
      referenceFilePath,
      syncPolicy: {
        managedUrlKeys: ["APP_URL"],
        placeholderExactValues: ["replace-me"],
        placeholderSubstrings: ["<password>"],
      },
    });

    assert.deepEqual(result, {
      changed: true,
      filePath: targetFilePath,
      status: "synced",
    });
    assert.equal(
      fs.readFileSync(targetFilePath, "utf8"),
      "A=desired\nB=desired-template\nAPP_URL=https://example.test\nCUSTOM=operator\n",
    );
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

void test("EnvMaterializeKit_formatResultLines renders stable CLI lines", () => {
  assert.deepEqual(
    EnvMaterializeKit_formatResultLines([
      { changed: false, filePath: "/tmp/.env", status: "unchanged" },
    ]),
    ["[env-materialize] unchanged /tmp/.env"],
  );
});

void test("EnvMaterializeKit seed helpers read optional env files and select profiles", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-materialize-kit-seeds-"));
  try {
    const machineOverridesDirPath = path.join(tempDir, "machine-overrides");
    fs.mkdirSync(path.join(machineOverridesDirPath, "beta"), { recursive: true });
    fs.mkdirSync(path.join(machineOverridesDirPath, "alpha"), { recursive: true });
    fs.mkdirSync(path.join(machineOverridesDirPath, ".hidden"), { recursive: true });
    fs.writeFileSync(path.join(machineOverridesDirPath, "not-dir"), "ignored", "utf8");

    assert.deepEqual(
      EnvMaterializeKit_listMachineProfileNames({ machineOverridesDirPath }),
      ["alpha", "beta"],
    );
    assert.equal(
      EnvMaterializeKit_resolveMachineProfile({
        developerSlugKey: "DEVELOPER_SLUG",
        existingValues: new Map([["DEVELOPER_SLUG", "beta"]]),
        machineProfileNames: ["alpha", "beta"],
      }),
      "beta",
    );
    assert.equal(
      EnvMaterializeKit_resolveMachineProfile({
        developerSlugKey: "DEVELOPER_SLUG",
        existingValues: new Map(),
        explicitMachineProfile: "explicit",
        machineProfileNames: ["alpha", "beta"],
      }),
      "explicit",
    );

    const seedFilePath = path.join(tempDir, "seed.env");
    fs.writeFileSync(seedFilePath, "export A=1\nB='two'\n# ignored\n", "utf8");
    assert.deepEqual(
      [...EnvMaterializeKit_readOptionalEnvFile({ filePath: seedFilePath })],
      [
        ["A", "1"],
        ["B", "two"],
      ],
    );
    assert.deepEqual(
      [...EnvMaterializeKit_readOptionalEnvFile({ filePath: path.join(tempDir, "missing.env") })],
      [],
    );
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

void test("EnvMaterializeKit_loadSeedFiles loads required and optional seed maps", () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "env-materialize-kit-seed-load-"),
  );
  try {
    const machineOverridesDirPath = path.join(tempDir, "machine-overrides");
    const machineProfile = "alpha";
    const machineProfileDir = path.join(machineOverridesDirPath, machineProfile);
    fs.mkdirSync(machineProfileDir, { recursive: true });

    const requiredSeedFilePath = path.join(tempDir, "required.env");
    const seedDefaultsFilePath = path.join(tempDir, "defaults.env");
    const machineOverrideFilePath = path.join(machineProfileDir, "runtime.env");
    fs.writeFileSync(requiredSeedFilePath, "A=required\n", "utf8");
    fs.writeFileSync(seedDefaultsFilePath, "DEFAULT=1\n", "utf8");
    fs.writeFileSync(machineOverrideFilePath, "OVERRIDE=1\n", "utf8");

    const loadedSeedFiles = EnvMaterializeKit_loadSeedFiles({
      developerSlugKey: "DEVELOPER_SLUG",
      existingValues: new Map([["DEVELOPER_SLUG", machineProfile]]),
      loadRequiredSeedFile: ({ filePath }) => ({
        scopedOverrideValuesByPackageId: new Map([
          ["package-a", new Map([["PACKAGE_KEY", filePath]])],
        ]),
        valuesByKey: EnvMaterializeKit_readOptionalEnvFile({ filePath }),
      }),
      machineOverrideFilePathForProfile: ({ machineProfile }) =>
        path.join(machineOverridesDirPath, machineProfile, "runtime.env"),
      machineOverridesDirPath,
      requiredSeedFileDescription: "required seed file",
      requiredSeedFilePath,
      seedDefaultsFilePath,
    });

    assert.equal(loadedSeedFiles.machineProfile, machineProfile);
    assert.equal(loadedSeedFiles.machineOverrideFilePath, machineOverrideFilePath);
    assert.deepEqual([...loadedSeedFiles.requiredSeedFile.valuesByKey], [
      ["A", "required"],
    ]);
    assert.deepEqual([...loadedSeedFiles.machineOverrideValues], [
      ["OVERRIDE", "1"],
    ]);
    assert.deepEqual([...loadedSeedFiles.seedDefaultValues], [["DEFAULT", "1"]]);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});
