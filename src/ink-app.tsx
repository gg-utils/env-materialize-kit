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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, type Key } from "ink";
import {
  EnvMaterializeKit_findMachineProfileLabelIndex,
  EnvMaterializeKit_findSelectedValueIndex,
  EnvMaterializeKit_getInkSessionDoneStatusLabel,
  EnvMaterializeKit_getInkWizardLegendLines,
  EnvMaterializeKit_InkTargetChoiceLabels,
  EnvMaterializeKit_resolveInkProfileDiscoveryRoot,
  EnvMaterializeKit_resolveNextInkWizardStep,
  EnvMaterializeKit_resolvePreviousInkWizardStep,
  EnvMaterializeKit_targetChoiceSelectedIndex,
  type EnvMaterializeKit_InkSessionDoneStatus,
  type EnvMaterializeKit_InkWizardStepId,
} from "./ink-wizard-model.js";
import {
  EnvMaterializeKit_startInkCliTaskProcess,
  type EnvMaterializeKit_InkCliSessionLine,
} from "./ui-launcher.js";

/** Target chooser values used by the env-materialize UI family. */
export type EnvMaterializeKit_InkTargetsChoice =
  | "all"
  | "local-edge"
  | "packages";

/** Text field injected by a project adapter for path or advanced-editing steps. */
export type EnvMaterializeKit_InkTextFieldConfig<FormModel> = {
  readonly description?: string;
  readonly id: string;
  readonly label: string;
  readonly readValue: (model: FormModel) => string;
  readonly step?: Extract<
    EnvMaterializeKit_InkWizardStepId,
    "canonicalRoot" | "privateNotes" | "workspace"
  >;
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
  readonly readTargetsChoice: (
    model: FormModel,
  ) => EnvMaterializeKit_InkTargetsChoice;
  readonly readWorkspacePath: (model: FormModel) => string;
  readonly runPreflightSummaryLines: (options: CliOptions) => readonly string[];
  readonly serializeCliOptionsToArgv: (options: CliOptions) => string[];
  readonly writeLogicalEnvironmentId: (
    model: FormModel,
    value: string,
  ) => FormModel;
  readonly writeMachineProfile: (model: FormModel, value: string) => FormModel;
  readonly writeMode: (model: FormModel, value: string) => FormModel;
  readonly writeTargetsChoice: (
    model: FormModel,
    value: EnvMaterializeKit_InkTargetsChoice,
  ) => FormModel;
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

/** Wizard step identifier used for navigation order and keyboard routing in this Ink app. */
type EnvInkStepId = EnvMaterializeKit_InkWizardStepId;

/** Terminal status captured after the spawned env-materialize command exits or is cancelled. */
type EnvMaterializeKit_InkSessionDone = {
  readonly exitCode: number | null;
  readonly status: EnvMaterializeKit_InkSessionDoneStatus;
};

/** Mutable wizard surface passed into keyboard routing helpers. */
type EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions> = {
  readonly advancedFieldIndex: number;
  readonly behavior: EnvMaterializeKit_InkAppBehavior<FormModel, CliOptions>;
  readonly buildError: string | null;
  readonly cliOptions: CliOptions | null;
  readonly exit: () => void;
  readonly goBack: () => void;
  readonly goNext: () => void;
  readonly input: string;
  readonly key: Key;
  readonly logicalEnvironmentIds: readonly string[];
  readonly modes: readonly string[];
  readonly pathFields: readonly EnvMaterializeKit_InkTextFieldConfig<FormModel>[];
  readonly projectRoot: string;
  readonly runCancel: (() => void) | null;
  readonly setAdvancedFieldIndex: React.Dispatch<React.SetStateAction<number>>;
  readonly setBuildError: React.Dispatch<React.SetStateAction<string | null>>;
  readonly setModel: React.Dispatch<React.SetStateAction<FormModel>>;
  readonly setPreflightError: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  readonly setPreflightLines: React.Dispatch<
    React.SetStateAction<string[] | null>
  >;
  readonly setSessionDone: React.Dispatch<
    React.SetStateAction<EnvMaterializeKit_InkSessionDone | null>
  >;
  readonly setSessionNonce: React.Dispatch<React.SetStateAction<number>>;
  readonly setStep: React.Dispatch<React.SetStateAction<EnvInkStepId>>;
  readonly step: EnvInkStepId;
};

/** Returns the configured path field for a wizard step. */
function findPathField<FormModel>(options: {
  readonly fields: readonly EnvMaterializeKit_InkTextFieldConfig<FormModel>[];
  readonly step: EnvInkStepId;
}): EnvMaterializeKit_InkTextFieldConfig<FormModel> | null {
  return options.fields.find((field) => field.step === options.step) ?? null;
}

/** Joins a command name and args array into a single space-separated command line string. */
function formatInkCliCommandLine(
  command: string,
  args: readonly string[],
): string {
  return [command, ...args].join(" ");
}

/** Returns the last `count` items from `lines`, or all items if shorter. */
function sliceRecentLines<T>(lines: readonly T[], count: number): T[] {
  if (lines.length <= count) {
    return [...lines];
  }
  return lines.slice(lines.length - count);
}

/** Renders captured stdout/stderr lines with source-aware coloring. */
function InkCapturedOutputBlock({
  bracketSource = false,
  lines,
  maxLines,
  title,
}: {
  readonly bracketSource?: boolean;
  readonly lines: readonly EnvMaterializeKit_InkCliSessionLine[];
  readonly maxLines: number;
  readonly title: string;
}): React.ReactNode {
  const recent = sliceRecentLines(lines, maxLines);

  return (
    <Box flexDirection="column" marginTop={title ? 1 : 0}>
      {title ? <Text bold>{title}</Text> : null}
      {recent.map((line, index) => (
        <Text
          key={`${line.source}:${String(index)}`}
          color={line.source === "stderr" ? "red" : "white"}
        >
          {bracketSource ? `[${line.source}] ${line.text}` : line.text}
        </Text>
      ))}
    </Box>
  );
}

/** Renders a titled command line block using Ink `Box` and `Text` with word-wrap support. */
function InkCommandPreview({
  commandLine,
  title = "Command",
}: {
  readonly commandLine: string;
  readonly title?: string;
}): React.ReactNode {
  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Text wrap="wrap">{commandLine}</Text>
    </Box>
  );
}

/** Top-of-screen header with app name, description, and current step summary. */
function InkScreenHeader({
  appName,
  description,
  summary,
}: {
  readonly appName: string;
  readonly description: string;
  readonly summary: React.ReactNode;
}): React.ReactNode {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="green">
        {appName}
      </Text>
      <Text color="gray">{description}</Text>
      <Box>{summary}</Box>
    </Box>
  );
}

/** Renders keyboard shortcut hints for the current wizard step. */
function InkLegend({
  lines,
}: {
  readonly lines: readonly string[];
}): React.ReactNode {
  return (
    <Box marginTop={1} flexDirection="column" gap={0}>
      <Box marginBottom={1}>
        <Text bold>Keys</Text>
      </Box>
      {lines.map((line, lineIndex) => (
        <Text key={String(lineIndex)} color="gray">
          {line}
        </Text>
      ))}
    </Box>
  );
}

/** Handles `q` cancellation while the workspace command is running in the `session` step. */
function handleWizardSessionKeyboard<FormModel, CliOptions>(
  ctx: EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions>,
): void {
  if (ctx.input === "q" && ctx.runCancel) {
    ctx.runCancel();
  }
}

/** Handles quit keys and `r` restart after the spawned session finishes in the `result` step. */
function handleWizardResultKeyboard<FormModel, CliOptions>(
  ctx: EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions>,
): void {
  if (ctx.key.escape || ctx.input === "q") {
    ctx.exit();
  }
  if (ctx.input === "r") {
    ctx.setStep("mode");
    ctx.setModel(ctx.behavior.defaultFormModel(ctx.projectRoot));
    ctx.setAdvancedFieldIndex(0);
    ctx.setPreflightLines(null);
    ctx.setPreflightError(null);
    ctx.setBuildError(null);
    ctx.setSessionDone(null);
  }
}

/** Starts the live session from `review` when Enter is pressed and options validate. */
function handleWizardReviewKeyboard<FormModel, CliOptions>(
  ctx: EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions>,
): void {
  if (!ctx.key.return) {
    return;
  }
  if (!ctx.cliOptions || ctx.buildError) {
    return;
  }
  ctx.setSessionNonce((value) => value + 1);
  ctx.setStep("session");
}

/** Adjusts the materialize mode list selection with Up/Down arrows in the `mode` step. */
function handleWizardModeKeyboard<FormModel, CliOptions>(
  ctx: EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions>,
): void {
  if (ctx.key.upArrow) {
    ctx.setModel((model) => {
      const selected = ctx.behavior.readMode(model);
      const idx = Math.max(0, ctx.modes.indexOf(selected) - 1);
      return ctx.behavior.writeMode(model, ctx.modes[idx] ?? selected);
    });
  }
  if (ctx.key.downArrow) {
    ctx.setModel((model) => {
      const selected = ctx.behavior.readMode(model);
      const idx = Math.min(
        ctx.modes.length - 1,
        ctx.modes.indexOf(selected) + 1,
      );
      return ctx.behavior.writeMode(model, ctx.modes[idx] ?? selected);
    });
  }
}

/** Adjusts the logical environment list selection with Up/Down arrows. */
function handleWizardLogicalEnvKeyboard<FormModel, CliOptions>(
  ctx: EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions>,
): void {
  if (ctx.key.upArrow) {
    ctx.setModel((model) => {
      const selected = ctx.behavior.readLogicalEnvironmentId(model);
      const idx = Math.max(0, ctx.logicalEnvironmentIds.indexOf(selected) - 1);
      return ctx.behavior.writeLogicalEnvironmentId(
        model,
        ctx.logicalEnvironmentIds[idx] ?? selected,
      );
    });
  }
  if (ctx.key.downArrow) {
    ctx.setModel((model) => {
      const selected = ctx.behavior.readLogicalEnvironmentId(model);
      const idx = Math.min(
        ctx.logicalEnvironmentIds.length - 1,
        ctx.logicalEnvironmentIds.indexOf(selected) + 1,
      );
      return ctx.behavior.writeLogicalEnvironmentId(
        model,
        ctx.logicalEnvironmentIds[idx] ?? selected,
      );
    });
  }
}

/** Adjusts the targets choice cycle with Up/Down arrows in the `targets` step. */
function handleWizardTargetsKeyboard<FormModel, CliOptions>(
  ctx: EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions>,
): void {
  if (ctx.key.upArrow) {
    ctx.setModel((model) => {
      const choice = ctx.behavior.readTargetsChoice(model);
      if (choice === "packages") {
        return ctx.behavior.writeTargetsChoice(model, "local-edge");
      }
      if (choice === "local-edge") {
        return ctx.behavior.writeTargetsChoice(model, "all");
      }
      return model;
    });
  }
  if (ctx.key.downArrow) {
    ctx.setModel((model) => {
      const choice = ctx.behavior.readTargetsChoice(model);
      if (choice === "all") {
        return ctx.behavior.writeTargetsChoice(model, "local-edge");
      }
      if (choice === "local-edge") {
        return ctx.behavior.writeTargetsChoice(model, "packages");
      }
      return model;
    });
  }
}

/** Adjusts the machine profile list selection with Up/Down arrows. */
function handleWizardMachineProfileKeyboard<FormModel, CliOptions>(
  ctx: EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions>,
): void {
  const selectProfile = (model: FormModel, delta: number): FormModel => {
    const resolved = EnvMaterializeKit_resolveInkProfileDiscoveryRoot({
      fallbackRoot: ctx.projectRoot,
      privateNotesWorkspacePath:
        ctx.behavior.readPrivateNotesWorkspacePath(model),
      workspacePath: ctx.behavior.readWorkspacePath(model),
    });
    const labels = ["(none)", ...ctx.behavior.listMachineProfiles(resolved)];
    const currentProfile = ctx.behavior.readMachineProfile(model);
    const currentIndex = Math.max(
      0,
      labels.findIndex((label) =>
        label === "(none)"
          ? currentProfile.trim().length === 0
          : label === currentProfile,
      ),
    );
    const nextIndex = Math.min(
      labels.length - 1,
      Math.max(0, currentIndex + delta),
    );
    const label = labels[nextIndex] ?? "(none)";
    return ctx.behavior.writeMachineProfile(
      model,
      label === "(none)" ? "" : label,
    );
  };

  if (ctx.key.upArrow) {
    ctx.setModel((model) => selectProfile(model, -1));
  }
  if (ctx.key.downArrow) {
    ctx.setModel((model) => selectProfile(model, 1));
  }
}

/** Edits the focused advanced override field with arrows, delete, and printable keys. */
function handleWizardAdvancedKeyboard<FormModel, CliOptions>(
  ctx: EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions>,
  advancedFields: readonly EnvMaterializeKit_InkTextFieldConfig<FormModel>[],
): void {
  if (ctx.key.upArrow) {
    ctx.setAdvancedFieldIndex((i) => Math.max(0, i - 1));
  }
  if (ctx.key.downArrow) {
    ctx.setAdvancedFieldIndex((i) =>
      Math.min(advancedFields.length - 1, i + 1),
    );
  }
  const field = advancedFields[ctx.advancedFieldIndex];
  if (!field) {
    return;
  }
  if (ctx.key.backspace || ctx.key.delete) {
    ctx.setModel((model) =>
      field.writeValue(
        model,
        field
          .readValue(model)
          .slice(0, Math.max(0, field.readValue(model).length - 1)),
      ),
    );
    return;
  }
  if (ctx.input && !ctx.key.return && !ctx.key.tab && !ctx.key.escape) {
    ctx.setModel((model) =>
      field.writeValue(model, field.readValue(model) + ctx.input),
    );
  }
}

/** Applies backspace/delete and printable keys to configured path text steps. */
function handleWizardPathTextKeyboard<FormModel, CliOptions>(
  ctx: EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions>,
): void {
  const field = findPathField({ fields: ctx.pathFields, step: ctx.step });
  if (!field) {
    return;
  }
  if (ctx.key.backspace || ctx.key.delete) {
    ctx.setModel((model) =>
      field.writeValue(
        model,
        field
          .readValue(model)
          .slice(0, Math.max(0, field.readValue(model).length - 1)),
      ),
    );
    return;
  }
  if (ctx.input && !ctx.key.return && !ctx.key.tab && !ctx.key.escape) {
    ctx.setModel((model) =>
      field.writeValue(model, field.readValue(model) + ctx.input),
    );
  }
}

/** Routes Ink stdin keys through the wizard steps. */
function routeWizardKeyboard<FormModel, CliOptions>(
  ctx: EnvMaterializeKit_InkWizardInputContext<FormModel, CliOptions>,
  advancedFields: readonly EnvMaterializeKit_InkTextFieldConfig<FormModel>[],
): void {
  if (ctx.key.ctrl && ctx.input === "c") {
    ctx.exit();
    return;
  }
  if (ctx.step === "session") {
    handleWizardSessionKeyboard(ctx);
    return;
  }
  if (ctx.step === "result") {
    handleWizardResultKeyboard(ctx);
    return;
  }
  if (ctx.key.escape) {
    ctx.goBack();
    return;
  }
  if (ctx.step === "review") {
    handleWizardReviewKeyboard(ctx);
    return;
  }
  if (ctx.key.return) {
    ctx.goNext();
    return;
  }
  if (ctx.step === "mode") {
    handleWizardModeKeyboard(ctx);
    return;
  }
  if (ctx.step === "logicalEnv") {
    handleWizardLogicalEnvKeyboard(ctx);
    return;
  }
  if (ctx.step === "targets") {
    handleWizardTargetsKeyboard(ctx);
    return;
  }
  if (ctx.step === "machineProfile") {
    handleWizardMachineProfileKeyboard(ctx);
    return;
  }
  if (ctx.step === "advanced") {
    handleWizardAdvancedKeyboard(ctx, advancedFields);
    return;
  }
  handleWizardPathTextKeyboard(ctx);
}

/** Renders the materialize mode list with the current selection highlighted. */
function StepMode({
  modeIndex,
  modes,
}: {
  readonly modeIndex: number;
  readonly modes: readonly string[];
}): React.ReactNode {
  return (
    <Box flexDirection="column">
      <Text bold>Mode</Text>
      {modes.map((mode, index) => (
        <Text key={mode} color={index === modeIndex ? "cyan" : undefined}>
          {index === modeIndex ? "> " : "  "}
          {mode}
        </Text>
      ))}
    </Box>
  );
}

/** Renders a titled vertical list selector with the active row highlighted. */
function StepSelect({
  labels,
  selectedIndex,
  title,
}: {
  readonly labels: readonly string[];
  readonly selectedIndex: number;
  readonly title: string;
}): React.ReactNode {
  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      {labels.map((label, index) => (
        <Text key={label} color={index === selectedIndex ? "cyan" : undefined}>
          {index === selectedIndex ? "> " : "  "}
          {label}
        </Text>
      ))}
    </Box>
  );
}

/** Renders a titled read-only text field preview with a short gray description line. */
function StepText({
  description,
  title,
  value,
}: {
  readonly description: string;
  readonly title: string;
  readonly value: string;
}): React.ReactNode {
  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Text color="gray">{description}</Text>
      <Text>{value.length > 0 ? value : "(empty)"}</Text>
    </Box>
  );
}

/** Renders the review-step preflight recap. */
function renderPreflightReviewSection<CliOptions>(options: {
  readonly cliOptions: CliOptions | null;
  readonly isCheckMode: boolean;
  readonly preflightError: string | null;
  readonly preflightLines: string[] | null;
}): React.ReactNode {
  if (!options.isCheckMode && options.cliOptions) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Preflight check (mode=check, same paths)</Text>
        {options.preflightError ? (
          <Text color="red">{options.preflightError}</Text>
        ) : options.preflightLines ? (
          options.preflightLines.map((line) => <Text key={line}>{line}</Text>)
        ) : (
          <Text color="gray">Running preflight…</Text>
        )}
      </Box>
    );
  }

  if (options.isCheckMode) {
    return (
      <Box marginTop={1}>
        <Text color="gray">
          Selected mode is check; preflight is the same as the final run.
        </Text>
      </Box>
    );
  }

  return null;
}

/** Open root for a config-driven env-materialize Ink workflow. */
export function EnvMaterializeKitInkApp<FormModel, CliOptions>({
  advancedFields,
  appName,
  behavior,
  description,
  logicalEnvironmentIds,
  modes,
  pathFields,
  projectRoot,
  runCommand,
}: EnvMaterializeKit_InkAppProps<FormModel, CliOptions>): React.ReactNode {
  const { exit } = useApp();
  const [step, setStep] = useState<EnvInkStepId>("mode");
  const [model, setModel] = useState<FormModel>(() =>
    behavior.defaultFormModel(projectRoot),
  );
  const [advancedFieldIndex, setAdvancedFieldIndex] = useState(0);
  const [preflightLines, setPreflightLines] = useState<string[] | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [sessionLines, setSessionLines] = useState<
    EnvMaterializeKit_InkCliSessionLine[]
  >([]);
  const [sessionDone, setSessionDone] =
    useState<EnvMaterializeKit_InkSessionDone | null>(null);
  const [runCancel, setRunCancel] = useState<null | (() => void)>(null);
  const [sessionNonce, setSessionNonce] = useState(0);

  const selectedMode = behavior.readMode(model);
  const selectedLogicalEnvironmentId = behavior.readLogicalEnvironmentId(model);
  const selectedTargetsChoice = behavior.readTargetsChoice(model);
  const selectedMachineProfile = behavior.readMachineProfile(model);
  const workspacePath = behavior.readWorkspacePath(model);
  const privateNotesWorkspacePath =
    behavior.readPrivateNotesWorkspacePath(model);

  const modeIndex = EnvMaterializeKit_findSelectedValueIndex({
    selectedValue: selectedMode,
    values: modes,
  });
  const logicalEnvIndex = EnvMaterializeKit_findSelectedValueIndex({
    selectedValue: selectedLogicalEnvironmentId,
    values: logicalEnvironmentIds,
  });
  const targetsIndex = EnvMaterializeKit_targetChoiceSelectedIndex({
    targetsChoice: selectedTargetsChoice,
  });

  const privateNotesResolved = EnvMaterializeKit_resolveInkProfileDiscoveryRoot(
    {
      fallbackRoot: projectRoot,
      privateNotesWorkspacePath,
      workspacePath,
    },
  );
  const machineProfileSlugs = useMemo(
    () => behavior.listMachineProfiles(privateNotesResolved),
    [behavior, privateNotesResolved],
  );
  const machineProfileLabels = useMemo(
    () => ["(none)", ...machineProfileSlugs],
    [machineProfileSlugs],
  );
  const machineProfileIndex = EnvMaterializeKit_findMachineProfileLabelIndex({
    emptyLabel: "(none)",
    labels: machineProfileLabels,
    machineProfile: selectedMachineProfile,
  });

  type BuildResult =
    | { readonly ok: false; readonly message: string }
    | { readonly ok: true; readonly options: CliOptions };

  const buildResult: BuildResult = useMemo(() => {
    try {
      return {
        ok: true,
        options: behavior.buildCliOptions(model),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message };
    }
  }, [behavior, model]);

  const cliOptions: CliOptions | null = buildResult.ok
    ? buildResult.options
    : null;

  const serializedArgv = useMemo(
    () => (cliOptions ? behavior.serializeCliOptionsToArgv(cliOptions) : []),
    [behavior, cliOptions],
  );

  const fullRunArgs = useMemo(
    () => [...runCommand.argsBeforeSerializedArgv, ...serializedArgv],
    [runCommand.argsBeforeSerializedArgv, serializedArgv],
  );

  const commandLine = useMemo(
    () => formatInkCliCommandLine(runCommand.command, fullRunArgs),
    [fullRunArgs, runCommand.command],
  );

  useEffect(() => {
    if (step !== "review" || selectedMode === "check" || !cliOptions) {
      return;
    }

    let cancelled = false;
    setPreflightLines(null);
    setPreflightError(null);

    try {
      const lines = behavior.runPreflightSummaryLines(cliOptions);
      if (!cancelled) {
        setPreflightLines([...lines]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!cancelled) {
        setPreflightError(message);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [behavior, step, selectedMode, cliOptions]);

  useEffect(() => {
    if (step === "review") {
      setBuildError(buildResult.ok ? null : buildResult.message);
    }
  }, [step, buildResult]);

  useEffect(() => {
    if (step !== "session" || !cliOptions) {
      return;
    }

    setSessionLines([]);
    setSessionDone(null);

    const argsSnapshot = [
      ...runCommand.argsBeforeSerializedArgv,
      ...behavior.serializeCliOptionsToArgv(cliOptions),
    ];
    const task = EnvMaterializeKit_startInkCliTaskProcess({
      args: argsSnapshot,
      callbacks: {
        onLine: (line) => {
          setSessionLines((previous) => [...previous, line]);
        },
        onStarted: () => {},
      },
      command: runCommand.command,
      projectRoot,
    });

    setRunCancel(() => task.cancel);

    task.promise.then((result) => {
      setSessionDone({
        status: result.status,
        exitCode: result.exitCode,
      });
      setRunCancel(null);
      setStep("result");
    });

    return () => {
      task.cancel();
    };
  }, [behavior, cliOptions, projectRoot, runCommand, sessionNonce, step]);

  const goBack = useCallback(() => {
    if (step === "session") {
      return;
    }
    if (step === "result") {
      setStep("review");
      setSessionDone(null);
      return;
    }
    const previousStep = EnvMaterializeKit_resolvePreviousInkWizardStep({
      currentStep: step,
    });
    if (!previousStep) {
      exit();
      return;
    }
    setStep(previousStep);
  }, [step, exit]);

  const goNext = useCallback(() => {
    const nextStep = EnvMaterializeKit_resolveNextInkWizardStep({
      currentStep: step,
    });
    if (!nextStep) {
      return;
    }
    setStep(nextStep);
  }, [step]);

  useInput((input, key) => {
    routeWizardKeyboard(
      {
        advancedFieldIndex,
        behavior,
        buildError,
        cliOptions,
        exit,
        goBack,
        goNext,
        input,
        key,
        logicalEnvironmentIds,
        modes,
        pathFields,
        projectRoot,
        runCancel,
        setAdvancedFieldIndex,
        setBuildError,
        setModel,
        setPreflightError,
        setPreflightLines,
        setSessionDone,
        setSessionNonce,
        setStep,
        step,
      },
      advancedFields,
    );
  });

  const advancedField = advancedFields[advancedFieldIndex];
  const activePathField = findPathField({ fields: pathFields, step });

  return (
    <Box flexDirection="column">
      <InkScreenHeader
        appName={appName}
        description={description}
        summary={<Text>Step: {step}</Text>}
      />

      {step === "mode" ? (
        <StepMode modeIndex={modeIndex} modes={modes} />
      ) : null}
      {activePathField ? (
        <StepText
          title={activePathField.label}
          description={activePathField.description ?? "Edit this value."}
          value={activePathField.readValue(model)}
        />
      ) : null}
      {step === "logicalEnv" ? (
        <StepSelect
          title="Logical environment"
          labels={logicalEnvironmentIds}
          selectedIndex={logicalEnvIndex}
        />
      ) : null}
      {step === "targets" ? (
        <StepSelect
          title="Targets"
          labels={EnvMaterializeKit_InkTargetChoiceLabels}
          selectedIndex={targetsIndex}
        />
      ) : null}
      {step === "machineProfile" ? (
        <StepSelect
          title={`Machine profile (under ${privateNotesResolved})`}
          labels={machineProfileLabels}
          selectedIndex={machineProfileIndex}
        />
      ) : null}
      {step === "advanced" && advancedField ? (
        <Box flexDirection="column">
          <Text bold>Optional overrides (Up/Down field, type to edit)</Text>
          {advancedFields.map((field, index) => (
            <Text
              key={field.id}
              color={index === advancedFieldIndex ? "cyan" : undefined}
            >
              {index === advancedFieldIndex ? "> " : "  "}
              {field.label}:{" "}
              {field.readValue(model).length > 0
                ? field.readValue(model)
                : "(empty)"}
            </Text>
          ))}
        </Box>
      ) : null}

      {step === "review" ? (
        <Box flexDirection="column">
          {buildError ? (
            <Text color="red">Fix options: {buildError}</Text>
          ) : (
            <InkCommandPreview commandLine={commandLine} />
          )}
          {renderPreflightReviewSection({
            cliOptions,
            isCheckMode: selectedMode === "check",
            preflightError,
            preflightLines,
          })}
        </Box>
      ) : null}

      {step === "session" ? (
        <Box flexDirection="column">
          <Text bold>Running</Text>
          <InkCommandPreview commandLine={commandLine} />
          <InkCapturedOutputBlock
            title="Output"
            lines={sessionLines}
            maxLines={20}
            bracketSource
          />
        </Box>
      ) : null}

      {step === "result" && sessionDone ? (
        <Box flexDirection="column">
          <Text
            bold
            color={sessionDone.status === "succeeded" ? "green" : "red"}
          >
            {EnvMaterializeKit_getInkSessionDoneStatusLabel(sessionDone.status)}
            {sessionDone.exitCode === null
              ? ""
              : ` (exit ${String(sessionDone.exitCode)})`}
          </Text>
          <InkCapturedOutputBlock
            title="Captured output"
            lines={sessionLines}
            maxLines={24}
            bracketSource
          />
        </Box>
      ) : null}

      <InkLegend
        lines={EnvMaterializeKit_getInkWizardLegendLines({ buildError, step })}
      />
    </Box>
  );
}
