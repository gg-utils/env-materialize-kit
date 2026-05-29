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
export declare const EnvMaterializeKit_modes: readonly ["check", "create-if-missing", "sync-missing-or-blank", "restore-defaults"];
/** Supported historical target groups for workspace env materialization. */
export declare const EnvMaterializeKit_targets: readonly ["local-edge", "packages"];
/** Literal union type for supported materialization modes. */
export type EnvMaterializeKit_Mode = (typeof EnvMaterializeKit_modes)[number];
/** Literal union type for supported materialization target groups. */
export type EnvMaterializeKit_Target = (typeof EnvMaterializeKit_targets)[number];
/** Returns true when a string is a known materialization mode. */
export declare function EnvMaterializeKit_isMode(value: string): value is EnvMaterializeKit_Mode;
/** Returns true when a string is a known materialization target group. */
export declare function EnvMaterializeKit_isTarget(value: string): value is EnvMaterializeKit_Target;
//# sourceMappingURL=modes.d.ts.map