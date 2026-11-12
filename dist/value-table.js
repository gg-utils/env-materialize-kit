/**
 * @fileoverview Table-driven value resolution for env materialization.
 *
 * Instead of one hand-written function per rendered key, an adapter lists rows. Each row
 * names an output key and an ordered list of sources: a seed key, a pure derivation from
 * already resolved values, or a literal default. The first source that yields a non-blank
 * value wins. Resolution is pure: it reads only its inputs and never reads or patches
 * `process.env`, so one adapter can resolve values for any workspace or machine.
 *
 * Flow: rows + seed values + adapter context -> values, origin per key, missing required keys.
 *
 * @example
 * ```typescript
 * const result = EnvMaterializeKit_resolveValueTable({
 *   context: {},
 *   seedValues: new Map([["PUBLIC_HOST", "app.example.test"]]),
 *   rows: [
 *     { key: "HOST", sources: [{ kind: "seed", key: "PUBLIC_HOST" }], required: true },
 *     { key: "ORIGIN", sources: [{ kind: "derived", label: "https-origin",
 *       derive: ({ resolved }) => `https://${resolved.get("HOST") ?? ""}` }] },
 *     { key: "PORT", sources: [{ kind: "seed", key: "PORT" }, { kind: "default", value: "3000" }] },
 *   ],
 * });
 * ```
 *
 * @testing Node test unit: npm test runs src/value-table.unit.test.ts.
 * @see src/seed-sources.ts - Produces the merged seed values this table reads.
 * @see src/managed-keys.ts - Compares and writes the resolved values into env files.
 * @see src/value-table.unit.test.ts - Tests for precedence, derivation and required keys.
 */
/**
 * Tries a row's sources in order.
 *
 * @template Context - Adapter-owned context passed to derivations.
 * @param sources - Sources of one row.
 * @param input - Context, seed values and values resolved so far.
 * @returns The first non-blank value and its origin, or null.
 */
function EnvMaterializeKit_resolveRowSources(sources, input) {
    for (const source of sources) {
        let value;
        let origin;
        if (source.kind === "seed") {
            value = input.seedValues.get(source.key);
            origin = `seed:${source.key}`;
        }
        else if (source.kind === "derived") {
            value = source.derive(input);
            origin = `derived:${source.label}`;
        }
        else {
            value = source.value;
            origin = "default";
        }
        if (typeof value === "string" && value.trim().length > 0) {
            return { value: value.trim(), origin };
        }
    }
    return null;
}
/**
 * Resolves every row of a value table in order. Later rows may derive from earlier ones.
 *
 * @template Key - Literal union of output keys.
 * @template Context - Adapter-owned context passed to derivations.
 * @param options - Rows, seed values and context.
 * @param options.rows - Rows in resolution order.
 * @param options.seedValues - Merged seed values.
 * @param options.context - Adapter-owned context.
 * @returns Values, origins, missing required keys and secret keys.
 * @throws Error when two rows share a key, because the table would be ambiguous.
 * @example
 * ```typescript
 * EnvMaterializeKit_resolveValueTable({
 *   context: null,
 *   seedValues: new Map(),
 *   rows: [{ key: "PORT", sources: [{ kind: "default", value: "3000" }] }],
 * }).valuesByKey.get("PORT"); // "3000"
 * ```
 */
export function EnvMaterializeKit_resolveValueTable(options) {
    const valuesByKey = new Map();
    const originByKey = new Map();
    const missingRequiredKeys = [];
    const secretKeys = new Set();
    const seen = new Set();
    for (const row of options.rows) {
        if (seen.has(row.key)) {
            throw new Error(`[env-materialize] Duplicate value table row: ${row.key}`);
        }
        seen.add(row.key);
        if (row.secret === true) {
            secretKeys.add(row.key);
        }
        const resolved = EnvMaterializeKit_resolveRowSources(row.sources, {
            context: options.context,
            seedValues: options.seedValues,
            resolved: valuesByKey,
        });
        if (resolved === null) {
            if (row.required === true) {
                missingRequiredKeys.push(row.key);
            }
            continue;
        }
        valuesByKey.set(row.key, resolved.value);
        originByKey.set(row.key, resolved.origin);
    }
    return { valuesByKey, originByKey, missingRequiredKeys, secretKeys };
}
