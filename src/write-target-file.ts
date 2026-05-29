/**
 * @fileoverview Reusable write-mode engine for managed env target files.
 *
 * Flow: desired env text + current file + reference template + explicit sync policy -> stable
 * target mutation result.
 *
 * @testing Node test unit: npm run test --prefix packages/env-materialize-kit from repository root runs the tsx-backed Node harness including EnvMaterializeKit_writeTargetFile merge and mode assertions in target-files.unit.test.ts.
 *
 * @see packages/env-materialize-core/src/env-document.ts - Parse, read, render, and normalize helpers this writer calls when diffing, merging desired keys into the on-disk document, and serializing the next env file body.
 * @see packages/env-materialize-kit/src/modes.ts - Mode literals (`check`, `create-if-missing`, `restore-defaults`, `sync-missing-or-blank`) that branch filesystem side effects, drift detection, and merge-vs-replace behavior inside EnvMaterializeKit_writeTargetFile.
 * @see packages/env-materialize-kit/src/target-runner.ts - Target orchestration layer that invokes the injected writeTargetFile callback so bulk kit runs apply consistent per-path mutation semantics.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";

import {
  EnvMaterialize_normalizeRenderedContent,
  EnvMaterialize_parseEnvDocument,
  EnvMaterialize_readEnvDocument,
  EnvMaterialize_renderDocument,
  type EnvMaterialize_ParsedEnvDocument,
} from "@gg-utils/env-materialize-core/env-document";

import type { EnvMaterializeKit_Mode } from "./modes.js";

/** Terminal status for a single env file write attempt. */
export type EnvMaterializeKit_TargetMutationResultStatus =
  | "created"
  | "drift"
  | "missing"
  | "skipped-existing"
  | "synced"
  | "unchanged"
  | "updated";

/** Outcome of applying a write mode to one target env path. */
export type EnvMaterializeKit_TargetMutationResult = {
  changed: boolean;
  filePath: string;
  status: EnvMaterializeKit_TargetMutationResultStatus;
};

/** Explicit sync policy supplied by a project-owned config/adapter. */
export type EnvMaterializeKit_WriteSyncPolicy = {
  managedUrlKeys: readonly string[];
  placeholderExactValues: readonly string[];
  placeholderSubstrings: readonly string[];
};

/** Inputs for applying one env-materialize write mode to a single on-disk target path. */
export type EnvMaterializeKit_WriteTargetFileOptions = {
  desiredContent: string;
  filePath: string;
  mode: EnvMaterializeKit_Mode;
  referenceFilePath: string;
  syncPolicy: EnvMaterializeKit_WriteSyncPolicy;
};

type EnvMaterializeKit_NormalizedWriteSyncPolicy = {
  managedUrlKeys: ReadonlySet<string>;
  placeholderExactValues: ReadonlySet<string>;
  placeholderSubstrings: readonly string[];
};

/** Ensures the parent directory of a file path exists before writing. */
function EnvMaterializeKit_ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  });
}

/** Normalizes config-provided write policy values for repeated sync decisions. */
function EnvMaterializeKit_normalizeWriteSyncPolicy(
  policy: EnvMaterializeKit_WriteSyncPolicy,
): EnvMaterializeKit_NormalizedWriteSyncPolicy {
  return {
    managedUrlKeys: new Set(policy.managedUrlKeys),
    placeholderExactValues: new Set(
      policy.placeholderExactValues.map((value) => value.trim().toLowerCase()),
    ),
    placeholderSubstrings: policy.placeholderSubstrings.map((value) =>
      value.trim().toLowerCase(),
    ),
  };
}

/** Checks whether a value looks like an unconfigured placeholder. */
function EnvMaterializeKit_isPlaceholderValue(options: {
  syncPolicy: EnvMaterializeKit_NormalizedWriteSyncPolicy;
  value: string;
}): boolean {
  const normalizedValue = options.value.trim().toLowerCase();
  if (normalizedValue.length === 0) {
    return false;
  }
  if (options.syncPolicy.placeholderExactValues.has(normalizedValue)) {
    return true;
  }

  return options.syncPolicy.placeholderSubstrings.some((candidate) =>
    normalizedValue.includes(candidate),
  );
}

/** Checks whether the current value matches the reference template default. */
function EnvMaterializeKit_isTemplateDefaultValue(options: {
  currentValue: string;
  key: string;
  referenceDocument: EnvMaterialize_ParsedEnvDocument;
}): boolean {
  const referenceValue = options.referenceDocument.valuesByKey.get(options.key);
  if (typeof referenceValue !== "string") {
    return false;
  }

  return options.currentValue.trim() === referenceValue.trim();
}

/** Parses a comma-separated list of URL strings. */
function EnvMaterializeKit_parseUrlList(value: string): URL[] | null {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (entries.length === 0) {
    return null;
  }

  const parsedEntries: URL[] = [];
  for (const entry of entries) {
    if (!URL.canParse(entry)) {
      return null;
    }
    parsedEntries.push(new URL(entry));
  }

  return parsedEntries;
}

/** Returns true if the URL hostname resolves to loopback. */
function EnvMaterializeKit_isLoopbackUrl(url: URL): boolean {
  const hostname = url.hostname.trim().toLowerCase();
  return hostname === "127.0.0.1" || hostname === "localhost";
}

/** Detects when a managed URL key can move from loopback to a non-loopback desired value. */
function EnvMaterializeKit_isLoopbackManagedUrlValue(options: {
  currentValue: string;
  desiredValue: string;
  key: string;
  syncPolicy: EnvMaterializeKit_NormalizedWriteSyncPolicy;
}): boolean {
  if (!options.syncPolicy.managedUrlKeys.has(options.key)) {
    return false;
  }

  const currentUrls = EnvMaterializeKit_parseUrlList(options.currentValue);
  if (!currentUrls || !currentUrls.every(EnvMaterializeKit_isLoopbackUrl)) {
    return false;
  }

  const desiredUrls = EnvMaterializeKit_parseUrlList(options.desiredValue);
  if (!desiredUrls) {
    return false;
  }

  return desiredUrls.some((url) => !EnvMaterializeKit_isLoopbackUrl(url));
}

/** Determines whether the current value of a key should be replaced during sync. */
function EnvMaterializeKit_shouldReplaceCurrentValue(options: {
  currentValue: string | undefined;
  desiredValue: string;
  key: string;
  referenceDocument: EnvMaterialize_ParsedEnvDocument;
  syncPolicy: EnvMaterializeKit_NormalizedWriteSyncPolicy;
}): boolean {
  if (typeof options.currentValue !== "string") {
    return true;
  }
  if (options.currentValue.trim().length === 0) {
    return true;
  }
  if (
    EnvMaterializeKit_isPlaceholderValue({
      syncPolicy: options.syncPolicy,
      value: options.currentValue,
    })
  ) {
    return true;
  }
  if (
    EnvMaterializeKit_isTemplateDefaultValue({
      currentValue: options.currentValue,
      key: options.key,
      referenceDocument: options.referenceDocument,
    })
  ) {
    return true;
  }
  return EnvMaterializeKit_isLoopbackManagedUrlValue({
    currentValue: options.currentValue,
    desiredValue: options.desiredValue,
    key: options.key,
    syncPolicy: options.syncPolicy,
  });
}

/** Applies env-materialize write-mode semantics to one on-disk env file. */
export function EnvMaterializeKit_writeTargetFile(
  options: EnvMaterializeKit_WriteTargetFileOptions,
): EnvMaterializeKit_TargetMutationResult {
  const desiredContent = EnvMaterialize_normalizeRenderedContent(
    options.desiredContent,
  );
  const desiredDocument = EnvMaterialize_parseEnvDocument(desiredContent);
  const fileExists = fs.existsSync(options.filePath);

  if (options.mode === "check") {
    if (!fileExists) {
      return {
        changed: false,
        filePath: options.filePath,
        status: "missing",
      };
    }
    const currentContent = EnvMaterialize_normalizeRenderedContent(
      fs.readFileSync(options.filePath, "utf8"),
    );
    return {
      changed: false,
      filePath: options.filePath,
      status: currentContent === desiredContent ? "unchanged" : "drift",
    };
  }

  if (options.mode === "create-if-missing") {
    if (fileExists) {
      return {
        changed: false,
        filePath: options.filePath,
        status: "skipped-existing",
      };
    }

    EnvMaterializeKit_ensureParentDir(options.filePath);
    fs.writeFileSync(options.filePath, desiredContent, "utf8");
    return {
      changed: true,
      filePath: options.filePath,
      status: "created",
    };
  }

  if (options.mode === "restore-defaults") {
    if (fileExists) {
      const currentContent = EnvMaterialize_normalizeRenderedContent(
        fs.readFileSync(options.filePath, "utf8"),
      );
      if (currentContent === desiredContent) {
        return {
          changed: false,
          filePath: options.filePath,
          status: "unchanged",
        };
      }
    }

    EnvMaterializeKit_ensureParentDir(options.filePath);
    fs.writeFileSync(options.filePath, desiredContent, "utf8");
    return {
      changed: true,
      filePath: options.filePath,
      status: fileExists ? "updated" : "created",
    };
  }

  if (!fileExists) {
    EnvMaterializeKit_ensureParentDir(options.filePath);
    fs.writeFileSync(options.filePath, desiredContent, "utf8");
    return {
      changed: true,
      filePath: options.filePath,
      status: "created",
    };
  }

  const currentDocument = EnvMaterialize_readEnvDocument(options.filePath);
  const referenceDocument = EnvMaterialize_readEnvDocument(
    options.referenceFilePath,
  );
  const mergedValuesByKey = new Map<string, string>(
    currentDocument.valuesByKey,
  );
  const normalizedSyncPolicy = EnvMaterializeKit_normalizeWriteSyncPolicy(
    options.syncPolicy,
  );

  for (const [key, desiredValue] of desiredDocument.valuesByKey.entries()) {
    const currentValue = currentDocument.valuesByKey.get(key);
    if (
      !EnvMaterializeKit_shouldReplaceCurrentValue({
        currentValue,
        desiredValue,
        key,
        referenceDocument,
        syncPolicy: normalizedSyncPolicy,
      })
    ) {
      continue;
    }
    mergedValuesByKey.set(key, desiredValue);
  }

  const nextContent = EnvMaterialize_renderDocument({
    document: currentDocument,
    valuesByKey: mergedValuesByKey,
  });
  const normalizedCurrentContent = EnvMaterialize_normalizeRenderedContent(
    fs.readFileSync(options.filePath, "utf8"),
  );
  const normalizedNextContent =
    EnvMaterialize_normalizeRenderedContent(nextContent);

  if (normalizedCurrentContent === normalizedNextContent) {
    return {
      changed: false,
      filePath: options.filePath,
      status: "unchanged",
    };
  }

  fs.writeFileSync(options.filePath, normalizedNextContent, "utf8");
  return {
    changed: true,
    filePath: options.filePath,
    status: "synced",
  };
}
