/**
 * @fileoverview Reusable OpenTUI renderer for config-driven env materialization wizards.
 *
 * Flow: injected config adapters + current form model -> route transitions -> exact command preview
 * -> spawned materializer subprocess -> parsed result summary. Root scripts bind project-specific
 * logical-environment ids, field labels, CLI option builders, and repo-relative command paths.
 *
 * @testing Root smoke: `npm run env:workspace:cli:opentui -- --help`; package type-check.
 * @see packages/env-materialize-kit/src/opentui-wizard-model.ts - Shared route/option helpers.
 * @documentation reviewed=2026-05-21 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Mutable form shape required by the reusable OpenTUI env materialization renderer. */
export type EnvMaterializeKit_OpenTuiFormModel = {
    canonicalRootWorkspacePath: string;
    logicalEnvironmentId: string;
    machineProfile: string;
    mode: string;
    privateNotesWorkspacePath: string;
    targetsChoice: string;
    workspacePath: string;
};
/** Text-input field injected by the project adapter for workspace or advanced routes. */
export type EnvMaterializeKit_OpenTuiTextFieldConfig<FormModel extends EnvMaterializeKit_OpenTuiFormModel> = {
    id: string;
    label: string;
    placeholder?: string;
    readValue: (model: FormModel) => string;
    writeValue: (model: FormModel, value: string) => FormModel;
};
/** Function bundle supplied by the project adapter for config-specific behavior. */
export type EnvMaterializeKit_OpenTuiAppBehavior<FormModel extends EnvMaterializeKit_OpenTuiFormModel, CliOptions> = {
    buildCliOptions: (model: FormModel) => CliOptions;
    defaultFormModel: (cwd: string) => FormModel;
    formatNpmRunCommand: (argv: readonly string[]) => string;
    formatTsxCommand: (argv: readonly string[]) => string;
    isLogicalEnvironmentId: (value: string) => boolean;
    isMode: (value: string) => boolean;
    isTarget: (value: string) => boolean;
    listMachineProfiles: (rootPath: string) => readonly string[];
    serializeCliOptionsToArgv: (options: CliOptions) => string[];
};
/** Props for the reusable env-materialize OpenTUI renderer. */
export type EnvMaterializeKit_OpenTuiAppProps<FormModel extends EnvMaterializeKit_OpenTuiFormModel, CliOptions> = {
    advancedFields: readonly EnvMaterializeKit_OpenTuiTextFieldConfig<FormModel>[];
    behavior: EnvMaterializeKit_OpenTuiAppBehavior<FormModel, CliOptions>;
    cliScriptRelativePath: string;
    cwd: string;
    logicalEnvironmentIds: readonly string[];
    modes: readonly string[];
    repoRoot: string;
    workspaceFields: readonly EnvMaterializeKit_OpenTuiTextFieldConfig<FormModel>[];
};
/** OpenTUI application root for a config-driven env-materialize workflow. */
export declare function EnvMaterializeKitOpenTuiApp<FormModel extends EnvMaterializeKit_OpenTuiFormModel, CliOptions>({ advancedFields, behavior, cliScriptRelativePath, cwd, logicalEnvironmentIds, modes, repoRoot, workspaceFields, }: EnvMaterializeKit_OpenTuiAppProps<FormModel, CliOptions>): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=opentui-app.d.ts.map