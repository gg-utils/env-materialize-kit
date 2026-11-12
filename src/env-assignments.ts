/**
 * @fileoverview Span-aware dotenv scanning and dotenv-safe value formatting.
 *
 * The grammar is the one Node implements in `util.parseEnv` (and `node --env-file`): `#`
 * comments, an optional `export` prefix, unquoted values that end at `#`, and values in
 * single quotes, double quotes or backticks that may span lines. Inside double quotes `\n`
 * becomes a line break; no other escape exists. Values are decoded with `util.parseEnv`
 * itself, so this module and Node always agree on what a file holds.
 *
 * Scanning keeps every byte of the input: each physical line keeps its own line ending, and
 * each assignment records the lines it spans, so a writer can replace one assignment and
 * leave every other byte as it was.
 *
 * Flow: env text -> lines with endings -> assignments with line spans and decoded values.
 *
 * @example
 * ```typescript
 * const scan = EnvMaterializeKit_scanEnvAssignments("A=1\r\nB=\"x\ny\"\n");
 * scan.assignments.map((entry) => entry.key); // ["A", "B"]
 * EnvMaterializeKit_formatEnvValue("SECRET", "a #b"); // "'a #b'"
 * ```
 *
 * @testing Node test unit: npm test runs src/env-assignments.unit.test.ts.
 * @see src/managed-keys.ts - Replaces managed assignment spans using this scanner.
 * @see src/env-assignments.unit.test.ts - Round-trip tests through `util.parseEnv`.
 */

import { parseEnv } from "node:util";

/** One physical line of an env file. */
export type EnvMaterializeKit_EnvLine = {
  /** Line text without its line ending; a trailing carriage return is part of the ending. */
  text: string;
  /** The line ending as found: `\r\n`, `\n`, or empty for a last line without one. */
  ending: string;
};

/** One assignment found in an env file. */
export type EnvMaterializeKit_EnvAssignment = {
  /** Key as Node reads it: text before `=`, trimmed, without an `export` prefix. */
  key: string;
  /** Index of the first line of the assignment. */
  startLine: number;
  /** Index of the last line; greater than `startLine` for a quoted multiline value. */
  endLine: number;
  /** Text of the first line up to where the value starts, kept when the value is replaced. */
  prefix: string;
  /** Text after the value on the last line, such as an inline comment, kept on replace. */
  suffix: string;
  /** Value as Node decodes it. It may be a secret; never print it. */
  value: string;
};

/** Result of scanning env text. */
export type EnvMaterializeKit_EnvScan = {
  /** Every physical line, in order. Joining `text + ending` gives back the input exactly. */
  lines: EnvMaterializeKit_EnvLine[];
  /** Assignments in file order. A key may appear more than once; Node keeps the last. */
  assignments: EnvMaterializeKit_EnvAssignment[];
};

/** Quote characters Node accepts around a value. */
const QUOTES = ["'", '"', "`"] as const;

/** Characters that need no quoting in an unquoted value. */
const PLAIN_VALUE = /^[A-Za-z0-9_@%+,./:=?&~!^*|<>[\]{}()-]+$/u;

/**
 * Splits text into physical lines, keeping each line's ending.
 *
 * @param content - Env text.
 * @returns Lines whose `text + ending` concatenate back to `content`.
 * @example
 * ```typescript
 * EnvMaterializeKit_splitEnvLines("A=1\r\nB=2"); // [{ text: "A=1", ending: "\r\n" }, { text: "B=2", ending: "" }]
 * ```
 */
export function EnvMaterializeKit_splitEnvLines(content: string): EnvMaterializeKit_EnvLine[] {
  const lines: EnvMaterializeKit_EnvLine[] = [];
  let start = 0;
  while (start < content.length) {
    const newline = content.indexOf("\n", start);
    if (newline < 0) {
      lines.push({ text: content.slice(start), ending: "" });
      break;
    }
    const crlf = newline > start && content[newline - 1] === "\r";
    lines.push({
      text: content.slice(start, crlf ? newline - 1 : newline),
      ending: crlf ? "\r\n" : "\n",
    });
    start = newline + 1;
  }
  return lines;
}

/**
 * Reads the key of an assignment line the way Node does, or null for comments, blank lines
 * and lines without `=`.
 *
 * @param text - One line without its ending.
 * @returns The key and the index of `=`, or null.
 * @example
 * ```typescript
 * EnvMaterializeKit_readAssignmentKey("export A = 1"); // { key: "A", equalsIndex: 9 }
 * ```
 */
export function EnvMaterializeKit_readAssignmentKey(
  text: string,
): { key: string; equalsIndex: number } | null {
  const trimmed = text.trimStart();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }
  const equalsIndex = text.indexOf("=");
  if (equalsIndex < 0) {
    return null;
  }
  const key = text.slice(0, equalsIndex).trim().replace(/^export\s+/u, "");
  return key.length === 0 ? null : { key, equalsIndex };
}

/**
 * Finds the line holding the closing quote of a value that opens on line `startLine`.
 *
 * @param lines - Every line of the file.
 * @param startLine - Line where the value opens.
 * @param valueStart - Index in that line of the opening quote.
 * @returns The closing line and the index of the quote in it, or null when it never closes.
 * @example
 * ```typescript
 * EnvMaterializeKit_findClosingQuote(lines, 0, 2);
 * ```
 */
function EnvMaterializeKit_findClosingQuote(
  lines: readonly EnvMaterializeKit_EnvLine[],
  startLine: number,
  valueStart: number,
): { line: number; index: number } | null {
  const first = lines[startLine];
  if (first === undefined) {
    return null;
  }
  const quote = first.text.charAt(valueStart);
  const sameLine = first.text.indexOf(quote, valueStart + 1);
  if (sameLine >= 0) {
    return { line: startLine, index: sameLine };
  }
  for (let line = startLine + 1; line < lines.length; line++) {
    const index = (lines[line]?.text ?? "").indexOf(quote);
    if (index >= 0) {
      return { line, index };
    }
  }
  return null;
}

/**
 * Scans env text into lines and assignments with their line spans. Values are decoded by
 * `util.parseEnv` from each assignment's own text, so they match what Node reads.
 *
 * @param content - Env text.
 * @returns Lines and assignments.
 * @example
 * ```typescript
 * const scan = EnvMaterializeKit_scanEnvAssignments("# c\nexport A='x'\n");
 * scan.assignments[0]?.key; // "A"
 * ```
 */
export function EnvMaterializeKit_scanEnvAssignments(content: string): EnvMaterializeKit_EnvScan {
  const lines = EnvMaterializeKit_splitEnvLines(content);
  const assignments: EnvMaterializeKit_EnvAssignment[] = [];
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index]?.text ?? "";
    const head = EnvMaterializeKit_readAssignmentKey(text);
    if (head === null) {
      continue;
    }
    const afterEquals = text.slice(head.equalsIndex + 1);
    const valueStart = head.equalsIndex + 1 + (afterEquals.length - afterEquals.trimStart().length);
    const prefix = text.slice(0, valueStart);
    const opening = text.charAt(valueStart);
    let endLine = index;
    let suffix: string;
    if ((QUOTES as readonly string[]).includes(opening)) {
      const closing = EnvMaterializeKit_findClosingQuote(lines, index, valueStart);
      if (closing === null) {
        suffix = "";
      } else {
        endLine = closing.line;
        suffix = (lines[endLine]?.text ?? "").slice(closing.index + 1);
      }
    } else {
      const rest = text.slice(valueStart);
      const hash = rest.indexOf("#");
      const valuePart = hash < 0 ? rest : rest.slice(0, hash);
      suffix = rest.slice(valuePart.trimEnd().length);
    }
    const spanText = `${lines
      .slice(index, endLine + 1)
      .map((line) => line.text)
      .join("\n")}\n`;
    const value = parseEnv(spanText)[head.key] ?? "";
    assignments.push({ key: head.key, startLine: index, endLine, prefix, suffix, value });
    index = endLine;
  }
  return { lines, assignments };
}

/**
 * Formats a value so Node's dotenv parser reads it back exactly. Plain values stay
 * unquoted; others are quoted with a quote character the value does not contain. A line
 * break is written as `\n` inside double quotes when that is unambiguous. Every result is
 * checked by parsing it back with `util.parseEnv`.
 *
 * @param key - Key name, used only in the error message.
 * @param value - Value to format. It may be a secret; it is never put in an error.
 * @returns The right-hand side of the assignment.
 * @throws Error naming the key, never the value, when no quoting round-trips (for example a
 * carriage return, or a value that holds every quote character and a line break).
 * @example
 * ```typescript
 * EnvMaterializeKit_formatEnvValue("A", "plain"); // "plain"
 * EnvMaterializeKit_formatEnvValue("A", "it's #1"); // "\"it's #1\""
 * EnvMaterializeKit_formatEnvValue("A", "x\ny"); // "\"x\\ny\""
 * ```
 */
export function EnvMaterializeKit_formatEnvValue(key: string, value: string): string {
  const refuse = (): Error =>
    new Error(`[env-materialize] Value for ${key} cannot be written safely as a dotenv value`);
  if (value.includes("\r")) {
    throw refuse();
  }
  const candidates: string[] = [];
  if (value.length === 0 || PLAIN_VALUE.test(value)) {
    candidates.push(value);
  }
  const multiline = value.includes("\n");
  if (multiline && !value.includes('"') && !value.includes("\\n")) {
    candidates.push(`"${value.replaceAll("\n", "\\n")}"`);
  }
  for (const quote of QUOTES) {
    if (value.includes(quote)) {
      continue;
    }
    if (quote === '"' && value.includes("\\n")) {
      continue;
    }
    candidates.push(`${quote}${value}${quote}`);
  }
  for (const candidate of candidates) {
    if (parseEnv(`K=${candidate}\n`)["K"] === value) {
      return candidate;
    }
  }
  throw refuse();
}
