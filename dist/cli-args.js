/**
 * @fileoverview Product-neutral argv parsing and serialization for env materialization CLIs.
 *
 * Flow: raw argv + project-supplied literal guards + additional option definitions -> parsed
 * workspace, mode, target, and opaque option maps.
 *
 * @testing CLI: npm run env-materialize-kit:test
 *
 * @see env-materialize.config.ts - Root consumer materialize config that wires logical-environment, mode, and target guards plus additional flags into the parser exported from this module.
 * @see packages/env-materialize-kit/src/cli-args.unit.test.ts - node:test regression module that asserts argv parsing, help handling, target expansion, and additional-option maps for this contract.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
import path from "node:path";
/** Parses a positive integer option value for a known flag. */
export function EnvMaterializeKit_parsePositiveIntegerCliValue(options) {
    const parsed = Number.parseInt(options.rawValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`[env-materialize] ${options.flagName} must be a positive integer.`);
    }
    return parsed;
}
/** Expands a comma-separated target token list into validated target ids. */
export function EnvMaterializeKit_parseCliTargets(options) {
    const allTargetsToken = options.allTargetsToken ?? "all";
    const rawTargets = options.rawValue
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    if (rawTargets.length === 0 || rawTargets.includes(allTargetsToken)) {
        return Array.from(options.defaultTargets);
    }
    const targets = [];
    const invalidTargets = [];
    for (const rawTarget of rawTargets) {
        if (!options.isTarget(rawTarget)) {
            invalidTargets.push(rawTarget);
            continue;
        }
        if (!targets.includes(rawTarget)) {
            targets.push(rawTarget);
        }
    }
    if (invalidTargets.length > 0) {
        throw new Error(`[env-materialize] Unsupported target(s): ${invalidTargets.join(", ")}.`);
    }
    return targets;
}
/** Parses the reusable env-materialize argv contract and project-owned additional flags. */
export function EnvMaterializeKit_parseCliArgs(options) {
    const additionalOptionByFlag = new Map();
    for (const additionalOption of options.additionalOptions) {
        additionalOptionByFlag.set(additionalOption.flag, additionalOption);
    }
    const helpFlags = options.helpFlags ?? ["--help", "-h"];
    let workspacePath = options.currentWorkingDirectory;
    let logicalEnvironmentId = null;
    let mode = null;
    let targets = Array.from(options.defaultTargets);
    const stringOptionValuesByKey = new Map();
    const positiveIntegerOptionValuesByKey = new Map();
    for (let index = 0; index < options.argv.length; index += 1) {
        const argument = options.argv[index] ?? "";
        const value = options.argv[index + 1] ?? "";
        if (helpFlags.includes(argument)) {
            return { kind: "help" };
        }
        switch (argument) {
            case "--workspace":
                workspacePath = value;
                index += 1;
                continue;
            case "--logical-environment":
                if (!value || !options.isLogicalEnvironmentId(value)) {
                    throw new Error("[env-materialize] --logical-environment must be one of: " +
                        `${options.logicalEnvironmentLabels.join(", ")}.`);
                }
                logicalEnvironmentId = value;
                index += 1;
                continue;
            case "--mode":
                if (!value || !options.isMode(value)) {
                    throw new Error(`[env-materialize] --mode must be one of: ${options.modeLabels.join(", ")}.`);
                }
                mode = value;
                index += 1;
                continue;
            case "--targets":
                targets = EnvMaterializeKit_parseCliTargets({
                    ...(options.allTargetsToken === undefined ? {} : { allTargetsToken: options.allTargetsToken }),
                    defaultTargets: options.defaultTargets,
                    isTarget: options.isTarget,
                    rawValue: value,
                });
                index += 1;
                continue;
            default:
                break;
        }
        const additionalOption = additionalOptionByFlag.get(argument);
        if (additionalOption === undefined) {
            throw new Error(`[env-materialize] Unknown argument '${argument}'.`);
        }
        if (additionalOption.kind === "positive-integer") {
            positiveIntegerOptionValuesByKey.set(additionalOption.key, EnvMaterializeKit_parsePositiveIntegerCliValue({
                flagName: additionalOption.flag,
                rawValue: value,
            }));
            index += 1;
            continue;
        }
        const normalizedValue = EnvMaterializeKit_normalizeStringOptionValue({
            currentWorkingDirectory: options.currentWorkingDirectory,
            rawValue: value,
            valueNormalization: additionalOption.valueNormalization,
        });
        if (normalizedValue !== undefined) {
            stringOptionValuesByKey.set(additionalOption.key, normalizedValue);
        }
        index += 1;
    }
    if (logicalEnvironmentId === null) {
        throw new Error("[env-materialize] --logical-environment is required.");
    }
    return {
        kind: "parsed",
        options: {
            logicalEnvironmentId,
            mode: mode ?? options.defaultMode,
            positiveIntegerOptionValuesByKey,
            stringOptionValuesByKey,
            targets,
            workspacePath: path.resolve(options.currentWorkingDirectory, workspacePath),
        },
    };
}
/** Serializes parsed CLI options into stable argv token order. */
export function EnvMaterializeKit_serializeCliOptionsToArgv(options) {
    const argv = [
        "--workspace",
        options.workspacePath,
        "--logical-environment",
        options.logicalEnvironmentId,
        "--mode",
        options.mode,
    ];
    if (!EnvMaterializeKit_isDefaultTargetSelection(options)) {
        argv.push("--targets", options.targets.join(","));
    }
    for (const additionalOption of options.additionalOptions) {
        if (additionalOption.kind === "positive-integer") {
            const value = options.positiveIntegerOptionValuesByKey.get(additionalOption.key);
            if (value !== undefined) {
                argv.push(additionalOption.flag, String(value));
            }
            continue;
        }
        const value = options.stringOptionValuesByKey.get(additionalOption.key);
        if (value !== undefined && value.length > 0) {
            argv.push(additionalOption.flag, value);
        }
    }
    return argv;
}
/** Collects defined additional option values into the maps consumed by argv serialization. */
export function EnvMaterializeKit_collectCliAdditionalOptionValueMaps(options) {
    const positiveIntegerOptionValuesByKey = new Map();
    const stringOptionValuesByKey = new Map();
    for (const additionalOption of options.additionalOptions) {
        if (additionalOption.kind === "positive-integer") {
            const value = options.positiveIntegerOptionValuesByKey?.get(additionalOption.key);
            if (value !== undefined) {
                positiveIntegerOptionValuesByKey.set(additionalOption.key, value);
            }
            continue;
        }
        const value = options.stringOptionValuesByKey?.get(additionalOption.key);
        const normalizedValue = value === undefined
            ? undefined
            : EnvMaterializeKit_normalizeSerializableStringOptionValue({
                value,
                valueNormalization: additionalOption.valueNormalization,
            });
        if (normalizedValue !== undefined) {
            stringOptionValuesByKey.set(additionalOption.key, normalizedValue);
        }
    }
    return {
        positiveIntegerOptionValuesByKey,
        stringOptionValuesByKey,
    };
}
/** Normalizes a string flag value according to its explicit option definition. */
function EnvMaterializeKit_normalizeStringOptionValue(options) {
    if (options.valueNormalization === "resolve-path-if-nonempty") {
        return options.rawValue.length > 0
            ? path.resolve(options.currentWorkingDirectory, options.rawValue)
            : undefined;
    }
    const trimmedValue = options.rawValue.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
}
/** Normalizes a parsed string option value before re-serializing it. */
function EnvMaterializeKit_normalizeSerializableStringOptionValue(options) {
    if (options.valueNormalization === "trim-if-nonempty") {
        const trimmedValue = options.value.trim();
        return trimmedValue.length > 0 ? trimmedValue : undefined;
    }
    return options.value.length > 0 ? options.value : undefined;
}
/** Returns true when the selected targets are exactly the configured default target set. */
function EnvMaterializeKit_isDefaultTargetSelection(options) {
    return (options.targets.length === options.defaultTargets.length &&
        options.defaultTargets.every((target) => options.targets.includes(target)));
}
