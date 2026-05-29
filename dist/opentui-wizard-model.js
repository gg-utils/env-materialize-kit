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
import path from "node:path";
/** Routes before the preview/run/result terminal screens. */
export const EnvMaterializeKit_OpenTuiRoutesBeforePreview = ["workspace", "mode", "logicalEnv", "targets", "machineProfile", "advanced"];
/** Resolves a filesystem path for profile discovery, falling back for blank input. */
export function EnvMaterializeKit_resolveOpenTuiProfileDiscoveryRoot(options) {
    const trimmed = options.rawPath.trim();
    return trimmed.length > 0 ? path.resolve(trimmed) : options.fallbackRoot;
}
/** Builds standard forward/back/quit choices for linear wizard steps before preview. */
export function EnvMaterializeKit_buildOpenTuiContinueBackQuitOptions(options) {
    return [
        { description: options.continueLabel, name: "Continue", value: "continue" },
        { description: "Previous screen", name: "Back", value: "back" },
        { description: "Exit", name: "Quit", value: "quit" },
    ];
}
/** Builds preview-screen navigation choices. */
export function EnvMaterializeKit_buildOpenTuiRunBackQuitOptions() {
    return [
        { description: "Run materializer subprocess", name: "Run", value: "run" },
        { description: "Edit options", name: "Back", value: "back" },
        { description: "Exit", name: "Quit", value: "quit" },
    ];
}
/** Builds post-run navigation choices. */
export function EnvMaterializeKit_buildOpenTuiResultOptions() {
    return [
        {
            description: "Start over from workspace",
            name: "Restart",
            value: "restart",
        },
        { description: "Exit", name: "Quit", value: "quit" },
    ];
}
/** Builds mode select options from a project-supplied mode list. */
export function EnvMaterializeKit_buildOpenTuiModeOptions(options) {
    return options.modes.map((mode) => ({
        description: `Mode: ${mode}`,
        name: mode,
        value: mode,
    }));
}
/** Builds logical-environment select options from a project-supplied id list. */
export function EnvMaterializeKit_buildOpenTuiLogicalEnvironmentOptions(options) {
    return options.logicalEnvironmentIds.map((id) => ({
        description: `Logical environment: ${id}`,
        name: id,
        value: id,
    }));
}
/** Builds target choice select options for the package-owned target families. */
export function EnvMaterializeKit_buildOpenTuiTargetsOptions() {
    return [
        { description: "local-edge + packages", name: "all", value: "all" },
        { description: "local-edge only", name: "local-edge", value: "local-edge" },
        { description: "packages only", name: "packages", value: "packages" },
    ];
}
/** Builds machine-profile select options from discovered profile names. */
export function EnvMaterializeKit_buildOpenTuiMachineProfileOptions(options) {
    return [
        {
            description: options.emptyDescription,
            name: options.emptyName,
            value: "",
        },
        ...options.profiles.map((profile) => ({
            description: profile,
            name: profile,
            value: profile,
        })),
    ];
}
/** Returns selected option index for a value, defaulting to zero when the value is absent. */
export function EnvMaterializeKit_findOpenTuiSelectedOptionIndex(options) {
    return Math.max(0, options.options.findIndex((option) => option.value === options.selectedValue));
}
/** Maps a route to its index within the linear pre-preview sequence, or the preview bucket. */
export function EnvMaterializeKit_openTuiRouteIndex(options) {
    const routes = options.routesBeforePreview ?? EnvMaterializeKit_OpenTuiRoutesBeforePreview;
    if (options.route === "preview" ||
        options.route === "running" ||
        options.route === "result") {
        return routes.length;
    }
    const index = routes.indexOf(options.route);
    return index >= 0 ? index : 0;
}
/** Summarizes materializer stdout/stderr using canonical `[env-materialize]` lines when present. */
export function EnvMaterializeKit_summarizeOpenTuiMaterializerOutput(options) {
    const combined = `${options.stdout}${options.stderr}`;
    const lines = combined
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0);
    const materializeLines = lines.filter((line) => line.startsWith("[env-materialize]"));
    if (materializeLines.length > 0) {
        return materializeLines.join("\n");
    }
    if (options.stdout.trim().length > 0) {
        return options.stdout.trim();
    }
    return "(no [env-materialize] lines in stdout)";
}
//# sourceMappingURL=opentui-wizard-model.js.map