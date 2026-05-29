/**
 * @fileoverview Reusable Ink renderer for config-driven env materialization wizards.
 *
 * Flow: injected form adapters + current wizard state -> command preview -> optional check-mode
 * preflight -> spawned workspace command -> captured result output. Root scripts bind project-specific
 * logical-environment ids, field labels, CLI option builders, and command names.
 *
 * @testing Root smoke: `npm run env:workspace:cli:ink -- --help`; package type-check.
 * @see packages/env-materialize-kit/src/ink-wizard-model.ts - Shared wizard step helpers.
 * @documentation reviewed=2026-05-21 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
import React from "react";
import { type EnvMaterializeKit_InkWizardStepId } from "./ink-wizard-model.js";
/** Target chooser values used by the env-materialize UI family. */
export type EnvMaterializeKit_InkTargetsChoice = "all" | "local-edge" | "packages";
/** Text field injected by a project adapter for path or advanced-editing steps. */
export type EnvMaterializeKit_InkTextFieldConfig<FormModel> = {
    readonly description?: string;
    readonly id: string;
    readonly label: string;
    readonly readValue: (model: FormModel) => string;
    readonly step?: Extract<EnvMaterializeKit_InkWizardStepId, "canonicalRoot" | "privateNotes" | "workspace">;
    readonly writeValue: (model: FormModel, value: string) => FormModel;
};
/** Function bundle supplied by the project adapter for config-specific form behavior. */
export type EnvMaterializeKit_InkAppBehavior<FormModel, CliOptions> = {
    readonly buildCliOptions: (model: FormModel) => CliOptions;
    readonly defaultFormModel: (cwd: string) => FormModel;
    readonly listMachineProfiles: (rootPath: string) => readonly string[];
    readonly readLogicalEnvironmentId: (model: FormModel) => string;
    readonly readMachineProfile: (model: FormModel) => string;
    readonly readMode: (model: FormModel) => string;
    readonly readPrivateNotesWorkspacePath: (model: FormModel) => string;
    readonly readTargetsChoice: (model: FormModel) => EnvMaterializeKit_InkTargetsChoice;
    readonly readWorkspacePath: (model: FormModel) => string;
    readonly runPreflightSummaryLines: (options: CliOptions) => readonly string[];
    readonly serializeCliOptionsToArgv: (options: CliOptions) => string[];
    readonly writeLogicalEnvironmentId: (model: FormModel, value: string) => FormModel;
    readonly writeMachineProfile: (model: FormModel, value: string) => FormModel;
    readonly writeMode: (model: FormModel, value: string) => FormModel;
    readonly writeTargetsChoice: (model: FormModel, value: EnvMaterializeKit_InkTargetsChoice) => FormModel;
};
/** Command prefix used to preview and spawn the selected env-materialize run. */
export type EnvMaterializeKit_InkRunCommandConfig = {
    readonly argsBeforeSerializedArgv: readonly string[];
    readonly command: string;
};
/** Props for the reusable env-materialize Ink renderer. */
export type EnvMaterializeKit_InkAppProps<FormModel, CliOptions> = {
    readonly advancedFields: readonly EnvMaterializeKit_InkTextFieldConfig<FormModel>[];
    readonly appName: string;
    readonly behavior: EnvMaterializeKit_InkAppBehavior<FormModel, CliOptions>;
    readonly description: string;
    readonly logicalEnvironmentIds: readonly string[];
    readonly modes: readonly string[];
    readonly pathFields: readonly EnvMaterializeKit_InkTextFieldConfig<FormModel>[];
    readonly projectRoot: string;
    readonly runCommand: EnvMaterializeKit_InkRunCommandConfig;
};
/** Open root for a config-driven env-materialize Ink workflow. */
export declare function EnvMaterializeKitInkApp<FormModel, CliOptions>({ advancedFields, appName, behavior, description, logicalEnvironmentIds, modes, pathFields, projectRoot, runCommand, }: EnvMaterializeKit_InkAppProps<FormModel, CliOptions>): React.ReactNode;
//# sourceMappingURL=ink-app.d.ts.map