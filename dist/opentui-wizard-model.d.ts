/**
 * @fileoverview Product-neutral view-model helpers for env-materialize OpenTUI wizards.
 *
 * Script adapters keep React/OpenTUI rendering, project logical-environment ids, private seed
 * lookup, CLI option building, and subprocess execution. This module owns reusable route ordering,
 * select-option assembly, selected-index lookup, profile-discovery root selection, and materializer
 * output summarization.
 *
 * @testing Node test runner: npm run env-materialize-kit:test
 *
 * @see packages/env-materialize-kit/src/opentui-app.tsx - OpenTUI wizard shell that imports route ordering, select rows, profile-root resolution, and materializer output summarization from this module during interactive env-materialize runs.
 * @see packages/env-materialize-kit/src/opentui-jsx.d.ts - JSX intrinsic `select` and `tab-select` prop typings that mirror the `EnvMaterializeKit_OpenTuiSelectOption` shape owned here for OpenTUI controls.
 * @see packages/env-materialize-kit/src/opentui-wizard-model.unit.test.ts - Node `node:test` suite that asserts option builders, route index mapping, profile discovery roots, and stdout summarization helpers owned here.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Wizard route key for env-materialize OpenTUI route machines. */
export type EnvMaterializeKit_OpenTuiWizardRoute = "advanced" | "logicalEnv" | "machineProfile" | "mode" | "preview" | "result" | "running" | "targets" | "workspace";
/** Stable option row shape consumed by OpenTUI select/tab-select controls. */
export type EnvMaterializeKit_OpenTuiSelectOption = {
    readonly description: string;
    readonly name: string;
    readonly value: string;
};
/** Routes before the preview/run/result terminal screens. */
export declare const EnvMaterializeKit_OpenTuiRoutesBeforePreview: readonly EnvMaterializeKit_OpenTuiWizardRoute[];
/** Resolves a filesystem path for profile discovery, falling back for blank input. */
export declare function EnvMaterializeKit_resolveOpenTuiProfileDiscoveryRoot(options: {
    readonly fallbackRoot: string;
    readonly rawPath: string;
}): string;
/** Builds standard forward/back/quit choices for linear wizard steps before preview. */
export declare function EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions(options: {
    readonly continueLabel: string;
}): EnvMaterializeKit_OpenTuiSelectOption[];
/** Builds preview-screen navigation choices. */
export declare function EnvMaterializeKit_buildOpenTuiRunBackQuitOptions(): EnvMaterializeKit_OpenTuiSelectOption[];
/** Builds post-run navigation choices. */
export declare function EnvMaterializeKit_buildOpenTuiResultOptions(): EnvMaterializeKit_OpenTuiSelectOption[];
/** Builds mode select options from a project-supplied mode list. */
export declare function EnvMaterializeKit_buildOpenTuiModeOptions<Mode extends string>(options: {
    readonly modes: readonly Mode[];
}): EnvMaterializeKit_OpenTuiSelectOption[];
/** Builds logical-environment select options from a project-supplied id list. */
export declare function EnvMaterializeKit_buildOpenTuiLogicalEnvironmentOptions<LogicalEnvironmentId extends string>(options: {
    readonly logicalEnvironmentIds: readonly LogicalEnvironmentId[];
}): EnvMaterializeKit_OpenTuiSelectOption[];
/** Builds target choice select options for the package-owned target families. */
export declare function EnvMaterializeKit_buildOpenTuiTargetsOptions(): EnvMaterializeKit_OpenTuiSelectOption[];
/** Builds machine-profile select options from discovered profile names. */
export declare function EnvMaterializeKit_buildOpenTuiMachineProfileOptions(options: {
    readonly emptyDescription: string;
    readonly emptyName: string;
    readonly profiles: readonly string[];
}): EnvMaterializeKit_OpenTuiSelectOption[];
/** Returns selected option index for a value, defaulting to zero when the value is absent. */
export declare function EnvMaterializeKit_findOpenTuiSelectedOptionIndex(options: {
    readonly options: readonly EnvMaterializeKit_OpenTuiSelectOption[];
    readonly selectedValue: string;
}): number;
/** Maps a route to its index within the linear pre-preview sequence, or the preview bucket. */
export declare function EnvMaterializeKit_openTuiRouteIndex(options: {
    readonly route: EnvMaterializeKit_OpenTuiWizardRoute;
    readonly routesBeforePreview?: readonly EnvMaterializeKit_OpenTuiWizardRoute[];
}): number;
/** Summarizes materializer stdout/stderr using canonical `[env-materialize]` lines when present. */
export declare function EnvMaterializeKit_summarizeOpenTuiMaterializerOutput(options: {
    readonly stderr: string;
    readonly stdout: string;
}): string;
