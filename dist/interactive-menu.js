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
/** Renders the configured env-materialization menu to the provided session. */
export function EnvMaterializeKit_printInteractiveMenu(options) {
    options.session.clearScreen();
    options.session.printHeader(options.config.headerFamily, options.config.headerFocus);
    options.session.printPanelTitle(options.config.panelTitle, options.config.panelSubtitle);
    options.session.printKicker(options.config.kicker);
    for (const item of options.config.items) {
        options.session.printMenuItem(item.key, item.label, item.description);
    }
    options.session.printSectionBreak();
    options.session.writeLine("");
}
/** Handles one configured menu selection, returning whether the caller should keep looping. */
export async function EnvMaterializeKit_handleInteractiveMenuSelection(options) {
    const item = options.config.items.find((candidate) => candidate.key === options.action);
    if (item === undefined) {
        options.session.printError(options.config.invalidSelectionMessage);
        return "continue";
    }
    if (item.kind === "exit") {
        options.session.printSuccess(item.exitMessage);
        return "exit";
    }
    await options.runScript({
        cwd: options.cwd,
        scriptName: item.scriptName,
        session: options.session,
    });
    return "continue";
}
/** Runs the configured interactive menu loop until the operator chooses the exit action. */
export async function EnvMaterializeKit_runInteractiveMenu(options) {
    for (;;) {
        EnvMaterializeKit_printInteractiveMenu({
            config: options.config,
            session: options.session,
        });
        const action = await options.session.promptReadLine(options.config.promptText);
        const outcome = await EnvMaterializeKit_handleInteractiveMenuSelection({
            action,
            config: options.config,
            cwd: options.cwd,
            runScript: options.runScript,
            session: options.session,
        });
        if (outcome === "exit") {
            return;
        }
    }
}
//# sourceMappingURL=interactive-menu.js.map