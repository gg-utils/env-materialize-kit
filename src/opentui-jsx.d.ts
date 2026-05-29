/**
 * @fileoverview Augments React JSX intrinsic elements with OpenTUI terminal widget tags (`box`,
 * `scrollbox`, `text`, `input`, `select`, `tab-select`) and their prop contracts for
 * `@gg-utils/env-materialize-kit` OpenTUI wizards.
 *
 * This file owns ambient JSX augmentation on the global namespace plus `react` and
 * `react/jsx-runtime` so package TSX matches the OpenTUI host without importing launcher scripts.
 * Flow: OpenTUI TSX -> intrinsic tag names -> narrowed props aligned with `opentui-wizard-model`
 * option shapes and container layout fields.
 *
 * @example
 * ```typescript
 * import type { ReactElement } from "react";
 *
 * const sampleOptions = [
 *   { name: "Local", value: "local", description: "Materialize local env files" },
 * ] as const;
 *
 * export function EnvMaterializeKit_OpenTuiSampleRoot(): ReactElement {
 *   return (
 *     <box style={{ flexDirection: "column", gap: 1 }}>
 *       <text>Env materialize</text>
 *       <select options={sampleOptions} onChange={() => {}} showDescription />
 *     </box>
 *   );
 * }
 * ```
 *
 * @testing CLI: cd packages/env-materialize-kit && npm run type-check
 *
 * @see packages/env-materialize-kit/src/opentui-app.tsx - OpenTUI env wizard renderer whose TSX consumes these intrinsic elements for layout, inputs, and option lists.
 * @see packages/env-materialize-kit/src/opentui-wizard-model.ts - Wizard option and route helpers whose `EnvMaterializeKit_OpenTuiSelectOption` shape is mirrored by `select` and `tab-select` props here.
 * @see docs/TYPESCRIPT_STANDARDS_DOCUMENTATION_FILE_OVERVIEWS.md - Repository file-overview standard this declaration module follows for audits and agent orientation.
 * @documentation reviewed=2026-05-23 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import type { Key, ReactNode } from "react";
import type { EnvMaterializeKit_OpenTuiSelectOption } from "./opentui-wizard-model.js";

type EnvMaterializeKit_OpenTuiFlexDirection = "column" | "row";

type EnvMaterializeKit_OpenTuiStyle = {
  flexDirection?: EnvMaterializeKit_OpenTuiFlexDirection;
  flexGrow?: number;
  gap?: number;
  maxHeight?: number;
  padding?: number;
};

type EnvMaterializeKit_OpenTuiContainerProps = {
  children?: ReactNode;
  key?: Key;
  style?: EnvMaterializeKit_OpenTuiStyle;
};

type EnvMaterializeKit_OpenTuiTextProps = {
  children?: ReactNode;
  key?: Key;
};

type EnvMaterializeKit_OpenTuiInputProps = {
  key?: Key;
  onChange?: (value: string) => void;
  placeholder?: string;
  value?: string;
};

type EnvMaterializeKit_OpenTuiSelectProps = {
  key?: Key;
  onChange?: (
    index: number,
    option: EnvMaterializeKit_OpenTuiSelectOption | undefined,
  ) => void;
  options: readonly EnvMaterializeKit_OpenTuiSelectOption[];
  selectedIndex?: number;
  showDescription?: boolean;
};

type EnvMaterializeKit_OpenTuiTabSelectProps = {
  key?: Key;
  onSelect?: (
    index: number,
    option: EnvMaterializeKit_OpenTuiSelectOption | undefined,
  ) => void;
  options: readonly EnvMaterializeKit_OpenTuiSelectOption[];
  showDescription?: boolean;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      box: EnvMaterializeKit_OpenTuiContainerProps;
      input: EnvMaterializeKit_OpenTuiInputProps;
      scrollbox: EnvMaterializeKit_OpenTuiContainerProps;
      select: EnvMaterializeKit_OpenTuiSelectProps;
      text: EnvMaterializeKit_OpenTuiTextProps;
      "tab-select": EnvMaterializeKit_OpenTuiTabSelectProps;
    }
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      box: EnvMaterializeKit_OpenTuiContainerProps;
      input: EnvMaterializeKit_OpenTuiInputProps;
      scrollbox: EnvMaterializeKit_OpenTuiContainerProps;
      select: EnvMaterializeKit_OpenTuiSelectProps;
      text: EnvMaterializeKit_OpenTuiTextProps;
      "tab-select": EnvMaterializeKit_OpenTuiTabSelectProps;
    }
  }
}

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      box: EnvMaterializeKit_OpenTuiContainerProps;
      input: EnvMaterializeKit_OpenTuiInputProps;
      scrollbox: EnvMaterializeKit_OpenTuiContainerProps;
      select: EnvMaterializeKit_OpenTuiSelectProps;
      text: EnvMaterializeKit_OpenTuiTextProps;
      "tab-select": EnvMaterializeKit_OpenTuiTabSelectProps;
    }
  }
}

export {};
