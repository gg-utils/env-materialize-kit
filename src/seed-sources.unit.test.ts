/**
 * @fileoverview Tests for pluggable seed sources, ordered layering and machine profile selection.
 * @see src/seed-sources.ts - Module under test.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EnvMaterializeKit_createDirectorySeedSource,
  EnvMaterializeKit_createSeedSource,
  EnvMaterializeKit_loadSeedLayers,
  EnvMaterializeKit_mergeSeedLayers,
  EnvMaterializeKit_MissingSeedLayerError,
  EnvMaterializeKit_selectSeedMachineProfile,
  type EnvMaterializeKit_SeedFileSystem,
} from "./seed-sources.js";

const root = path.resolve("/synthetic/seeds");

/**
 * Builds an in-memory file system from relative file paths and contents.
 * @param files - Relative path to file text.
 * @returns A seed file system that never touches the disk.
 */
function memoryFileSystem(files: Record<string, string>): EnvMaterializeKit_SeedFileSystem {
  const absolute = new Map(Object.entries(files).map(([relative, text]) => [path.join(root, relative), text]));
  return {
    readTextFile: (absolutePath) => absolute.get(absolutePath) ?? null,
    listDirectoryNames: (absolutePath) => {
      const names = new Set<string>();
      for (const filePath of absolute.keys()) {
        const relative = path.relative(absolutePath, filePath);
        if (!relative.startsWith("..") && relative.includes(path.sep)) names.add(relative.split(path.sep)[0] ?? "");
      }
      return [...names].filter((name) => name.length > 0 && !name.startsWith(".")).sort();
    },
  };
}

const files = {
  "environments/local.env": "HOST=env.example.test\nPORT=3000\nMODE=env\n",
  "defaults/seed-defaults.env": "PORT=3100\nEXTRA=default\n",
  "machines/laptop/overrides.env": "HOST=laptop.example.test\nMODE=\n",
};
const layout = [
  { id: "environment", relativePath: "environments/local.env", required: true },
  { id: "defaults", relativePath: "defaults/seed-defaults.env", required: false },
  { id: "machine", relativePath: "machines/laptop/overrides.env", required: false },
];

void test("later layers win, blank values inherit, and origins name the layer", () => {
  const source = EnvMaterializeKit_createDirectorySeedSource({ rootPath: root, fileSystem: memoryFileSystem(files) });
  const merged = EnvMaterializeKit_mergeSeedLayers(EnvMaterializeKit_loadSeedLayers({ source, layers: layout }));
  assert.deepEqual(Object.fromEntries(merged.valuesByKey), {
    HOST: "laptop.example.test", PORT: "3100", MODE: "env", EXTRA: "default",
  });
  assert.deepEqual(Object.fromEntries(merged.layerIdByKey), {
    HOST: "machine", PORT: "defaults", MODE: "environment", EXTRA: "defaults",
  });
});

void test("optional layers may be absent; a missing required layer names the path only", () => {
  const source = EnvMaterializeKit_createDirectorySeedSource({
    rootPath: root, fileSystem: memoryFileSystem({ "defaults/seed-defaults.env": "SECRET_LIKE=do-not-print\n" }),
  });
  const optionalOnly = EnvMaterializeKit_loadSeedLayers({ source, layers: layout.slice(1) });
  assert.deepEqual(optionalOnly.map((layer) => layer.present), [true, false]);
  assert.throws(
    () => EnvMaterializeKit_loadSeedLayers({ source, layers: layout }),
    (error: unknown) => error instanceof EnvMaterializeKit_MissingSeedLayerError &&
      error.layerId === "environment" && error.message.includes("environments/local.env") &&
      !error.message.includes("do-not-print"),
  );
});

void test("seed paths cannot escape the source root", () => {
  const source = EnvMaterializeKit_createDirectorySeedSource({ rootPath: root, fileSystem: memoryFileSystem(files) });
  assert.throws(() => source.readEnvFile("../outside.env"), /escapes/u);
  assert.throws(() => source.readEnvFile("/etc/hosts"), /relative/u);
});

void test("machine profile: explicit wins, a single folder is inferred, typos fail", () => {
  const source = EnvMaterializeKit_createDirectorySeedSource({ rootPath: root, fileSystem: memoryFileSystem(files) });
  assert.deepEqual(EnvMaterializeKit_selectSeedMachineProfile({ source, machineOverridesPath: "machines" }),
    { machineProfile: "laptop", machineProfileNames: ["laptop"] });
  assert.equal(EnvMaterializeKit_selectSeedMachineProfile({
    source, machineOverridesPath: "machines", explicitMachineProfile: "laptop",
  }).machineProfile, "laptop");
  assert.throws(() => EnvMaterializeKit_selectSeedMachineProfile({
    source, machineOverridesPath: "machines", explicitMachineProfile: "desktop",
  }), /No machine override folder desktop/u);
  const two = EnvMaterializeKit_createDirectorySeedSource({ rootPath: root, fileSystem: memoryFileSystem({
    "machines/a/overrides.env": "", "machines/b/overrides.env": "",
  }) });
  assert.equal(EnvMaterializeKit_selectSeedMachineProfile({ source: two, machineOverridesPath: "machines" }).machineProfile, null);
});

void test("source kinds are pluggable through a factory registry", () => {
  const factories = new Map([
    ["directory", () => EnvMaterializeKit_createDirectorySeedSource({ rootPath: root, fileSystem: memoryFileSystem(files) })],
    ["fixed", () => ({
      kind: "fixed", description: "fixed test source",
      readEnvFile: () => new Map([["HOST", "fixed.example.test"]]), listDirectories: () => [],
    })],
  ]);
  const fixed = EnvMaterializeKit_createSeedSource({ config: { kind: "fixed" }, factories });
  assert.equal(fixed.readEnvFile("anything.env")?.get("HOST"), "fixed.example.test");
  assert.equal(EnvMaterializeKit_createSeedSource({ config: { kind: "directory" }, factories }).kind, "directory");
  assert.throws(() => EnvMaterializeKit_createSeedSource({ config: { kind: "vault" }, factories }),
    /Unknown seed source kind vault. Known kinds: directory, fixed/u);
});

void test("symlinks that lead outside the seed root are refused before reading", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "env-kit-seed-links-"));
  try {
    const root = path.join(base, "seeds");
    const outside = path.join(base, "outside");
    fs.mkdirSync(path.join(root, "environments"), { recursive: true });
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "secret.env"), "OUTSIDE=synthetic-outside\n");
    fs.writeFileSync(path.join(root, "environments", "local.env"), "INSIDE=1\n");
    fs.symlinkSync(path.join(outside, "secret.env"), path.join(root, "environments", "linked.env"));
    fs.symlinkSync(outside, path.join(root, "linked-folder"));
    fs.symlinkSync(path.join(root, "environments", "local.env"), path.join(root, "inside-link.env"));
    const source = EnvMaterializeKit_createDirectorySeedSource({ rootPath: root });
    assert.equal(source.readEnvFile("environments/local.env")?.get("INSIDE"), "1");
    assert.equal(source.readEnvFile("inside-link.env")?.get("INSIDE"), "1");
    for (const relativePath of ["environments/linked.env", "linked-folder/secret.env", "linked-folder/missing.env"]) {
      assert.throws(() => source.readEnvFile(relativePath), /outside the source root through a symlink/u, relativePath);
    }
    assert.throws(() => source.listDirectories("linked-folder"), /through a symlink/u);
    const viaLinkedRoot = path.join(base, "root-link");
    fs.symlinkSync(root, viaLinkedRoot);
    const linkedRootSource = EnvMaterializeKit_createDirectorySeedSource({ rootPath: viaLinkedRoot });
    assert.equal(linkedRootSource.readEnvFile("environments/local.env")?.get("INSIDE"), "1");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

void test("seed files are read with the dotenv grammar of util.parseEnv", () => {
  const source = EnvMaterializeKit_createDirectorySeedSource({
    rootPath: "/seeds",
    fileSystem: {
      readTextFile: () => "export A='x #y'\nB=plain # comment\nC=\"one\ntwo\"\n",
      listDirectoryNames: () => [],
    },
  });
  assert.deepEqual([...(source.readEnvFile("a.env") ?? new Map<string, string>())], [["A", "x #y"], ["B", "plain"], ["C", "one\ntwo"]]);
});
