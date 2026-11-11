/** Comparison policy; patterns match extra names only. */
export interface CheckKeysOptions {
    /** Template names which may be absent from the target. */
    optional?: readonly string[];
    /** Exact names or regular expressions excluded from extra names. */
    ignoreExtra?: readonly (string | RegExp)[];
}
/** Names only; present includes optional names found in both files. */
export interface CheckKeysResult {
    /** False only when the target does not exist. */
    targetExists: boolean;
    /** Required template names absent from the target, sorted. */
    missing: string[];
    /** Target names absent from the template and not ignored, sorted. */
    extra: string[];
    /** Names shared by both files, sorted. */
    present: string[];
}
/**
 * Compare dotenv key names without storing value text or writing either file.
 * Extra names are informational and do not determine CLI failure.
 * @param templatePath - Required dotenv template file.
 * @param targetPath - Local dotenv target file, which may be absent.
 * @param options - Optional names and exclusions for extra names.
 * @returns Sorted name arrays and target existence; never values or paths.
 * @throws EnvMaterializeKit_KeyInputError on I/O errors other than an absent target. Its message
 * names the path and the file system error, which is kept as `cause`; it never holds values.
 */
export declare function checkKeys(templatePath: string, targetPath: string, options?: CheckKeysOptions): CheckKeysResult;
