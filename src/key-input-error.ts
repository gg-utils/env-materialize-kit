/** @fileoverview Value-free error for key-name input failures; keeps the file system cause. */

/** Fixed text used when the underlying failure cannot be shown. */
const withheld = "details withheld because the failure did not come from the file system";

/** Failure to open, read or close a dotenv file while scanning key names. */
export class EnvMaterializeKit_KeyInputError extends Error {
  override readonly name = "EnvMaterializeKit_KeyInputError";
}

/**
 * Decide whether an error is a Node file system error.
 * Node builds the message of such an error from the error code, the system call and the
 * path only, so it cannot hold file content.
 * @param error - Caught value.
 * @returns True when the error carries a system error code and system call name.
 */
function isFileSystemError(error: unknown): error is Error {
  return error instanceof Error &&
    "code" in error && typeof error.code === "string" && /^E[A-Z0-9]+$/.test(error.code) &&
    "syscall" in error && typeof error.syscall === "string";
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
export function EnvMaterializeKit_keyInputError(action: string, path: string, error: unknown): EnvMaterializeKit_KeyInputError {
  return isFileSystemError(error)
    ? new EnvMaterializeKit_KeyInputError(`${action} ${path}: ${error.message}`, { cause: error })
    : new EnvMaterializeKit_KeyInputError(`${action} ${path}: ${withheld}`);
}
