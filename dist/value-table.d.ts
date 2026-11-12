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
/** Inputs available to a derived source. */
export type EnvMaterializeKit_DeriveInput<Context> = {
    /** Adapter-owned context, such as a workspace path. */
    context: Context;
    /** Merged seed values. */
    seedValues: ReadonlyMap<string, string>;
    /** Values resolved by earlier rows of the table. */
    resolved: ReadonlyMap<string, string>;
};
/**
 * One way to obtain a row's value.
 *
 * @template Context - Adapter-owned context passed to derivations.
 */
export type EnvMaterializeKit_ValueSource<Context> = {
    /** Reads a seed key. */
    kind: "seed";
    /** Seed key to read. */
    key: string;
} | {
    /** Computes the value from context, seed values and earlier rows. */
    kind: "derived";
    /** Printable name of the derivation, reported as the origin. */
    label: string;
    /** Pure function returning the value, or undefined when it cannot be derived. */
    derive: (input: EnvMaterializeKit_DeriveInput<Context>) => string | undefined;
} | {
    /** Uses a fixed value. */
    kind: "default";
    /** The fixed value. */
    value: string;
};
/**
 * One output key and how to resolve it.
 *
 * @template Key - Literal union of output keys.
 * @template Context - Adapter-owned context passed to derivations.
 */
export type EnvMaterializeKit_ValueRow<Key extends string, Context> = {
    /** Output key. */
    key: Key;
    /** Sources tried in order; the first non-blank value wins. */
    sources: readonly EnvMaterializeKit_ValueSource<Context>[];
    /** Whether an unresolved value is reported in `missingRequiredKeys`. */
    required?: boolean;
    /** Whether the value is secret; callers must never print it. */
    secret?: boolean;
};
/**
 * Resolution result. It holds values, so callers print only keys and origins from it.
 *
 * @template Key - Literal union of output keys.
 */
export type EnvMaterializeKit_ValueTableResult<Key extends string> = {
    /** Resolved values for rows that produced one. */
    valuesByKey: Map<Key, string>;
    /** Origin of each resolved value: `seed:<KEY>`, `derived:<label>` or `default`. */
    originByKey: Map<Key, string>;
    /** Required rows that produced no value, in table order. */
    missingRequiredKeys: Key[];
    /** Keys of rows marked secret, resolved or not. */
    secretKeys: Set<Key>;
};
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
export declare function EnvMaterializeKit_resolveValueTable<Key extends string, Context>(options: {
    rows: readonly EnvMaterializeKit_ValueRow<Key, Context>[];
    seedValues: ReadonlyMap<string, string>;
    context: Context;
}): EnvMaterializeKit_ValueTableResult<Key>;
