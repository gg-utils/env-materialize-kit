/**
 * @fileoverview Product-neutral target-file iteration for env materialization runs.
 *
 * This file owns the exported iterator that renders each resolved env target and forwards it to an
 * injected write callback, collecting per-target results in traversal order.
 * Flow: resolved target definitions + render callbacks + write callback -> mutation results.
 *
 * @testing CLI: npm run env-materialize-kit:test
 * @see packages/env-materialize-kit/src/target-files.ts - Resolver that emits discriminated target definitions, destination paths, and reference template paths consumed during iteration.
 * @see packages/env-materialize-kit/src/modes.ts - Declares `EnvMaterializeKit_Mode` threaded through each write so downstream policies distinguish check-only versus mutating runs.
 * @see env-materialize.config.ts - Root env-materialize adapter wiring `EnvMaterializeKit_resolveTargetFiles`, workspace renderers, and `envMaterializeWriteTargetFile` through this runner for production CLI flows.
 * @see packages/env-materialize-kit/src/target-runner.unit.test.ts - Node `node:test` coverage for render/write ordering and per-target result collection for `EnvMaterializeKit_runTargetFiles`.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import type { EnvMaterializeKit_Mode } from "./modes.js";
import type {
  EnvMaterializeKit_LocalEdgeTargetFileDefinition,
  EnvMaterializeKit_PackageTargetFileDefinition,
  EnvMaterializeKit_TargetFileDefinition,
} from "./target-files.js";

/** Minimal rendered env target payload consumed by the package-owned target runner. */
export type EnvMaterializeKit_RenderedTarget = {
  content: string;
};

/** Write callback payload assembled from a rendered target and its resolved file definition. */
export type EnvMaterializeKit_RunTargetFilesWriteOptions<
  Mode extends EnvMaterializeKit_Mode = EnvMaterializeKit_Mode,
> = {
  desiredContent: string;
  filePath: string;
  mode: Mode;
  referenceFilePath: string;
};

/** Options for package-owned target-file iteration. */
export type EnvMaterializeKit_RunTargetFilesOptions<
  PackageId extends string,
  Mode extends EnvMaterializeKit_Mode,
  Result,
> = {
  mode: Mode;
  renderLocalEdgeTarget: (options: {
    target: EnvMaterializeKit_LocalEdgeTargetFileDefinition;
  }) => EnvMaterializeKit_RenderedTarget;
  renderPackageTarget: (options: {
    target: EnvMaterializeKit_PackageTargetFileDefinition<PackageId>;
  }) => EnvMaterializeKit_RenderedTarget;
  targetFiles: readonly EnvMaterializeKit_TargetFileDefinition<PackageId>[];
  writeTargetFile: (
    options: EnvMaterializeKit_RunTargetFilesWriteOptions<Mode>,
  ) => Result;
};

/** Result envelope returned by package-owned target-file iteration. */
export type EnvMaterializeKit_RunTargetFilesResult<Result> = {
  results: Result[];
};

/** Iterates resolved env target files, renders each one, and forwards it to the write callback. */
export function EnvMaterializeKit_runTargetFiles<
  PackageId extends string,
  Mode extends EnvMaterializeKit_Mode,
  Result,
>(
  options: EnvMaterializeKit_RunTargetFilesOptions<PackageId, Mode, Result>,
): EnvMaterializeKit_RunTargetFilesResult<Result> {
  const results: Result[] = [];

  for (const target of options.targetFiles) {
    const renderedTarget =
      target.targetType === "local-edge"
        ? options.renderLocalEdgeTarget({ target })
        : options.renderPackageTarget({ target });

    results.push(
      options.writeTargetFile({
        desiredContent: renderedTarget.content,
        filePath: target.filePath,
        mode: options.mode,
        referenceFilePath: target.referenceFilePath,
      }),
    );
  }

  return {
    results,
  };
}
