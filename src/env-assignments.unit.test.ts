/**
 * @fileoverview Tests for span-aware dotenv scanning and dotenv-safe value formatting.
 * @see src/env-assignments.ts - Module under test.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseEnv } from "node:util";

import {
  EnvMaterializeKit_formatEnvValue,
  EnvMaterializeKit_scanEnvAssignments,
  EnvMaterializeKit_splitEnvLines,
} from "./env-assignments.js";

const ROUND_TRIP_VALUES: Record<string, string> = {
  plain: "synthetic-plain_value.1",
  hash: "synthetic #not-a-comment",
  hashNoSpace: "synthetic#value",
  singleQuote: "it's synthetic",
  doubleQuote: 'say "synthetic"',
  bothQuotes: `it's "synthetic"`,
  newline: "synthetic-line-one\nsynthetic-line-two",
  newlineWithQuotes: "line 'one'\nline \"two\"",
  literalBackslashN: "synthetic\\nnot-a-newline",
  newlineAndLiteralBackslashN: "a\\nb\nc",
  equals: "a=b==c",
  leadingAndTrailingSpaces: "  synthetic padded  ",
  dollar: "synthetic$HOME-value",
  backslash: "C:\\synthetic\\path",
  empty: "",
  onlySpaces: "   ",
  urlWithQuery: "https://app.example.test/cb?a=1&b=2#frag",
};

void test("every formatted value round-trips through util.parseEnv and the kit scanner", () => {
  for (const [name, value] of Object.entries(ROUND_TRIP_VALUES)) {
    const formatted = EnvMaterializeKit_formatEnvValue("K", value);
    const text = `# before\nK=${formatted}\nAFTER=1\n`;
    assert.equal(parseEnv(text)["K"], value, `node round trip: ${name}`);
    assert.equal(parseEnv(text)["AFTER"], "1", `following key survives: ${name}`);
    const scanned = EnvMaterializeKit_scanEnvAssignments(text).assignments;
    assert.deepEqual(scanned.map((entry) => entry.key), ["K", "AFTER"], `scanner keys: ${name}`);
    assert.equal(scanned[0]?.value, value, `scanner value: ${name}`);
  }
});

void test("plain values stay unquoted; others pick a quote they do not contain", () => {
  assert.equal(EnvMaterializeKit_formatEnvValue("K", "plain-1"), "plain-1");
  assert.equal(EnvMaterializeKit_formatEnvValue("K", "a #b"), "'a #b'");
  assert.equal(EnvMaterializeKit_formatEnvValue("K", "it's"), '"it\'s"');
  assert.equal(EnvMaterializeKit_formatEnvValue("K", "x\ny"), '"x\\ny"');
});

void test("values that cannot round-trip are refused by key name only", () => {
  for (const value of ["synthetic\rcarriage", "a'b\"c`d", "a'b\"c`d\ne"]) {
    assert.throws(
      () => EnvMaterializeKit_formatEnvValue("BAD_KEY", value),
      (error: unknown) =>
        error instanceof Error && error.message.includes("BAD_KEY") && !error.message.includes(value),
    );
  }
});

void test("scanning keeps every byte, line endings and multiline spans", () => {
  const text = "export A = 'x' # c\r\n\r\nB=\"one\nC=inside\ntwo\"\nD=4";
  const lines = EnvMaterializeKit_splitEnvLines(text);
  assert.equal(lines.map((line) => line.text + line.ending).join(""), text);
  const scan = EnvMaterializeKit_scanEnvAssignments(text);
  assert.deepEqual(
    scan.assignments.map((entry) => [entry.key, entry.startLine, entry.endLine, entry.value]),
    [
      ["A", 0, 0, "x"],
      ["B", 2, 4, "one\nC=inside\ntwo"],
      ["D", 5, 5, "4"],
    ],
  );
  assert.equal(scan.assignments[0]?.prefix, "export A = ");
  assert.equal(scan.assignments[0]?.suffix, " # c");
  const node = parseEnv(text);
  for (const entry of scan.assignments) {
    assert.equal(entry.value, node[entry.key], `scanner agrees with node: ${entry.key}`);
  }
});
