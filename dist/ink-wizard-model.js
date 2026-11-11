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
import path from "node:path";
/** Stable pre-session wizard order. Terminal `session` and `result` are intentionally excluded. */
export const EnvMaterializeKit_InkWizardStepOrder = [
    "mode",
    "workspace",
    "logicalEnv",
    "targets",
    "privateNotes",
    "machineProfile",
    "canonicalRoot",
    "advanced",
    "review",
];
/** Display labels for target choice selector rows. */
export const EnvMaterializeKit_InkTargetChoiceLabels = [
    "all (local-edge + packages)",
    "local-edge only",
    "packages only",
];
/** Resolves the filesystem root used for machine-profile discovery. */
export function EnvMaterializeKit_resolveInkProfileDiscoveryRoot(options) {
    const privateNotesRoot = options.privateNotesWorkspacePath.trim();
    if (privateNotesRoot.length > 0) {
        return path.resolve(privateNotesRoot);
    }
    const workspaceRoot = options.workspacePath.trim();
    if (workspaceRoot.length > 0) {
        return path.resolve(workspaceRoot);
    }
    return options.fallbackRoot;
}
/** Returns the selected value index in a list, defaulting to zero for missing values. */
export function EnvMaterializeKit_findSelectedValueIndex(options) {
    return Math.max(0, options.values.indexOf(options.selectedValue));
}
/** Returns the selected machine-profile label index, treating the configured empty label as blank. */
export function EnvMaterializeKit_findMachineProfileLabelIndex(options) {
    return Math.max(0, options.labels.findIndex((label) => EnvMaterializeKit_isMachineProfileLabelMatch({
        emptyLabel: options.emptyLabel,
        label,
        machineProfile: options.machineProfile,
    })));
}
/** Returns whether a machine-profile label matches the current model value. */
export function EnvMaterializeKit_isMachineProfileLabelMatch(options) {
    if (options.label === options.emptyLabel) {
        return options.machineProfile.trim().length === 0;
    }
    return options.label === options.machineProfile;
}
/** Maps the wizard target choice to the display row index. */
export function EnvMaterializeKit_targetChoiceSelectedIndex(options) {
    if (options.targetsChoice === "all") {
        return 0;
    }
    if (options.targetsChoice === "local-edge") {
        return 1;
    }
    return 2;
}
/** Formats one-line mutation summaries for preflight output. */
export function EnvMaterializeKit_formatInkMutationRunSummaryLines(results) {
    return results.map((result) => `[env-materialize] ${result.status} ${result.filePath}`);
}
/** Formats the result step status label. */
export function EnvMaterializeKit_getInkSessionDoneStatusLabel(status) {
    if (status === "succeeded") {
        return "Completed";
    }
    if (status === "cancelled") {
        return "Cancelled";
    }
    return "Failed";
}
/** Returns the contextual keyboard legend for an env-materialize Ink wizard step. */
export function EnvMaterializeKit_getInkWizardLegendLines(options) {
    if (options.step === "review") {
        return [
            options.buildError
                ? "Fix invalid fields (e.g. ports) before running."
                : "Enter run | Esc back | Ctrl+C quit",
            "Preflight uses EnvMaterialize_run in check mode before the mutating npm run.",
        ];
    }
    if (options.step === "session") {
        return [
            "Live run in progress. Press q to cancel.",
            "Escape is disabled until the process finishes.",
        ];
    }
    if (options.step === "result") {
        return ["Esc or q quit | r restart wizard from mode"];
    }
    if (options.step === "advanced") {
        return [
            "Enter next | Esc back | Up/Down switch field | Type to edit active field",
            "Ctrl+C quit",
        ];
    }
    return [
        "Enter next | Esc back | Up/Down adjust lists | Type text on path steps",
        "Ctrl+C quit",
    ];
}
/** Resolves the previous non-terminal wizard step from the configured order. */
export function EnvMaterializeKit_resolvePreviousInkWizardStep(options) {
    const order = options.order ?? EnvMaterializeKit_InkWizardStepOrder;
    const index = order.indexOf(options.currentStep);
    if (index <= 0) {
        return null;
    }
    return order[index - 1] ?? null;
}
/** Resolves the next non-terminal wizard step from the configured order. */
export function EnvMaterializeKit_resolveNextInkWizardStep(options) {
    const order = options.order ?? EnvMaterializeKit_InkWizardStepOrder;
    const index = order.indexOf(options.currentStep);
    if (index < 0 || index >= order.length - 1) {
        return null;
    }
    return order[index + 1] ?? null;
}
