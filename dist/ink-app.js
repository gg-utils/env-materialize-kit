import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { EnvMaterializeKit_findMachineProfileLabelIndex, EnvMaterializeKit_findSelectedValueIndex, EnvMaterializeKit_getInkSessionDoneStatusLabel, EnvMaterializeKit_getInkWizardLegendLines, EnvMaterializeKit_InkTargetChoiceLabels, EnvMaterializeKit_resolveInkProfileDiscoveryRoot, EnvMaterializeKit_resolveNextInkWizardStep, EnvMaterializeKit_resolvePreviousInkWizardStep, EnvMaterializeKit_targetChoiceSelectedIndex, } from "./ink-wizard-model.js";
import { EnvMaterializeKit_startInkCliTaskProcess, } from "./ui-launcher.js";
/** Returns the configured path field for a wizard step. */
function findPathField(options) {
    return options.fields.find((field) => field.step === options.step) ?? null;
}
/** Joins a command name and args array into a single space-separated command line string. */
function formatInkCliCommandLine(command, args) {
    return [command, ...args].join(" ");
}
/** Returns the last `count` items from `lines`, or all items if shorter. */
function sliceRecentLines(lines, count) {
    if (lines.length <= count) {
        return [...lines];
    }
    return lines.slice(lines.length - count);
}
/** Renders captured stdout/stderr lines with source-aware coloring. */
function InkCapturedOutputBlock({ bracketSource = false, lines, maxLines, title, }) {
    const recent = sliceRecentLines(lines, maxLines);
    return (_jsxs(Box, { flexDirection: "column", marginTop: title ? 1 : 0, children: [title ? _jsx(Text, { bold: true, children: title }) : null, recent.map((line, index) => (_jsx(Text, { color: line.source === "stderr" ? "red" : "white", children: bracketSource ? `[${line.source}] ${line.text}` : line.text }, `${line.source}:${String(index)}`)))] }));
}
/** Renders a titled command line block using Ink `Box` and `Text` with word-wrap support. */
function InkCommandPreview({ commandLine, title = "Command", }) {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, children: title }), _jsx(Text, { wrap: "wrap", children: commandLine })] }));
}
/** Top-of-screen header with app name, description, and current step summary. */
function InkScreenHeader({ appName, description, summary, }) {
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, color: "green", children: appName }), _jsx(Text, { color: "gray", children: description }), _jsx(Box, { children: summary })] }));
}
/** Renders keyboard shortcut hints for the current wizard step. */
function InkLegend({ lines, }) {
    return (_jsxs(Box, { marginTop: 1, flexDirection: "column", gap: 0, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, children: "Keys" }) }), lines.map((line, lineIndex) => (_jsx(Text, { color: "gray", children: line }, String(lineIndex))))] }));
}
/** Handles `q` cancellation while the workspace command is running in the `session` step. */
function handleWizardSessionKeyboard(ctx) {
    if (ctx.input === "q" && ctx.runCancel) {
        ctx.runCancel();
    }
}
/** Handles quit keys and `r` restart after the spawned session finishes in the `result` step. */
function handleWizardResultKeyboard(ctx) {
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
function handleWizardReviewKeyboard(ctx) {
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
function handleWizardModeKeyboard(ctx) {
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
            const idx = Math.min(ctx.modes.length - 1, ctx.modes.indexOf(selected) + 1);
            return ctx.behavior.writeMode(model, ctx.modes[idx] ?? selected);
        });
    }
}
/** Adjusts the logical environment list selection with Up/Down arrows. */
function handleWizardLogicalEnvKeyboard(ctx) {
    if (ctx.key.upArrow) {
        ctx.setModel((model) => {
            const selected = ctx.behavior.readLogicalEnvironmentId(model);
            const idx = Math.max(0, ctx.logicalEnvironmentIds.indexOf(selected) - 1);
            return ctx.behavior.writeLogicalEnvironmentId(model, ctx.logicalEnvironmentIds[idx] ?? selected);
        });
    }
    if (ctx.key.downArrow) {
        ctx.setModel((model) => {
            const selected = ctx.behavior.readLogicalEnvironmentId(model);
            const idx = Math.min(ctx.logicalEnvironmentIds.length - 1, ctx.logicalEnvironmentIds.indexOf(selected) + 1);
            return ctx.behavior.writeLogicalEnvironmentId(model, ctx.logicalEnvironmentIds[idx] ?? selected);
        });
    }
}
/** Adjusts the targets choice cycle with Up/Down arrows in the `targets` step. */
function handleWizardTargetsKeyboard(ctx) {
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
function handleWizardMachineProfileKeyboard(ctx) {
    const selectProfile = (model, delta) => {
        const resolved = EnvMaterializeKit_resolveInkProfileDiscoveryRoot({
            fallbackRoot: ctx.projectRoot,
            privateNotesWorkspacePath: ctx.behavior.readPrivateNotesWorkspacePath(model),
            workspacePath: ctx.behavior.readWorkspacePath(model),
        });
        const labels = ["(none)", ...ctx.behavior.listMachineProfiles(resolved)];
        const currentProfile = ctx.behavior.readMachineProfile(model);
        const currentIndex = Math.max(0, labels.findIndex((label) => label === "(none)"
            ? currentProfile.trim().length === 0
            : label === currentProfile));
        const nextIndex = Math.min(labels.length - 1, Math.max(0, currentIndex + delta));
        const label = labels[nextIndex] ?? "(none)";
        return ctx.behavior.writeMachineProfile(model, label === "(none)" ? "" : label);
    };
    if (ctx.key.upArrow) {
        ctx.setModel((model) => selectProfile(model, -1));
    }
    if (ctx.key.downArrow) {
        ctx.setModel((model) => selectProfile(model, 1));
    }
}
/** Edits the focused advanced override field with arrows, delete, and printable keys. */
function handleWizardAdvancedKeyboard(ctx, advancedFields) {
    if (ctx.key.upArrow) {
        ctx.setAdvancedFieldIndex((i) => Math.max(0, i - 1));
    }
    if (ctx.key.downArrow) {
        ctx.setAdvancedFieldIndex((i) => Math.min(advancedFields.length - 1, i + 1));
    }
    const field = advancedFields[ctx.advancedFieldIndex];
    if (!field) {
        return;
    }
    if (ctx.key.backspace || ctx.key.delete) {
        ctx.setModel((model) => field.writeValue(model, field
            .readValue(model)
            .slice(0, Math.max(0, field.readValue(model).length - 1))));
        return;
    }
    if (ctx.input && !ctx.key.return && !ctx.key.tab && !ctx.key.escape) {
        ctx.setModel((model) => field.writeValue(model, field.readValue(model) + ctx.input));
    }
}
/** Applies backspace/delete and printable keys to configured path text steps. */
function handleWizardPathTextKeyboard(ctx) {
    const field = findPathField({ fields: ctx.pathFields, step: ctx.step });
    if (!field) {
        return;
    }
    if (ctx.key.backspace || ctx.key.delete) {
        ctx.setModel((model) => field.writeValue(model, field
            .readValue(model)
            .slice(0, Math.max(0, field.readValue(model).length - 1))));
        return;
    }
    if (ctx.input && !ctx.key.return && !ctx.key.tab && !ctx.key.escape) {
        ctx.setModel((model) => field.writeValue(model, field.readValue(model) + ctx.input));
    }
}
/** Routes Ink stdin keys through the wizard steps. */
function routeWizardKeyboard(ctx, advancedFields) {
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
function StepMode({ modeIndex, modes, }) {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, children: "Mode" }), modes.map((mode, index) => (_jsxs(Text, { color: index === modeIndex ? "cyan" : undefined, children: [index === modeIndex ? "> " : "  ", mode] }, mode)))] }));
}
/** Renders a titled vertical list selector with the active row highlighted. */
function StepSelect({ labels, selectedIndex, title, }) {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, children: title }), labels.map((label, index) => (_jsxs(Text, { color: index === selectedIndex ? "cyan" : undefined, children: [index === selectedIndex ? "> " : "  ", label] }, label)))] }));
}
/** Renders a titled read-only text field preview with a short gray description line. */
function StepText({ description, title, value, }) {
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, children: title }), _jsx(Text, { color: "gray", children: description }), _jsx(Text, { children: value.length > 0 ? value : "(empty)" })] }));
}
/** Renders the review-step preflight recap. */
function renderPreflightReviewSection(options) {
    if (!options.isCheckMode && options.cliOptions) {
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { bold: true, children: "Preflight check (mode=check, same paths)" }), options.preflightError ? (_jsx(Text, { color: "red", children: options.preflightError })) : options.preflightLines ? (options.preflightLines.map((line) => _jsx(Text, { children: line }, line))) : (_jsx(Text, { color: "gray", children: "Running preflight\u2026" }))] }));
    }
    if (options.isCheckMode) {
        return (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", children: "Selected mode is check; preflight is the same as the final run." }) }));
    }
    return null;
}
/** Open root for a config-driven env-materialize Ink workflow. */
export function EnvMaterializeKitInkApp({ advancedFields, appName, behavior, description, logicalEnvironmentIds, modes, pathFields, projectRoot, runCommand, }) {
    const { exit } = useApp();
    const [step, setStep] = useState("mode");
    const [model, setModel] = useState(() => behavior.defaultFormModel(projectRoot));
    const [advancedFieldIndex, setAdvancedFieldIndex] = useState(0);
    const [preflightLines, setPreflightLines] = useState(null);
    const [preflightError, setPreflightError] = useState(null);
    const [buildError, setBuildError] = useState(null);
    const [sessionLines, setSessionLines] = useState([]);
    const [sessionDone, setSessionDone] = useState(null);
    const [runCancel, setRunCancel] = useState(null);
    const [sessionNonce, setSessionNonce] = useState(0);
    const selectedMode = behavior.readMode(model);
    const selectedLogicalEnvironmentId = behavior.readLogicalEnvironmentId(model);
    const selectedTargetsChoice = behavior.readTargetsChoice(model);
    const selectedMachineProfile = behavior.readMachineProfile(model);
    const workspacePath = behavior.readWorkspacePath(model);
    const privateNotesWorkspacePath = behavior.readPrivateNotesWorkspacePath(model);
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
    const privateNotesResolved = EnvMaterializeKit_resolveInkProfileDiscoveryRoot({
        fallbackRoot: projectRoot,
        privateNotesWorkspacePath,
        workspacePath,
    });
    const machineProfileSlugs = useMemo(() => behavior.listMachineProfiles(privateNotesResolved), [behavior, privateNotesResolved]);
    const machineProfileLabels = useMemo(() => ["(none)", ...machineProfileSlugs], [machineProfileSlugs]);
    const machineProfileIndex = EnvMaterializeKit_findMachineProfileLabelIndex({
        emptyLabel: "(none)",
        labels: machineProfileLabels,
        machineProfile: selectedMachineProfile,
    });
    const buildResult = useMemo(() => {
        try {
            return {
                ok: true,
                options: behavior.buildCliOptions(model),
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { ok: false, message };
        }
    }, [behavior, model]);
    const cliOptions = buildResult.ok
        ? buildResult.options
        : null;
    const serializedArgv = useMemo(() => (cliOptions ? behavior.serializeCliOptionsToArgv(cliOptions) : []), [behavior, cliOptions]);
    const fullRunArgs = useMemo(() => [...runCommand.argsBeforeSerializedArgv, ...serializedArgv], [runCommand.argsBeforeSerializedArgv, serializedArgv]);
    const commandLine = useMemo(() => formatInkCliCommandLine(runCommand.command, fullRunArgs), [fullRunArgs, runCommand.command]);
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
        }
        catch (error) {
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
                onStarted: () => { },
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
        routeWizardKeyboard({
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
        }, advancedFields);
    });
    const advancedField = advancedFields[advancedFieldIndex];
    const activePathField = findPathField({ fields: pathFields, step });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(InkScreenHeader, { appName: appName, description: description, summary: _jsxs(Text, { children: ["Step: ", step] }) }), step === "mode" ? (_jsx(StepMode, { modeIndex: modeIndex, modes: modes })) : null, activePathField ? (_jsx(StepText, { title: activePathField.label, description: activePathField.description ?? "Edit this value.", value: activePathField.readValue(model) })) : null, step === "logicalEnv" ? (_jsx(StepSelect, { title: "Logical environment", labels: logicalEnvironmentIds, selectedIndex: logicalEnvIndex })) : null, step === "targets" ? (_jsx(StepSelect, { title: "Targets", labels: EnvMaterializeKit_InkTargetChoiceLabels, selectedIndex: targetsIndex })) : null, step === "machineProfile" ? (_jsx(StepSelect, { title: `Machine profile (under ${privateNotesResolved})`, labels: machineProfileLabels, selectedIndex: machineProfileIndex })) : null, step === "advanced" && advancedField ? (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, children: "Optional overrides (Up/Down field, type to edit)" }), advancedFields.map((field, index) => (_jsxs(Text, { color: index === advancedFieldIndex ? "cyan" : undefined, children: [index === advancedFieldIndex ? "> " : "  ", field.label, ":", " ", field.readValue(model).length > 0
                                ? field.readValue(model)
                                : "(empty)"] }, field.id)))] })) : null, step === "review" ? (_jsxs(Box, { flexDirection: "column", children: [buildError ? (_jsxs(Text, { color: "red", children: ["Fix options: ", buildError] })) : (_jsx(InkCommandPreview, { commandLine: commandLine })), renderPreflightReviewSection({
                        cliOptions,
                        isCheckMode: selectedMode === "check",
                        preflightError,
                        preflightLines,
                    })] })) : null, step === "session" ? (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, children: "Running" }), _jsx(InkCommandPreview, { commandLine: commandLine }), _jsx(InkCapturedOutputBlock, { title: "Output", lines: sessionLines, maxLines: 20, bracketSource: true })] })) : null, step === "result" && sessionDone ? (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { bold: true, color: sessionDone.status === "succeeded" ? "green" : "red", children: [EnvMaterializeKit_getInkSessionDoneStatusLabel(sessionDone.status), sessionDone.exitCode === null
                                ? ""
                                : ` (exit ${String(sessionDone.exitCode)})`] }), _jsx(InkCapturedOutputBlock, { title: "Captured output", lines: sessionLines, maxLines: 24, bracketSource: true })] })) : null, _jsx(InkLegend, { lines: EnvMaterializeKit_getInkWizardLegendLines({ buildError, step }) })] }));
}
//# sourceMappingURL=ink-app.js.map