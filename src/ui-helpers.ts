/**
 * @fileoverview Product-neutral helper primitives for env-materialize UI adapters.
 *
 * Flow: form field strings + configured target defaults + mutation results -> CLI values and
 * summary lines.
 *
 * @example
 * ```typescript
 * import {
 *   EnvMaterializeKit_formatMutationSummaryLines,
 *   EnvMaterializeKit_targetsFromChoice,
 * } from "./ui-helpers.js";
 *
 * const targets = EnvMaterializeKit_targetsFromChoice({
 *   choice: "all",
 *   defaultTargets: ["app", "worker"],
 * });
 * const lines = EnvMaterializeKit_formatMutationSummaryLines([
 *   { changed: true, filePath: "/tmp/.env.app", status: "wrote" },
 * ]);
 * ```
 *
 * @testing Node test: cd packages/env-materialize-kit && node ../../node_modules/tsx/dist/cli.mjs --test src/ui-helpers.unit.test.ts
 *
 * @see packages/env-materialize-kit/src/ink-wizard-model.ts - Ink wizard view model that imports `EnvMaterializeKit_TargetsChoice` from this module when mapping wizard target selections to selector rows.
 * @see packages/env-materialize-kit/src/ui-helpers.unit.test.ts - Node test suite that asserts field parsing, path resolution, target expansion, and mutation summary formatting owned here.
 * @see packages/env-materialize-kit/README.md - Package README that documents the `./ui-helpers` export surface and how kit UI helpers fit the env-materialize CLI stack.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import path from "node:path";

/** UI target chooser value where `all` expands to configured target defaults. */
export type EnvMaterializeKit_TargetsChoice<Target extends string> =
  | "all"
  | Target;

/** Minimal mutation result shape needed for UI summaries. */
export type EnvMaterializeKit_MutationSummaryInput = {
  changed: boolean;
  filePath: string;
  status: string;
};

/** Expands an `all` target chooser to default targets, otherwise returns the selected target. */
export function EnvMaterializeKit_targetsFromChoice<Target extends string>(options: {
  choice: EnvMaterializeKit_TargetsChoice<Target>;
  defaultTargets: readonly Target[];
}): Target[] {
  if (options.choice === "all") {
    return Array.from(options.defaultTargets);
  }
  return [options.choice];
}

/** Parses a blank-or-positive-integer UI form field. */
export function EnvMaterializeKit_parseOptionalPositiveIntegerField(options: {
  label: string;
  rawValue: string;
}): number | undefined {
  const trimmed = options.rawValue.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${options.label} must be a positive integer or blank.`);
  }
  return parsed;
}

/** Returns a trimmed non-empty string field value, or `undefined` for blanks. */
export function EnvMaterializeKit_resolveOptionalTrimmedStringField(
  rawValue: string,
): string | undefined {
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Resolves a path-like UI field relative to the caller cwd, or omits blank input. */
export function EnvMaterializeKit_resolveOptionalPathField(options: {
  currentWorkingDirectory: string;
  rawValue: string;
}): string | undefined {
  const trimmed = options.rawValue.trim();
  return trimmed.length > 0
    ? path.resolve(options.currentWorkingDirectory, trimmed)
    : undefined;
}

/** Formats write results into stable summary lines for CLI and preview screens. */
export function EnvMaterializeKit_formatMutationSummaryLines(
  results: readonly EnvMaterializeKit_MutationSummaryInput[],
): string[] {
  const changed = results.filter((result) => result.changed).length;
  const lines = [
    `Targets: ${results.length} file(s) reported.`,
    `Mutations (changed=true): ${changed}`,
  ];
  const byStatus = new Map<string, number>();
  for (const result of results) {
    byStatus.set(result.status, (byStatus.get(result.status) ?? 0) + 1);
  }
  for (const [status, count] of [...byStatus.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    lines.push(`  ${status}: ${count}`);
  }
  return lines;
}
