/** @jsxImportSource #opentui */
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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions,
  EnvMaterializeKit_buildOpenTuiLogicalEnvironmentOptions,
  EnvMaterializeKit_buildOpenTuiMachineProfileOptions,
  EnvMaterializeKit_buildOpenTuiModeOptions,
  EnvMaterializeKit_buildOpenTuiResultOptions,
  EnvMaterializeKit_buildOpenTuiRunBackQuitOptions,
  EnvMaterializeKit_buildOpenTuiTargetsOptions,
  EnvMaterializeKit_findOpenTuiSelectedOptionIndex,
  EnvMaterializeKit_openTuiRouteIndex,
  EnvMaterializeKit_OpenTuiRoutesBeforePreview,
  EnvMaterializeKit_resolveOpenTuiProfileDiscoveryRoot,
  EnvMaterializeKit_summarizeOpenTuiMaterializerOutput,
  type EnvMaterializeKit_OpenTuiWizardRoute,
} from "./opentui-wizard-model.js";
import { EnvMaterializeKit_spawnNpxTsxOnce } from "./ui-launcher.js";

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
export type EnvMaterializeKit_OpenTuiTextFieldConfig<
  FormModel extends EnvMaterializeKit_OpenTuiFormModel,
> = {
  id: string;
  label: string;
  placeholder?: string;
  readValue: (model: FormModel) => string;
  writeValue: (model: FormModel, value: string) => FormModel;
};

/** Function bundle supplied by the project adapter for config-specific behavior. */
export type EnvMaterializeKit_OpenTuiAppBehavior<
  FormModel extends EnvMaterializeKit_OpenTuiFormModel,
  CliOptions,
> = {
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
export type EnvMaterializeKit_OpenTuiAppProps<
  FormModel extends EnvMaterializeKit_OpenTuiFormModel,
  CliOptions,
> = {
  advancedFields: readonly EnvMaterializeKit_OpenTuiTextFieldConfig<FormModel>[];
  behavior: EnvMaterializeKit_OpenTuiAppBehavior<FormModel, CliOptions>;
  cliScriptRelativePath: string;
  cwd: string;
  logicalEnvironmentIds: readonly string[];
  modes: readonly string[];
  repoRoot: string;
  workspaceFields: readonly EnvMaterializeKit_OpenTuiTextFieldConfig<FormModel>[];
};

/** Route key alias for the env-materialize OpenTUI route machine. */
type Route = EnvMaterializeKit_OpenTuiWizardRoute;

/** Renders a configured list of text-input fields against the current form model. */
function renderTextFields<
  FormModel extends EnvMaterializeKit_OpenTuiFormModel,
>(options: {
  readonly fields: readonly EnvMaterializeKit_OpenTuiTextFieldConfig<FormModel>[];
  readonly model: FormModel;
  readonly setModel: (updater: (current: FormModel) => FormModel) => void;
}) {
  return options.fields.map((field) => (
    <box key={field.id} style={{ flexDirection: "column", gap: 1 }}>
      <text>{field.label}</text>
      <input
        onChange={(value) => {
          options.setModel((current) => field.writeValue(current, value));
        }}
        {...(field.placeholder === undefined ? {} : { placeholder: field.placeholder })}
        value={field.readValue(options.model)}
      />
    </box>
  ));
}

/** OpenTUI application root for a config-driven env-materialize workflow. */
export function EnvMaterializeKitOpenTuiApp<
  FormModel extends EnvMaterializeKit_OpenTuiFormModel,
  CliOptions,
>({
  advancedFields,
  behavior,
  cliScriptRelativePath,
  cwd,
  logicalEnvironmentIds,
  modes,
  repoRoot,
  workspaceFields,
}: EnvMaterializeKit_OpenTuiAppProps<FormModel, CliOptions>) {
  const [route, setRoute] = useState<Route>("workspace");
  const [model, setModel] = useState<FormModel>(() =>
    behavior.defaultFormModel(cwd),
  );
  const [previewError, setPreviewError] = useState<string>("");
  const [previewLines, setPreviewLines] = useState<string>("");
  const [runArgv, setRunArgv] = useState<string[]>([]);
  const [runStdout, setRunStdout] = useState<string>("");
  const [runStderr, setRunStderr] = useState<string>("");
  const [runStatus, setRunStatus] = useState<number | null>(null);
  const [mutationSummary, setMutationSummary] = useState<string>("");
  const cancelRunRef = useRef<null | (() => void)>(null);

  const privateNotesForProfiles =
    model.privateNotesWorkspacePath.trim().length > 0
      ? model.privateNotesWorkspacePath.trim()
      : model.workspacePath.trim();

  const machineProfileRoot =
    EnvMaterializeKit_resolveOpenTuiProfileDiscoveryRoot({
      fallbackRoot: cwd,
      rawPath: privateNotesForProfiles,
    });

  const machineProfiles = useMemo(
    () => behavior.listMachineProfiles(machineProfileRoot),
    [behavior, machineProfileRoot],
  );

  const modeOptions = EnvMaterializeKit_buildOpenTuiModeOptions({ modes });

  const logicalEnvOptions =
    EnvMaterializeKit_buildOpenTuiLogicalEnvironmentOptions({
      logicalEnvironmentIds,
    });

  const targetsOptions = EnvMaterializeKit_buildOpenTuiTargetsOptions();

  const machineProfileOptions = useMemo(
    () =>
      EnvMaterializeKit_buildOpenTuiMachineProfileOptions({
        emptyDescription: "No machine profile",
        emptyName: "(none)",
        profiles: machineProfiles,
      }),
    [machineProfiles],
  );

  const modeIndex = EnvMaterializeKit_findOpenTuiSelectedOptionIndex({
    options: modeOptions,
    selectedValue: model.mode,
  });
  const logicalIndex = EnvMaterializeKit_findOpenTuiSelectedOptionIndex({
    options: logicalEnvOptions,
    selectedValue: model.logicalEnvironmentId,
  });
  const targetsIndex = EnvMaterializeKit_findOpenTuiSelectedOptionIndex({
    options: targetsOptions,
    selectedValue: model.targetsChoice,
  });
  const machineIndex = EnvMaterializeKit_findOpenTuiSelectedOptionIndex({
    options: machineProfileOptions,
    selectedValue: model.machineProfile,
  });

  useEffect(() => {
    return () => {
      cancelRunRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (route !== "running") {
      return;
    }

    setRunStdout("");
    setRunStderr("");
    setRunStatus(null);
    setMutationSummary("");

    const argvSnapshot = [...runArgv];
    const { promise, cancel } = EnvMaterializeKit_spawnNpxTsxOnce({
      argv: argvSnapshot,
      projectRoot: repoRoot,
      scriptRelativePath: cliScriptRelativePath,
      handlers: {
        onStderrChunk: (chunk) => {
          setRunStderr((previous) => previous + chunk);
        },
        onStdoutChunk: (chunk) => {
          setRunStdout((previous) => previous + chunk);
        },
      },
    });
    cancelRunRef.current = cancel;

    promise
      .then((result) => {
        cancelRunRef.current = null;
        setRunStatus(result.status);
        setMutationSummary(
          EnvMaterializeKit_summarizeOpenTuiMaterializerOutput({
            stderr: result.stderr,
            stdout: result.stdout,
          }),
        );
        setRoute("result");
      })
      .catch((error: unknown) => {
        cancelRunRef.current = null;
        const message = error instanceof Error ? error.message : String(error);
        setRunStderr(message);
        setRunStatus(1);
        setMutationSummary("");
        setRoute("result");
      });

    return () => {
      cancel();
      cancelRunRef.current = null;
    };
  }, [cliScriptRelativePath, repoRoot, route, runArgv]);

  /** Exits the OpenTUI process by delivering SIGINT to the current Node PID. */
  function quit(): void {
    process.kill(process.pid, "SIGINT");
  }

  /** Builds serialized argv from the form model and advances to the command preview route. */
  function goPreview(): void {
    setPreviewError("");
    try {
      const built = behavior.buildCliOptions(model);
      const argv = behavior.serializeCliOptionsToArgv(built);
      const npmLine = behavior.formatNpmRunCommand(argv);
      const tsxLine = behavior.formatTsxCommand(argv);
      setPreviewLines(`${npmLine}\n\n${tsxLine}`);
      setRunArgv(argv);
      setRoute("preview");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreviewError(message);
    }
  }

  /** Maps a route to its index within the linear pre-preview sequence, or the preview bucket. */
  function routeIndex(r: Route): number {
    return EnvMaterializeKit_openTuiRouteIndex({ route: r });
  }

  /** Handles “Back” from the current screen, including quitting from the first step. */
  function goBackFrom(current: Route): void {
    if (current === "workspace") {
      quit();
      return;
    }
    if (current === "preview") {
      setRoute("advanced");
      return;
    }
    if (current === "result") {
      setRoute("preview");
      return;
    }
    const idx = routeIndex(current);
    if (idx <= 0) {
      setRoute("workspace");
      return;
    }
    setRoute(
      EnvMaterializeKit_OpenTuiRoutesBeforePreview[idx - 1] ?? "workspace",
    );
  }

  /** Advances the linear wizard or jumps to preview when already at the last pre-preview step. */
  function goForwardFrom(current: Route): void {
    if (current === "advanced") {
      goPreview();
      return;
    }
    const idx = routeIndex(current);
    if (idx >= EnvMaterializeKit_OpenTuiRoutesBeforePreview.length - 1) {
      goPreview();
      return;
    }
    setRoute(
      EnvMaterializeKit_OpenTuiRoutesBeforePreview[idx + 1] ?? "advanced",
    );
  }

  /** Dispatches tab-select values to quit, linear navigation, preview run, or full restart. */
  function onNavSelect(current: Route, value: string | undefined): void {
    if (value === "quit") {
      quit();
      return;
    }
    if (value === "back") {
      goBackFrom(current);
      return;
    }
    if (value === "continue") {
      goForwardFrom(current);
      return;
    }
    if (value === "run" && current === "preview") {
      setRoute("running");
      return;
    }
    if (value === "restart") {
      setModel(behavior.defaultFormModel(cwd));
      setPreviewError("");
      setPreviewLines("");
      setRunArgv([]);
      setRunStdout("");
      setRunStderr("");
      setRunStatus(null);
      setMutationSummary("");
      setRoute("workspace");
    }
  }

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, gap: 1, padding: 1 }}>
      <text>env-materialize (OpenTUI) — route: {route}</text>

      {route === "workspace" ? (
        <>
          <text>Workspace paths</text>
          <scrollbox style={{ flexGrow: 1 }}>
            <box style={{ flexDirection: "column", gap: 1 }}>
              {renderTextFields({ fields: workspaceFields, model, setModel })}
            </box>
          </scrollbox>
          <tab-select
            onSelect={(_i, option) => onNavSelect("workspace", option?.value)}
            options={EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
              continueLabel: "Continue to mode",
            })}
            showDescription={true}
          />
        </>
      ) : null}

      {route === "mode" ? (
        <>
          <text>Mode</text>
          <select
            onChange={(_index, option) => {
              const value = option?.value;
              if (value !== undefined && behavior.isMode(value)) {
                setModel((m) => ({ ...m, mode: value }));
              }
            }}
            options={modeOptions}
            selectedIndex={modeIndex}
            showDescription={false}
          />
          <tab-select
            onSelect={(_i, option) => onNavSelect("mode", option?.value)}
            options={EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
              continueLabel: "Continue to logical environment",
            })}
            showDescription={true}
          />
        </>
      ) : null}

      {route === "logicalEnv" ? (
        <>
          <text>Logical environment</text>
          <select
            onChange={(_index, option) => {
              const value = option?.value;
              if (
                value !== undefined &&
                behavior.isLogicalEnvironmentId(value)
              ) {
                setModel((m) => ({ ...m, logicalEnvironmentId: value }));
              }
            }}
            options={logicalEnvOptions}
            selectedIndex={logicalIndex}
            showDescription={false}
          />
          <tab-select
            onSelect={(_i, option) => onNavSelect("logicalEnv", option?.value)}
            options={EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
              continueLabel: "Continue to targets",
            })}
            showDescription={true}
          />
        </>
      ) : null}

      {route === "targets" ? (
        <>
          <text>Targets</text>
          <select
            onChange={(_index, option) => {
              const value = option?.value;
              if (
                value !== undefined &&
                (value === "all" || behavior.isTarget(value))
              ) {
                setModel((m) => ({ ...m, targetsChoice: value }));
              }
            }}
            options={targetsOptions}
            selectedIndex={targetsIndex}
            showDescription={false}
          />
          <tab-select
            onSelect={(_i, option) => onNavSelect("targets", option?.value)}
            options={EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
              continueLabel: "Continue to machine profile",
            })}
            showDescription={true}
          />
        </>
      ) : null}

      {route === "machineProfile" ? (
        <>
          <text>Machine profile (from {machineProfileRoot})</text>
          <select
            onChange={(_index, option) => {
              const value = option?.value;
              setModel((m) => ({ ...m, machineProfile: value ?? "" }));
            }}
            options={machineProfileOptions}
            selectedIndex={machineIndex}
            showDescription={false}
          />
          <tab-select
            onSelect={(_i, option) =>
              onNavSelect("machineProfile", option?.value)
            }
            options={EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
              continueLabel: "Continue to advanced overrides",
            })}
            showDescription={true}
          />
        </>
      ) : null}

      {route === "advanced" ? (
        <>
          {previewError.length > 0 ? <text>{previewError}</text> : null}
          <text>Optional overrides</text>
          <scrollbox style={{ flexGrow: 1 }}>
            <box style={{ flexDirection: "column", gap: 1 }}>
              {renderTextFields({ fields: advancedFields, model, setModel })}
            </box>
          </scrollbox>
          <tab-select
            onSelect={(_i, option) => onNavSelect("advanced", option?.value)}
            options={EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
              continueLabel: "Continue to command preview",
            })}
            showDescription={true}
          />
        </>
      ) : null}

      {route === "preview" ? (
        <>
          <text>Command preview (exact)</text>
          <scrollbox style={{ flexGrow: 1 }}>
            <text>{previewLines}</text>
          </scrollbox>
          <tab-select
            onSelect={(_i, option) => onNavSelect("preview", option?.value)}
            options={EnvMaterializeKit_buildOpenTuiRunBackQuitOptions()}
            showDescription={true}
          />
        </>
      ) : null}

      {route === "running" ? (
        <>
          <text>Running materializer (streaming)</text>
          <scrollbox style={{ flexGrow: 1, maxHeight: 18 }}>
            <text>
              {runStdout.length > 0 ? runStdout : "(stdout empty so far)"}
            </text>
          </scrollbox>
          <text>stderr</text>
          <scrollbox style={{ maxHeight: 6 }}>
            <text>{runStderr.length > 0 ? runStderr : "(empty)"}</text>
          </scrollbox>
          <text>Closing when the process exits…</text>
        </>
      ) : null}

      {route === "result" ? (
        <>
          <text>
            Exit code: {runStatus === null ? "unknown" : String(runStatus)}
          </text>
          <text>Stdout</text>
          <scrollbox style={{ flexGrow: 1, maxHeight: 12 }}>
            <text>{runStdout.length > 0 ? runStdout : "(empty)"}</text>
          </scrollbox>
          <text>Engine lines (parsed)</text>
          <scrollbox style={{ maxHeight: 6 }}>
            <text>
              {mutationSummary.length > 0 ? mutationSummary : "(none)"}
            </text>
          </scrollbox>
          <text>Stderr</text>
          <scrollbox style={{ maxHeight: 5 }}>
            <text>{runStderr.length > 0 ? runStderr : "(empty)"}</text>
          </scrollbox>
          <tab-select
            onSelect={(_i, option) => onNavSelect("result", option?.value)}
            options={EnvMaterializeKit_buildOpenTuiResultOptions()}
            showDescription={true}
          />
        </>
      ) : null}
    </box>
  );
}
