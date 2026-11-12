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
export declare function EnvMaterializeKit_splitEnvLines(content: string): EnvMaterializeKit_EnvLine[];
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
export declare function EnvMaterializeKit_readAssignmentKey(text: string): {
    key: string;
    equalsIndex: number;
} | null;
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
export declare function EnvMaterializeKit_scanEnvAssignments(content: string): EnvMaterializeKit_EnvScan;
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
export declare function EnvMaterializeKit_formatEnvValue(key: string, value: string): string;
