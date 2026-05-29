/**
 * @fileoverview Barrel that re-exports the curated `@gg-utils/env-materialize-kit` public surface—CLI argv
 * and runner helpers, UI launchers, modes/targets, and filesystem write helpers—for consumer env
 * materialize scripts and other workspace adapters.
 *
 * This file owns only the aggregated export map; implementations live in sibling
 * `packages/env-materialize-kit/src/*.ts` modules referenced by `package.json` exports.
 *
 * @example
 * ```typescript
 * import {
 *   EnvMaterializeKit_isMode,
 *   EnvMaterializeKit_modes,
 *   type EnvMaterializeKit_Mode,
 * } from "@gg-utils/env-materialize-kit";
 * ```
 *
 * @testing Node native test (tsx): npm run env-materialize-kit:test
 * @testing TypeScript compiler: npm run env-materialize-kit:type-check
 *
 * @see scripts/env-materialize/contracts.ts - Root env-materialize script contracts that import modes, targets, and target-file definitions through this barrel instead of deep subpath imports.
 * @see packages/env-materialize-kit/package.json - Export map that pairs each `@gg-utils/env-materialize-kit` entrypoint with the implementation module aggregated by this index.
 * @see packages/env-materialize-core/src/index.ts - Core env-document primitives that kit modules compose before this barrel exposes the full kit surface to callers.
 *
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */
export * from "./format-results.js";
export * from "./interactive-menu.js";
export * from "./ink-wizard-model.js";
export * from "./ink-app.js";
export * from "./cli-args.js";
export * from "./cli-runner.js";
export * from "./command-preview.js";
export * from "./key-projections.js";
export * from "./modes.js";
export * from "./opentui-wizard-model.js";
export * from "./opentui-app.js";
export * from "./package-render-values.js";
export * from "./seed-files.js";
export * from "./target-files.js";
export * from "./target-runner.js";
export * from "./ui-helpers.js";
export * from "./ui-launcher.js";
export * from "./workspace-values.js";
export * from "./write-target-file.js";
//# sourceMappingURL=index.d.ts.map