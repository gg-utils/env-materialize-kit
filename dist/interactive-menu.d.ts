/**
 * @fileoverview Reusable interactive console loop for env-materialization menu adapters.
 *
 * Flow: config-provided menu rows + TTY session abstraction -> repeated prompt/dispatch until exit.
 * Script adapters keep project-specific npm script names and TTY guards, while this package owns
 * menu rendering, selection validation, and run-vs-exit control flow.
 *
 * @testing Node test runner (tsx): cd packages/env-materialize-kit && npm run test
 *
 * @see packages/env-materialize-kit/src/interactive-menu.unit.test.ts - Node `tsx --test` suite asserting grouped rendering, invalid selections, exit handling, and the full read-eval loop contract owned by this module.
 * @see scripts/env-materialize/ui/cli-interactive/main.ts - Env-materialize TTY entrypoint that binds session, cwd, and npm script runners to `EnvMaterializeKit_runInteractiveMenu` for workspace operators.
 * @see packages/env-materialize-kit/src/index.ts - Package barrel re-exporting this interactive-menu surface as `@gg-utils/env-materialize-kit/interactive-menu` alongside other kit primitives.
 *
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
/** Minimal terminal session surface consumed by the reusable menu loop. */
export type EnvMaterializeKit_InteractiveMenuSession = {
    clearScreen: () => void;
    printError: (text: string) => void;
    printHeader: (family: string, focus: string) => void;
    printKicker: (text: string) => void;
    printMenuItem: (number: string | number, label: string, description: string) => void;
    printPanelTitle: (title: string, subtitle?: string) => void;
    printSectionBreak: () => void;
    printSuccess: (text: string) => void;
    promptReadLine: (promptText: string) => Promise<string>;
    writeLine: (text?: string) => void;
};
/** Interactive menu row that delegates to one configured npm script. */
export type EnvMaterializeKit_InteractiveMenuScriptItem = {
    description: string;
    key: string;
    kind: "run-script";
    label: string;
    scriptName: string;
};
/** Interactive menu row that exits the console. */
export type EnvMaterializeKit_InteractiveMenuExitItem = {
    description: string;
    exitMessage: string;
    key: string;
    kind: "exit";
    label: string;
};
/** One configured menu row for the env-materialization interactive console. */
export type EnvMaterializeKit_InteractiveMenuItem = EnvMaterializeKit_InteractiveMenuScriptItem | EnvMaterializeKit_InteractiveMenuExitItem;
/** Project-provided copy and rows for the reusable env-materialization menu loop. */
export type EnvMaterializeKit_InteractiveMenuConfig = {
    headerFamily: string;
    headerFocus: string;
    invalidSelectionMessage: string;
    items: readonly EnvMaterializeKit_InteractiveMenuItem[];
    kicker: string;
    panelSubtitle: string;
    panelTitle: string;
    promptText: string;
};
/** Callback used by adapters to bind a package-owned selection to their process runner. */
export type EnvMaterializeKit_RunInteractiveMenuScript<Session extends EnvMaterializeKit_InteractiveMenuSession> = (options: {
    cwd: string;
    scriptName: string;
    session: Session;
}) => Promise<void>;
/** Outcome of handling one interactive menu action. */
export type EnvMaterializeKit_InteractiveMenuOutcome = "continue" | "exit";
/** Renders the configured env-materialization menu to the provided session. */
export declare function EnvMaterializeKit_printInteractiveMenu(options: {
    config: EnvMaterializeKit_InteractiveMenuConfig;
    session: EnvMaterializeKit_InteractiveMenuSession;
}): void;
/** Handles one configured menu selection, returning whether the caller should keep looping. */
export declare function EnvMaterializeKit_handleInteractiveMenuSelection<Session extends EnvMaterializeKit_InteractiveMenuSession>(options: {
    action: string;
    config: EnvMaterializeKit_InteractiveMenuConfig;
    cwd: string;
    runScript: EnvMaterializeKit_RunInteractiveMenuScript<Session>;
    session: Session;
}): Promise<EnvMaterializeKit_InteractiveMenuOutcome>;
/** Runs the configured interactive menu loop until the operator chooses the exit action. */
export declare function EnvMaterializeKit_runInteractiveMenu<Session extends EnvMaterializeKit_InteractiveMenuSession>(options: {
    config: EnvMaterializeKit_InteractiveMenuConfig;
    cwd: string;
    runScript: EnvMaterializeKit_RunInteractiveMenuScript<Session>;
    session: Session;
}): Promise<void>;
//# sourceMappingURL=interactive-menu.d.ts.map