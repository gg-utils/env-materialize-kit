/**
 * @fileoverview Product-neutral file and value helpers for env materialization contexts.
 *
 * Flow: optional file inputs + scalar precedence lists + temporary environment snapshots ->
 * deterministic values for project adapters.
 *
 * @testing Node test: npm run env-materialize-kit:test
 *
 * @see packages/env-materialize-kit/src/workspace-values.unit.test.ts - Node test module that asserts optional text/JSON reads, precedence chains, mapped fallbacks, trailing path cleanup, positive-integer resolution, and temporary process.env overlays for the helpers exported from this file.
 * @see env-materialize.config.ts - Root env-materialize adapter that imports these helpers when wiring workspace seed reads, scalar resolution, path normalization, and temporary process.env snapshots for consumer target rendering.
 * @see packages/env-materialize-kit/src/index.ts - Package barrel that re-exports this module so consumers can reach the same helpers through the aggregate `@gg-utils/env-materialize-kit` entry surface.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
import fs from "node:fs";
import path from "node:path";
/** Reads a text file when it exists, trims it, and returns null for missing or blank files. */
export function EnvMaterializeKit_readOptionalTrimmedTextFile(options) {
    if (!fs.existsSync(options.filePath)) {
        return null;
    }
    const value = fs.readFileSync(options.filePath, "utf8").trim();
    return value.length > 0 ? value : null;
}
/** Reads a nested JSON string or finite number value from an optional JSON file. */
export function EnvMaterializeKit_readOptionalNestedJsonScalar(options) {
    if (!fs.existsSync(options.filePath)) {
        return null;
    }
    const payload = JSON.parse(fs.readFileSync(options.filePath, "utf8"));
    let current = payload;
    for (const field of options.fieldPath) {
        if (!EnvMaterializeKit_isRecord(current)) {
            return null;
        }
        current = current[field];
    }
    if (typeof current === "number" && Number.isFinite(current)) {
        return String(current);
    }
    return typeof current === "string" && current.trim().length > 0
        ? current.trim()
        : null;
}
/** Chooses the first non-empty trimmed string from a precedence list, then default value. */
export function EnvMaterializeKit_resolveFirstNonEmptyString(options) {
    for (const value of options.values) {
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim();
        }
    }
    if (typeof options.defaultValue === "string") {
        return options.defaultValue;
    }
    return "";
}
/** Resolves a key from direct sources first, then through a fallback-key map and source map. */
export function EnvMaterializeKit_resolveMappedFallbackValue(options) {
    const directValue = EnvMaterializeKit_resolveFirstNonEmptyString({
        values: options.directSources.map((source) => source.get(options.key)),
    });
    if (directValue.length > 0) {
        return directValue;
    }
    const fallbackKey = options.fallbackKeyByKey[options.key];
    if (fallbackKey === undefined) {
        return undefined;
    }
    const fallbackValue = options.fallbackSource.get(fallbackKey);
    if (typeof fallbackValue !== "string" || fallbackValue.trim().length === 0) {
        return undefined;
    }
    return fallbackValue.trim();
}
/** Chooses the first strictly positive integer from numeric or string candidates. */
export function EnvMaterializeKit_resolvePositiveInteger(options) {
    for (const value of options.values) {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            return value;
        }
        if (typeof value === "string" && value.trim().length > 0) {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        }
    }
    return options.defaultValue;
}
/** Removes a trailing path segment when a candidate path ends with that segment. */
export function EnvMaterializeKit_removeTrailingPathSegment(options) {
    if (path.basename(options.candidatePath) === options.segmentName) {
        return path.dirname(options.candidatePath);
    }
    return options.candidatePath;
}
/** Runs a callback while `process.env` is temporarily overlaid with caller-provided values. */
export function EnvMaterializeKit_withTemporaryProcessEnv(options) {
    const originalEnv = { ...process.env };
    for (const key of Object.keys(process.env)) {
        delete process.env[key];
    }
    Object.assign(process.env, originalEnv, options.envSnapshot);
    try {
        return options.callback();
    }
    finally {
        for (const key of Object.keys(process.env)) {
            delete process.env[key];
        }
        Object.assign(process.env, originalEnv);
    }
}
/** Returns true for JSON object records. */
function EnvMaterializeKit_isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=workspace-values.js.map