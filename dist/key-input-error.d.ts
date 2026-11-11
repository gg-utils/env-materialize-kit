/** @fileoverview Value-free error for key-name input failures; keeps the file system cause. */
/** Failure to open, read or close a dotenv file while scanning key names. */
export declare class EnvMaterializeKit_KeyInputError extends Error {
    readonly name = "EnvMaterializeKit_KeyInputError";
}
/**
 * Wrap a caught failure in an error that is safe to print.
 * A file system error is kept as `cause` and its message is appended. Any other error could
 * have been built from bytes of the file being scanned, so it is neither kept nor quoted.
 * @param action - Fixed description of the step that failed, without file content.
 * @param path - File the step worked on; paths may be shown.
 * @param error - Caught value.
 * @returns Error whose message, cause and stack never contain env values.
 */
export declare function EnvMaterializeKit_keyInputError(action: string, path: string, error: unknown): EnvMaterializeKit_KeyInputError;
