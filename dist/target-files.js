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
/** Resolves all target files requested by the selected target groups. */
export function EnvMaterializeKit_resolveTargetFiles(options) {
    const fileExists = options.fileExists ?? fs.existsSync;
    const resolvedTargets = [];
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
            const referenceFilePath = path.join(packageRoot, definition.referenceEnvFileName);
            if (!fileExists(referenceFilePath)) {
                if (definition.isOptionalCheckout === true) {
                    continue;
                }
                throw new Error(`[env-materialize] Missing reference env file for ${definition.id}: ` +
                    referenceFilePath);
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
