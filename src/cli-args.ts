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

/** String option value normalization applied after a flag consumes its next argv token. */
export type EnvMaterializeKit_CliStringValueNormalization =
  | "resolve-path-if-nonempty"
  | "trim-if-nonempty";

/** Additional opaque string flag supplied by a project adapter/config. */
export type EnvMaterializeKit_CliAdditionalStringOption = {
  flag: string;
  key: string;
  kind: "string";
  valueNormalization: EnvMaterializeKit_CliStringValueNormalization;
};

/** Additional opaque positive-integer flag supplied by a project adapter/config. */
export type EnvMaterializeKit_CliAdditionalPositiveIntegerOption = {
  flag: string;
  key: string;
  kind: "positive-integer";
};

/** Additional project-owned flag definition understood by the reusable parser. */
export type EnvMaterializeKit_CliAdditionalOption =
  | EnvMaterializeKit_CliAdditionalStringOption
  | EnvMaterializeKit_CliAdditionalPositiveIntegerOption;

/** Options for parsing a project-specific env-materialize CLI invocation. */
export type EnvMaterializeKit_ParseCliArgs_Options<
  LogicalEnvironmentId extends string,
  Mode extends string,
  Target extends string,
> = {
  additionalOptions: readonly EnvMaterializeKit_CliAdditionalOption[];
  allTargetsToken?: string;
  argv: readonly string[];
  currentWorkingDirectory: string;
  defaultMode: Mode;
  defaultTargets: readonly Target[];
  helpFlags?: readonly string[];
  isLogicalEnvironmentId: (value: string) => value is LogicalEnvironmentId;
  isMode: (value: string) => value is Mode;
  isTarget: (value: string) => value is Target;
  logicalEnvironmentLabels: readonly string[];
  modeLabels: readonly string[];
};

/** Parsed CLI option envelope returned by the reusable argv parser. */
export type EnvMaterializeKit_ParsedCliArgs<
  LogicalEnvironmentId extends string,
  Mode extends string,
  Target extends string,
> = {
  logicalEnvironmentId: LogicalEnvironmentId;
  mode: Mode;
  positiveIntegerOptionValuesByKey: Map<string, number>;
  stringOptionValuesByKey: Map<string, string>;
  targets: Target[];
  workspacePath: string;
};

/** Discriminated parser result so project adapters can own help text and exit policy. */
export type EnvMaterializeKit_ParseCliArgs_Result<
  LogicalEnvironmentId extends string,
  Mode extends string,
  Target extends string,
> =
  | {
      kind: "help";
    }
  | {
      kind: "parsed";
      options: EnvMaterializeKit_ParsedCliArgs<
        LogicalEnvironmentId,
        Mode,
        Target
      >;
    };

/** Options for serializing a parsed env-materialize CLI invocation. */
export type EnvMaterializeKit_SerializeCliArgs_Options<
  LogicalEnvironmentId extends string,
  Mode extends string,
  Target extends string,
> = {
  additionalOptions: readonly EnvMaterializeKit_CliAdditionalOption[];
  defaultTargets: readonly Target[];
  logicalEnvironmentId: LogicalEnvironmentId;
  mode: Mode;
  positiveIntegerOptionValuesByKey: ReadonlyMap<string, number>;
  stringOptionValuesByKey: ReadonlyMap<string, string>;
  targets: readonly Target[];
  workspacePath: string;
};

/** Filtered value maps for project-owned additional CLI options. */
export type EnvMaterializeKit_CliAdditionalOptionValueMaps = {
  positiveIntegerOptionValuesByKey: Map<string, number>;
  stringOptionValuesByKey: Map<string, string>;
};

/** Parses a positive integer option value for a known flag. */
export function EnvMaterializeKit_parsePositiveIntegerCliValue(options: {
  flagName: string;
  rawValue: string;
}): number {
  const parsed = Number.parseInt(options.rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(
      `[env-materialize] ${options.flagName} must be a positive integer.`,
    );
  }
  return parsed;
}

/** Expands a comma-separated target token list into validated target ids. */
export function EnvMaterializeKit_parseCliTargets<Target extends string>(options: {
  allTargetsToken?: string;
  defaultTargets: readonly Target[];
  isTarget: (value: string) => value is Target;
  rawValue: string;
}): Target[] {
  const allTargetsToken = options.allTargetsToken ?? "all";
  const rawTargets = options.rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (rawTargets.length === 0 || rawTargets.includes(allTargetsToken)) {
    return Array.from(options.defaultTargets);
  }

  const targets: Target[] = [];
  const invalidTargets: string[] = [];
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
    throw new Error(
      `[env-materialize] Unsupported target(s): ${invalidTargets.join(", ")}.`,
    );
  }

  return targets;
}

/** Parses the reusable env-materialize argv contract and project-owned additional flags. */
export function EnvMaterializeKit_parseCliArgs<
  LogicalEnvironmentId extends string,
  Mode extends string,
  Target extends string,
>(
  options: EnvMaterializeKit_ParseCliArgs_Options<
    LogicalEnvironmentId,
    Mode,
    Target
  >,
): EnvMaterializeKit_ParseCliArgs_Result<
  LogicalEnvironmentId,
  Mode,
  Target
> {
  const additionalOptionByFlag = new Map<
    string,
    EnvMaterializeKit_CliAdditionalOption
  >();
  for (const additionalOption of options.additionalOptions) {
    additionalOptionByFlag.set(additionalOption.flag, additionalOption);
  }

  const helpFlags = options.helpFlags ?? ["--help", "-h"];
  let workspacePath = options.currentWorkingDirectory;
  let logicalEnvironmentId: LogicalEnvironmentId | null = null;
  let mode: Mode | null = null;
  let targets: Target[] = Array.from(options.defaultTargets);
  const stringOptionValuesByKey = new Map<string, string>();
  const positiveIntegerOptionValuesByKey = new Map<string, number>();

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
          throw new Error(
            "[env-materialize] --logical-environment must be one of: " +
              `${options.logicalEnvironmentLabels.join(", ")}.`,
          );
        }
        logicalEnvironmentId = value;
        index += 1;
        continue;
      case "--mode":
        if (!value || !options.isMode(value)) {
          throw new Error(
            `[env-materialize] --mode must be one of: ${options.modeLabels.join(", ")}.`,
          );
        }
        mode = value;
        index += 1;
        continue;
      case "--targets":
        targets = EnvMaterializeKit_parseCliTargets({
          allTargetsToken: options.allTargetsToken,
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
      positiveIntegerOptionValuesByKey.set(
        additionalOption.key,
        EnvMaterializeKit_parsePositiveIntegerCliValue({
          flagName: additionalOption.flag,
          rawValue: value,
        }),
      );
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
      workspacePath: path.resolve(
        options.currentWorkingDirectory,
        workspacePath,
      ),
    },
  };
}

/** Serializes parsed CLI options into stable argv token order. */
export function EnvMaterializeKit_serializeCliOptionsToArgv<
  LogicalEnvironmentId extends string,
  Mode extends string,
  Target extends string,
>(
  options: EnvMaterializeKit_SerializeCliArgs_Options<
    LogicalEnvironmentId,
    Mode,
    Target
  >,
): string[] {
  const argv: string[] = [
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
      const value = options.positiveIntegerOptionValuesByKey.get(
        additionalOption.key,
      );
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
export function EnvMaterializeKit_collectCliAdditionalOptionValueMaps(options: {
  additionalOptions: readonly EnvMaterializeKit_CliAdditionalOption[];
  positiveIntegerOptionValuesByKey?: ReadonlyMap<string, number | undefined>;
  stringOptionValuesByKey?: ReadonlyMap<string, string | undefined>;
}): EnvMaterializeKit_CliAdditionalOptionValueMaps {
  const positiveIntegerOptionValuesByKey = new Map<string, number>();
  const stringOptionValuesByKey = new Map<string, string>();

  for (const additionalOption of options.additionalOptions) {
    if (additionalOption.kind === "positive-integer") {
      const value = options.positiveIntegerOptionValuesByKey?.get(
        additionalOption.key,
      );
      if (value !== undefined) {
        positiveIntegerOptionValuesByKey.set(additionalOption.key, value);
      }
      continue;
    }

    const value = options.stringOptionValuesByKey?.get(additionalOption.key);
    const normalizedValue =
      value === undefined
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
function EnvMaterializeKit_normalizeStringOptionValue(options: {
  currentWorkingDirectory: string;
  rawValue: string;
  valueNormalization: EnvMaterializeKit_CliStringValueNormalization;
}): string | undefined {
  if (options.valueNormalization === "resolve-path-if-nonempty") {
    return options.rawValue.length > 0
      ? path.resolve(options.currentWorkingDirectory, options.rawValue)
      : undefined;
  }

  const trimmedValue = options.rawValue.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

/** Normalizes a parsed string option value before re-serializing it. */
function EnvMaterializeKit_normalizeSerializableStringOptionValue(options: {
  value: string;
  valueNormalization: EnvMaterializeKit_CliStringValueNormalization;
}): string | undefined {
  if (options.valueNormalization === "trim-if-nonempty") {
    const trimmedValue = options.value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  return options.value.length > 0 ? options.value : undefined;
}

/** Returns true when the selected targets are exactly the configured default target set. */
function EnvMaterializeKit_isDefaultTargetSelection<Target extends string>(options: {
  defaultTargets: readonly Target[];
  targets: readonly Target[];
}): boolean {
  return (
    options.targets.length === options.defaultTargets.length &&
    options.defaultTargets.every((target) => options.targets.includes(target))
  );
}
