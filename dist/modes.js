/**
 * @fileoverview Product-neutral env materialization mode and target-group primitives.
 *
 * These literals describe reusable materialization workflow modes and the current target groups
 * exposed by the historical CLI. Project-owned config decides which concrete files each target
 * group resolves to.
 *
 * @testing Package: `npm run env-materialize-kit:test`.
 * @see env-materialize.config.ts - Root workspace materialization config imports these literals and type guards so CLI and wizard state stay aligned with the shared mode and target-group taxonomy.
 * @see packages/env-materialize-kit/src/cli-runner.ts - Interactive CLI runner imports EnvMaterializeKit_Mode when turning argv into a validated materialization plan that depends on the same closed-string sets.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Supported env materialization write policies. */
export const EnvMaterializeKit_modes = [
    "check",
    "create-if-missing",
    "sync-missing-or-blank",
    "restore-defaults",
];
/** Supported historical target groups for workspace env materialization. */
export const EnvMaterializeKit_targets = ["local-edge", "packages"];
const EnvMaterializeKit_modeSet = new Set(EnvMaterializeKit_modes);
const EnvMaterializeKit_targetSet = new Set(EnvMaterializeKit_targets);
/** Returns true when a string is a known materialization mode. */
export function EnvMaterializeKit_isMode(value) {
    return EnvMaterializeKit_modeSet.has(value);
}
/** Returns true when a string is a known materialization target group. */
export function EnvMaterializeKit_isTarget(value) {
    return EnvMaterializeKit_targetSet.has(value);
}
//# sourceMappingURL=modes.js.map