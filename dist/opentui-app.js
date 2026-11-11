import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "#opentui/jsx-runtime";
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
import { EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions, EnvMaterializeKit_buildOpenTuiLogicalEnvironmentOptions, EnvMaterializeKit_buildOpenTuiMachineProfileOptions, EnvMaterializeKit_buildOpenTuiModeOptions, EnvMaterializeKit_buildOpenTuiResultOptions, EnvMaterializeKit_buildOpenTuiRunBackQuitOptions, EnvMaterializeKit_buildOpenTuiTargetsOptions, EnvMaterializeKit_findOpenTuiSelectedOptionIndex, EnvMaterializeKit_openTuiRouteIndex, EnvMaterializeKit_OpenTuiRoutesBeforePreview, EnvMaterializeKit_resolveOpenTuiProfileDiscoveryRoot, EnvMaterializeKit_summarizeOpenTuiMaterializerOutput, } from "./opentui-wizard-model.js";
import { EnvMaterializeKit_spawnNpxTsxOnce } from "./ui-launcher.js";
/** Renders a configured list of text-input fields against the current form model. */
function renderTextFields(options) {
    return options.fields.map((field) => (_jsxs("box", { style: { flexDirection: "column", gap: 1 }, children: [_jsx("text", { children: field.label }), _jsx("input", { onChange: (value) => {
                    options.setModel((current) => field.writeValue(current, value));
                }, ...(field.placeholder === undefined ? {} : { placeholder: field.placeholder }), value: field.readValue(options.model) })] }, field.id)));
}
/** OpenTUI application root for a config-driven env-materialize workflow. */
export function EnvMaterializeKitOpenTuiApp({ advancedFields, behavior, cliScriptRelativePath, cwd, logicalEnvironmentIds, modes, repoRoot, workspaceFields, }) {
    const [route, setRoute] = useState("workspace");
    const [model, setModel] = useState(() => behavior.defaultFormModel(cwd));
    const [previewError, setPreviewError] = useState("");
    const [previewLines, setPreviewLines] = useState("");
    const [runArgv, setRunArgv] = useState([]);
    const [runStdout, setRunStdout] = useState("");
    const [runStderr, setRunStderr] = useState("");
    const [runStatus, setRunStatus] = useState(null);
    const [mutationSummary, setMutationSummary] = useState("");
    const cancelRunRef = useRef(null);
    const privateNotesForProfiles = model.privateNotesWorkspacePath.trim().length > 0
        ? model.privateNotesWorkspacePath.trim()
        : model.workspacePath.trim();
    const machineProfileRoot = EnvMaterializeKit_resolveOpenTuiProfileDiscoveryRoot({
        fallbackRoot: cwd,
        rawPath: privateNotesForProfiles,
    });
    const machineProfiles = useMemo(() => behavior.listMachineProfiles(machineProfileRoot), [behavior, machineProfileRoot]);
    const modeOptions = EnvMaterializeKit_buildOpenTuiModeOptions({ modes });
    const logicalEnvOptions = EnvMaterializeKit_buildOpenTuiLogicalEnvironmentOptions({
        logicalEnvironmentIds,
    });
    const targetsOptions = EnvMaterializeKit_buildOpenTuiTargetsOptions();
    const machineProfileOptions = useMemo(() => EnvMaterializeKit_buildOpenTuiMachineProfileOptions({
        emptyDescription: "No machine profile",
        emptyName: "(none)",
        profiles: machineProfiles,
    }), [machineProfiles]);
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
            setMutationSummary(EnvMaterializeKit_summarizeOpenTuiMaterializerOutput({
                stderr: result.stderr,
                stdout: result.stdout,
            }));
            setRoute("result");
        })
            .catch((error) => {
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
    function quit() {
        process.kill(process.pid, "SIGINT");
    }
    /** Builds serialized argv from the form model and advances to the command preview route. */
    function goPreview() {
        setPreviewError("");
        try {
            const built = behavior.buildCliOptions(model);
            const argv = behavior.serializeCliOptionsToArgv(built);
            const npmLine = behavior.formatNpmRunCommand(argv);
            const tsxLine = behavior.formatTsxCommand(argv);
            setPreviewLines(`${npmLine}\n\n${tsxLine}`);
            setRunArgv(argv);
            setRoute("preview");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setPreviewError(message);
        }
    }
    /** Maps a route to its index within the linear pre-preview sequence, or the preview bucket. */
    function routeIndex(r) {
        return EnvMaterializeKit_openTuiRouteIndex({ route: r });
    }
    /** Handles “Back” from the current screen, including quitting from the first step. */
    function goBackFrom(current) {
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
        setRoute(EnvMaterializeKit_OpenTuiRoutesBeforePreview[idx - 1] ?? "workspace");
    }
    /** Advances the linear wizard or jumps to preview when already at the last pre-preview step. */
    function goForwardFrom(current) {
        if (current === "advanced") {
            goPreview();
            return;
        }
        const idx = routeIndex(current);
        if (idx >= EnvMaterializeKit_OpenTuiRoutesBeforePreview.length - 1) {
            goPreview();
            return;
        }
        setRoute(EnvMaterializeKit_OpenTuiRoutesBeforePreview[idx + 1] ?? "advanced");
    }
    /** Dispatches tab-select values to quit, linear navigation, preview run, or full restart. */
    function onNavSelect(current, value) {
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
    return (_jsxs("box", { style: { flexDirection: "column", flexGrow: 1, gap: 1, padding: 1 }, children: [_jsxs("text", { children: ["env-materialize (OpenTUI) \u2014 route: ", route] }), route === "workspace" ? (_jsxs(_Fragment, { children: [_jsx("text", { children: "Workspace paths" }), _jsx("scrollbox", { style: { flexGrow: 1 }, children: _jsx("box", { style: { flexDirection: "column", gap: 1 }, children: renderTextFields({ fields: workspaceFields, model, setModel }) }) }), _jsx("tab-select", { onSelect: (_i, option) => onNavSelect("workspace", option?.value), options: EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
                            continueLabel: "Continue to mode",
                        }), showDescription: true })] })) : null, route === "mode" ? (_jsxs(_Fragment, { children: [_jsx("text", { children: "Mode" }), _jsx("select", { onChange: (_index, option) => {
                            const value = option?.value;
                            if (value !== undefined && behavior.isMode(value)) {
                                setModel((m) => ({ ...m, mode: value }));
                            }
                        }, options: modeOptions, selectedIndex: modeIndex, showDescription: false }), _jsx("tab-select", { onSelect: (_i, option) => onNavSelect("mode", option?.value), options: EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
                            continueLabel: "Continue to logical environment",
                        }), showDescription: true })] })) : null, route === "logicalEnv" ? (_jsxs(_Fragment, { children: [_jsx("text", { children: "Logical environment" }), _jsx("select", { onChange: (_index, option) => {
                            const value = option?.value;
                            if (value !== undefined &&
                                behavior.isLogicalEnvironmentId(value)) {
                                setModel((m) => ({ ...m, logicalEnvironmentId: value }));
                            }
                        }, options: logicalEnvOptions, selectedIndex: logicalIndex, showDescription: false }), _jsx("tab-select", { onSelect: (_i, option) => onNavSelect("logicalEnv", option?.value), options: EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
                            continueLabel: "Continue to targets",
                        }), showDescription: true })] })) : null, route === "targets" ? (_jsxs(_Fragment, { children: [_jsx("text", { children: "Targets" }), _jsx("select", { onChange: (_index, option) => {
                            const value = option?.value;
                            if (value !== undefined &&
                                (value === "all" || behavior.isTarget(value))) {
                                setModel((m) => ({ ...m, targetsChoice: value }));
                            }
                        }, options: targetsOptions, selectedIndex: targetsIndex, showDescription: false }), _jsx("tab-select", { onSelect: (_i, option) => onNavSelect("targets", option?.value), options: EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
                            continueLabel: "Continue to machine profile",
                        }), showDescription: true })] })) : null, route === "machineProfile" ? (_jsxs(_Fragment, { children: [_jsxs("text", { children: ["Machine profile (from ", machineProfileRoot, ")"] }), _jsx("select", { onChange: (_index, option) => {
                            const value = option?.value;
                            setModel((m) => ({ ...m, machineProfile: value ?? "" }));
                        }, options: machineProfileOptions, selectedIndex: machineIndex, showDescription: false }), _jsx("tab-select", { onSelect: (_i, option) => onNavSelect("machineProfile", option?.value), options: EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
                            continueLabel: "Continue to advanced overrides",
                        }), showDescription: true })] })) : null, route === "advanced" ? (_jsxs(_Fragment, { children: [previewError.length > 0 ? _jsx("text", { children: previewError }) : null, _jsx("text", { children: "Optional overrides" }), _jsx("scrollbox", { style: { flexGrow: 1 }, children: _jsx("box", { style: { flexDirection: "column", gap: 1 }, children: renderTextFields({ fields: advancedFields, model, setModel }) }) }), _jsx("tab-select", { onSelect: (_i, option) => onNavSelect("advanced", option?.value), options: EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions({
                            continueLabel: "Continue to command preview",
                        }), showDescription: true })] })) : null, route === "preview" ? (_jsxs(_Fragment, { children: [_jsx("text", { children: "Command preview (exact)" }), _jsx("scrollbox", { style: { flexGrow: 1 }, children: _jsx("text", { children: previewLines }) }), _jsx("tab-select", { onSelect: (_i, option) => onNavSelect("preview", option?.value), options: EnvMaterializeKit_buildOpenTuiRunBackQuitOptions(), showDescription: true })] })) : null, route === "running" ? (_jsxs(_Fragment, { children: [_jsx("text", { children: "Running materializer (streaming)" }), _jsx("scrollbox", { style: { flexGrow: 1, maxHeight: 18 }, children: _jsx("text", { children: runStdout.length > 0 ? runStdout : "(stdout empty so far)" }) }), _jsx("text", { children: "stderr" }), _jsx("scrollbox", { style: { maxHeight: 6 }, children: _jsx("text", { children: runStderr.length > 0 ? runStderr : "(empty)" }) }), _jsx("text", { children: "Closing when the process exits\u2026" })] })) : null, route === "result" ? (_jsxs(_Fragment, { children: [_jsxs("text", { children: ["Exit code: ", runStatus === null ? "unknown" : String(runStatus)] }), _jsx("text", { children: "Stdout" }), _jsx("scrollbox", { style: { flexGrow: 1, maxHeight: 12 }, children: _jsx("text", { children: runStdout.length > 0 ? runStdout : "(empty)" }) }), _jsx("text", { children: "Engine lines (parsed)" }), _jsx("scrollbox", { style: { maxHeight: 6 }, children: _jsx("text", { children: mutationSummary.length > 0 ? mutationSummary : "(none)" }) }), _jsx("text", { children: "Stderr" }), _jsx("scrollbox", { style: { maxHeight: 5 }, children: _jsx("text", { children: runStderr.length > 0 ? runStderr : "(empty)" }) }), _jsx("tab-select", { onSelect: (_i, option) => onNavSelect("result", option?.value), options: EnvMaterializeKit_buildOpenTuiResultOptions(), showDescription: true })] })) : null] }));
}
