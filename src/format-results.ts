/**
 * @fileoverview Reusable stable stdout formatting for env-materialize mutation results.
 *
 * Flow: mutation results -> grep-friendly stdout lines -> CLI output.
 *
 * @testing Package: `npm run env-materialize-kit:test`.
 *
 * @see packages/env-materialize-kit/src/write-target-file.ts - Owns EnvMaterializeKit_TargetMutationResult, the per-target status and path contract mapped into stable stdout lines here.
 * @see env-materialize.config.ts - Root env-materialize config injects EnvMaterializeKit_formatResultLines so orchestrated mutations print summaries through this formatter.
 * @see scripts/env-materialize/format-results.ts - Script-layer re-export that keeps scripts importing a local module while delegating stdout shaping to this package implementation.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import type { EnvMaterializeKit_TargetMutationResult } from "./write-target-file.js";

/** Formats write-target results into stable one-line log records for stdout. */
export function EnvMaterializeKit_formatResultLines(
  results: readonly EnvMaterializeKit_TargetMutationResult[],
): string[] {
  return results.map(
    (result) => `[env-materialize] ${result.status} ${result.filePath}`,
  );
}

/** Joins formatted result lines with newlines for one-shot CLI printing. */
export function EnvMaterializeKit_formatResultsStdout(
  results: readonly EnvMaterializeKit_TargetMutationResult[],
): string {
  return EnvMaterializeKit_formatResultLines(results).join("\n");
}
