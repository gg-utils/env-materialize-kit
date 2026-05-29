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
/** String option value normalization applied after a flag consumes its next argv token. */
export type EnvMaterializeKit_CliStringValueNormalization = "resolve-path-if-nonempty" | "trim-if-nonempty";
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
export type EnvMaterializeKit_CliAdditionalOption = EnvMaterializeKit_CliAdditionalStringOption | EnvMaterializeKit_CliAdditionalPositiveIntegerOption;
/** Options for parsing a project-specific env-materialize CLI invocation. */
export type EnvMaterializeKit_ParseCliArgs_Options<LogicalEnvironmentId extends string, Mode extends string, Target extends string> = {
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
export type EnvMaterializeKit_ParsedCliArgs<LogicalEnvironmentId extends string, Mode extends string, Target extends string> = {
    logicalEnvironmentId: LogicalEnvironmentId;
    mode: Mode;
    positiveIntegerOptionValuesByKey: Map<string, number>;
    stringOptionValuesByKey: Map<string, string>;
    targets: Target[];
    workspacePath: string;
};
/** Discriminated parser result so project adapters can own help text and exit policy. */
export type EnvMaterializeKit_ParseCliArgs_Result<LogicalEnvironmentId extends string, Mode extends string, Target extends string> = {
    kind: "help";
} | {
    kind: "parsed";
    options: EnvMaterializeKit_ParsedCliArgs<LogicalEnvironmentId, Mode, Target>;
};
/** Options for serializing a parsed env-materialize CLI invocation. */
export type EnvMaterializeKit_SerializeCliArgs_Options<LogicalEnvironmentId extends string, Mode extends string, Target extends string> = {
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
export declare function EnvMaterializeKit_parsePositiveIntegerCliValue(options: {
    flagName: string;
    rawValue: string;
}): number;
/** Expands a comma-separated target token list into validated target ids. */
export declare function EnvMaterializeKit_parseCliTargets<Target extends string>(options: {
    allTargetsToken?: string;
    defaultTargets: readonly Target[];
    isTarget: (value: string) => value is Target;
    rawValue: string;
}): Target[];
/** Parses the reusable env-materialize argv contract and project-owned additional flags. */
export declare function EnvMaterializeKit_parseCliArgs<LogicalEnvironmentId extends string, Mode extends string, Target extends string>(options: EnvMaterializeKit_ParseCliArgs_Options<LogicalEnvironmentId, Mode, Target>): EnvMaterializeKit_ParseCliArgs_Result<LogicalEnvironmentId, Mode, Target>;
/** Serializes parsed CLI options into stable argv token order. */
export declare function EnvMaterializeKit_serializeCliOptionsToArgv<LogicalEnvironmentId extends string, Mode extends string, Target extends string>(options: EnvMaterializeKit_SerializeCliArgs_Options<LogicalEnvironmentId, Mode, Target>): string[];
/** Collects defined additional option values into the maps consumed by argv serialization. */
export declare function EnvMaterializeKit_collectCliAdditionalOptionValueMaps(options: {
    additionalOptions: readonly EnvMaterializeKit_CliAdditionalOption[];
    positiveIntegerOptionValuesByKey?: ReadonlyMap<string, number | undefined>;
    stringOptionValuesByKey?: ReadonlyMap<string, string | undefined>;
}): EnvMaterializeKit_CliAdditionalOptionValueMaps;
//# sourceMappingURL=cli-args.d.ts.map