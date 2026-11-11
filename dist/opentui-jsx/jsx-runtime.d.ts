/** Local JSX runtime for OpenTUI terminal tags, isolated from React DOM intrinsic elements. */
import type { Key, ReactNode, ReactElement } from "react";
import type { EnvMaterializeKit_OpenTuiSelectOption } from "../opentui-wizard-model.js";
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
    onChange?: (index: number, option: EnvMaterializeKit_OpenTuiSelectOption | undefined) => void;
    options: readonly EnvMaterializeKit_OpenTuiSelectOption[];
    selectedIndex?: number;
    showDescription?: boolean;
};
type EnvMaterializeKit_OpenTuiTabSelectProps = {
    key?: Key;
    onSelect?: (index: number, option: EnvMaterializeKit_OpenTuiSelectOption | undefined) => void;
    options: readonly EnvMaterializeKit_OpenTuiSelectOption[];
    showDescription?: boolean;
};
export { jsx, jsxs, Fragment } from "react/jsx-runtime";
export declare namespace JSX {
    type Element = ReactElement;
    interface ElementChildrenAttribute {
        children: unknown;
    }
    interface IntrinsicElements {
        box: EnvMaterializeKit_OpenTuiContainerProps;
        input: EnvMaterializeKit_OpenTuiInputProps;
        scrollbox: EnvMaterializeKit_OpenTuiContainerProps;
        select: EnvMaterializeKit_OpenTuiSelectProps;
        text: EnvMaterializeKit_OpenTuiTextProps;
        "tab-select": EnvMaterializeKit_OpenTuiTabSelectProps;
    }
}
