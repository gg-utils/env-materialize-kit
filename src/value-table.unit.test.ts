/**
 * @fileoverview Tests for table-driven value resolution.
 * @see src/value-table.ts - Module under test.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { EnvMaterializeKit_resolveValueTable, type EnvMaterializeKit_ValueRow } from "./value-table.js";

type Key = "HOST" | "PORT" | "ORIGIN" | "TOKEN" | "OPTIONAL";
const rows: EnvMaterializeKit_ValueRow<Key, { scheme: string }>[] = [
  { key: "HOST", sources: [{ kind: "seed", key: "PUBLIC_HOST" }, { kind: "seed", key: "FALLBACK_HOST" }], required: true },
  { key: "PORT", sources: [{ kind: "seed", key: "PUBLIC_PORT" }, { kind: "default", value: "8443" }] },
  { key: "ORIGIN", sources: [{ kind: "derived", label: "origin", derive: ({ context, resolved }) => {
    const host = resolved.get("HOST");
    return host === undefined ? undefined : `${context.scheme}://${host}:${resolved.get("PORT") ?? ""}`;
  } }], required: true },
  { key: "TOKEN", sources: [{ kind: "seed", key: "TOKEN" }], secret: true },
  { key: "OPTIONAL", sources: [{ kind: "seed", key: "OPTIONAL" }] },
];

void test("first non-blank source wins and derivations see earlier rows", () => {
  const result = EnvMaterializeKit_resolveValueTable({
    rows, context: { scheme: "https" },
    seedValues: new Map([["PUBLIC_HOST", "  "], ["FALLBACK_HOST", "edge.example.test"], ["TOKEN", "synthetic-token"]]),
  });
  assert.deepEqual(Object.fromEntries(result.valuesByKey), {
    HOST: "edge.example.test", PORT: "8443", ORIGIN: "https://edge.example.test:8443", TOKEN: "synthetic-token",
  });
  assert.deepEqual(Object.fromEntries(result.originByKey), {
    HOST: "seed:FALLBACK_HOST", PORT: "default", ORIGIN: "derived:origin", TOKEN: "seed:TOKEN",
  });
  assert.deepEqual(result.missingRequiredKeys, []);
  assert.deepEqual([...result.secretKeys], ["TOKEN"]);
});

void test("unresolved required rows are reported in table order; optional ones are skipped", () => {
  const result = EnvMaterializeKit_resolveValueTable({ rows, context: { scheme: "https" }, seedValues: new Map() });
  assert.deepEqual(result.missingRequiredKeys, ["HOST", "ORIGIN"]);
  assert.equal(result.valuesByKey.has("OPTIONAL"), false);
  assert.equal(result.secretKeys.has("TOKEN"), true);
});

void test("resolution never reads process.env", () => {
  process.env["PUBLIC_HOST"] = "from-process-env.example.test";
  try {
    const result = EnvMaterializeKit_resolveValueTable({ rows, context: { scheme: "https" }, seedValues: new Map() });
    assert.equal(result.valuesByKey.has("HOST"), false);
  } finally {
    delete process.env["PUBLIC_HOST"];
  }
});

void test("duplicate rows are refused", () => {
  assert.throws(() => EnvMaterializeKit_resolveValueTable({
    rows: [rows[1]!, rows[1]!], context: { scheme: "https" }, seedValues: new Map(),
  }), /Duplicate value table row: PORT/u);
});
