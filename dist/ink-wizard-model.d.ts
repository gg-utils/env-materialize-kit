/**
 * @fileoverview Product-neutral view-model helpers for env-materialize Ink wizards.
 *
 * Script adapters keep React/Ink rendering, project-owned logical-environment ids, private seed
 * lookup, and subprocess side effects. This module owns reusable wizard step ordering, list index
 * lookup, path-root selection, target-choice display indexes, mutation summary lines, result labels,
 * and keyboard legend text.
 *
 * @testing Node test runner: npm run env-materialize-kit:test
 *
 * @see packages/env-materialize-kit/src/ink-app.tsx - React/Ink wizard shell that imports these helpers for step order, legends, profile-root resolution, and preflight summaries during interactive env-materialize runs.
 * @see packages/env-materialize-kit/src/ink-wizard-model.unit.test.ts - Node `node:test` suite that asserts wizard step ordering, legend copy, profile discovery roots, and target-choice index helpers owned here.
 * @see packages/env-materialize-kit/src/ui-helpers.ts - `EnvMaterializeKit_TargetsChoice` typing consumed when mapping wizard `targetsChoice` values to selector row indexes in this view model.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
import type { EnvMaterializeKit_TargetsChoice } from "./ui-helpers.js";
import type { EnvMaterializeKit_Target } from "./modes.js";
/** Wizard step identifier used for env-materialize Ink navigation order. */
export type EnvMaterializeKit_InkWizardStepId = "advanced" | "canonicalRoot" | "logicalEnv" | "machineProfile" | "mode" | "privateNotes" | "result" | "review" | "session" | "targets" | "workspace";
/** Terminal status captured after a spawned env-materialize command finishes or is cancelled. */
export type EnvMaterializeKit_InkSessionDoneStatus = "cancelled" | "failed" | "succeeded";
/** Minimal mutation result shape rendered in preflight summaries. */
export type EnvMaterializeKit_InkMutationRunSummaryInput = {
    readonly filePath: string;
    readonly status: string;
};
/** Stable pre-session wizard order. Terminal `session` and `result` are intentionally excluded. */
export declare const EnvMaterializeKit_InkWizardStepOrder: readonly EnvMaterializeKit_InkWizardStepId[];
/** Display labels for target choice selector rows. */
export declare const EnvMaterializeKit_InkTargetChoiceLabels: readonly string[];
/** Resolves the filesystem root used for machine-profile discovery. */
export declare function EnvMaterializeKit_resolveInkProfileDiscoveryRoot(options: {
    readonly fallbackRoot: string;
    readonly privateNotesWorkspacePath: string;
    readonly workspacePath: string;
}): string;
/** Returns the selected value index in a list, defaulting to zero for missing values. */
export declare function EnvMaterializeKit_findSelectedValueIndex<Value extends string>(options: {
    readonly selectedValue: Value;
    readonly values: readonly Value[];
}): number;
/** Returns the selected machine-profile label index, treating the configured empty label as blank. */
export declare function EnvMaterializeKit_findMachineProfileLabelIndex(options: {
    readonly emptyLabel: string;
    readonly labels: readonly string[];
    readonly machineProfile: string;
}): number;
/** Returns whether a machine-profile label matches the current model value. */
export declare function EnvMaterializeKit_isMachineProfileLabelMatch(options: {
    readonly emptyLabel: string;
    readonly label: string;
    readonly machineProfile: string;
}): boolean;
/** Maps the wizard target choice to the display row index. */
export declare function EnvMaterializeKit_targetChoiceSelectedIndex(options: {
    readonly targetsChoice: EnvMaterializeKit_TargetsChoice<EnvMaterializeKit_Target>;
}): number;
/** Formats one-line mutation summaries for preflight output. */
export declare function EnvMaterializeKit_formatInkMutationRunSummaryLines(results: readonly EnvMaterializeKit_InkMutationRunSummaryInput[]): string[];
/** Formats the result step status label. */
export declare function EnvMaterializeKit_getInkSessionDoneStatusLabel(status: EnvMaterializeKit_InkSessionDoneStatus): string;
/** Returns the contextual keyboard legend for an env-materialize Ink wizard step. */
export declare function EnvMaterializeKit_getInkWizardLegendLines(options: {
    readonly buildError: string | null;
    readonly step: EnvMaterializeKit_InkWizardStepId;
}): string[];
/** Resolves the previous non-terminal wizard step from the configured order. */
export declare function EnvMaterializeKit_resolvePreviousInkWizardStep(options: {
    readonly currentStep: EnvMaterializeKit_InkWizardStepId;
    readonly order?: readonly EnvMaterializeKit_InkWizardStepId[];
}): EnvMaterializeKit_InkWizardStepId | null;
/** Resolves the next non-terminal wizard step from the configured order. */
export declare function EnvMaterializeKit_resolveNextInkWizardStep(options: {
    readonly currentStep: EnvMaterializeKit_InkWizardStepId;
    readonly order?: readonly EnvMaterializeKit_InkWizardStepId[];
}): EnvMaterializeKit_InkWizardStepId | null;
