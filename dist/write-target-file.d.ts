/**
 * @fileoverview Reusable write-mode engine for managed env target files.
 *
 * Flow: desired env text + current file + reference template + explicit sync policy -> stable
 * target mutation result.
 *
 * @testing Node test unit: npm run test --prefix packages/env-materialize-kit from repository root runs the tsx-backed Node harness including EnvMaterializeKit_writeTargetFile merge and mode assertions in target-files.unit.test.ts.
 *
 * @see packages/env-materialize-core/src/env-document.ts - Parse, read, render, and normalize helpers this writer calls when diffing, merging desired keys into the on-disk document, and serializing the next env file body.
 * @see packages/env-materialize-kit/src/modes.ts - Mode literals (`check`, `create-if-missing`, `restore-defaults`, `sync-missing-or-blank`) that branch filesystem side effects, drift detection, and merge-vs-replace behavior inside EnvMaterializeKit_writeTargetFile.
 * @see packages/env-materialize-kit/src/target-runner.ts - Target orchestration layer that invokes the injected writeTargetFile callback so bulk kit runs apply consistent per-path mutation semantics.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
import type { EnvMaterializeKit_Mode } from "./modes.js";
/** Terminal status for a single env file write attempt. */
export type EnvMaterializeKit_TargetMutationResultStatus = "created" | "drift" | "missing" | "skipped-existing" | "synced" | "unchanged" | "updated";
/** Outcome of applying a write mode to one target env path. */
export type EnvMaterializeKit_TargetMutationResult = {
    changed: boolean;
    filePath: string;
    status: EnvMaterializeKit_TargetMutationResultStatus;
};
/** Explicit sync policy supplied by a project-owned config/adapter. */
export type EnvMaterializeKit_WriteSyncPolicy = {
    managedUrlKeys: readonly string[];
    placeholderExactValues: readonly string[];
    placeholderSubstrings: readonly string[];
};
/** Inputs for applying one env-materialize write mode to a single on-disk target path. */
export type EnvMaterializeKit_WriteTargetFileOptions = {
    desiredContent: string;
    filePath: string;
    mode: EnvMaterializeKit_Mode;
    referenceFilePath: string;
    syncPolicy: EnvMaterializeKit_WriteSyncPolicy;
};
/** Applies env-materialize write-mode semantics to one on-disk env file. */
export declare function EnvMaterializeKit_writeTargetFile(options: EnvMaterializeKit_WriteTargetFileOptions): EnvMaterializeKit_TargetMutationResult;
