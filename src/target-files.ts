/**
 * @fileoverview Config-driven target-file resolution for env materialization commands.
 *
 * Flow: workspace path + selected target groups + project config -> concrete managed env targets.
 *
 * @testing CLI: npm run env-materialize-kit:test
 * @see packages/env-materialize-kit/src/modes.ts - Declares `EnvMaterializeKit_Target` and target-group literals this resolver consults when mapping selected groups to filesystem paths.
 * @see packages/env-materialize-kit/src/target-runner.ts - Materialization runner that imports these target definitions to pair each destination env file with its reference template path.
 * @see packages/env-materialize-kit/src/target-files.unit.test.ts - Node `node:test` regression file asserting stable resolution order, optional-checkout skipping, and missing-reference failures for `EnvMaterializeKit_resolveTargetFiles`.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";

import type { EnvMaterializeKit_Target } from "./modes.js";

/** Package-level target metadata supplied by a project config file. */
export type EnvMaterializeKit_PackageDefinition<PackageId extends string = string> = {
  id: PackageId;
  isOptionalCheckout?: boolean;
  referenceEnvFileName: string;
};

/** Resolved target for the workspace-level local-edge env file. */
export type EnvMaterializeKit_LocalEdgeTargetFileDefinition = {
  filePath: string;
  id: "local-edge";
  referenceFilePath: string;
  targetType: "local-edge";
};

/** Resolved target for one package-local `.env` file. */
export type EnvMaterializeKit_PackageTargetFileDefinition<
  PackageId extends string = string,
> = {
  filePath: string;
  id: PackageId;
  packageId: PackageId;
  referenceFilePath: string;
  targetType: "package-env";
};

/** Resolved target-file definition consumed by env materialization writers. */
export type EnvMaterializeKit_TargetFileDefinition<PackageId extends string = string> =
  | EnvMaterializeKit_LocalEdgeTargetFileDefinition
  | EnvMaterializeKit_PackageTargetFileDefinition<PackageId>;

/** Options for resolving selected target groups into concrete target files. */
export type EnvMaterializeKit_ResolveTargetFiles_Options<
  PackageId extends string = string,
> = {
  fileExists?: (filePath: string) => boolean;
  localEdgeReferenceFilePath: string;
  packageDefinitions: readonly EnvMaterializeKit_PackageDefinition<PackageId>[];
  workspacePath: string;
  targets: readonly EnvMaterializeKit_Target[];
};

/** Resolves all target files requested by the selected target groups. */
export function EnvMaterializeKit_resolveTargetFiles<PackageId extends string>(
  options: EnvMaterializeKit_ResolveTargetFiles_Options<PackageId>,
): EnvMaterializeKit_TargetFileDefinition<PackageId>[] {
  const fileExists = options.fileExists ?? fs.existsSync;
  const resolvedTargets: EnvMaterializeKit_TargetFileDefinition<PackageId>[] = [];

  if (options.targets.includes("local-edge")) {
    resolvedTargets.push({
      filePath: path.join(options.workspacePath, ".env.local-edge"),
      id: "local-edge",
      referenceFilePath: options.localEdgeReferenceFilePath,
      targetType: "local-edge",
    });
  }

  if (options.targets.includes("packages")) {
    for (const definition of options.packageDefinitions) {
      const packageRoot = path.join(options.workspacePath, definition.id);
      const referenceFilePath = path.join(
        packageRoot,
        definition.referenceEnvFileName,
      );

      if (!fileExists(referenceFilePath)) {
        if (definition.isOptionalCheckout === true) {
          continue;
        }

        throw new Error(
          `[env-materialize] Missing reference env file for ${definition.id}: ` +
            referenceFilePath,
        );
      }

      resolvedTargets.push({
        filePath: path.join(packageRoot, ".env"),
        id: definition.id,
        packageId: definition.id,
        referenceFilePath,
        targetType: "package-env",
      });
    }
  }

  return resolvedTargets;
}
