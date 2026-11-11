/** @fileoverview Read-only key coverage checks using the value-discarding core scanner. */
import { openSync, readSync, closeSync } from "node:fs";
import { EnvMaterialize_parseKeyNames } from "@gg-utils/env-materialize-core/key-names";
import { EnvMaterializeKit_keyInputError } from "./key-input-error.js";
/**
 * Yield one byte at a time, overwriting the buffer immediately after each read.
 * @param descriptor - Open read-only descriptor owned by the caller.
 * @yields Current byte; no value text is constructed or retained.
 */
function* bytes(descriptor) {
    const buffer = Buffer.alloc(1);
    try {
        while (readSync(descriptor, buffer, 0, 1, null)) {
            const byte = buffer[0];
            buffer[0] = 0;
            yield byte;
        }
    }
    finally {
        buffer.fill(0);
    }
}
/**
 * Scan a file; I/O errors name the path and the file system cause, never file content.
 * @param path - File to open; shown in errors.
 * @param allowAbsent - Whether a missing file returns null.
 * @returns Sorted key names, or null for an allowed absent file.
 * @throws EnvMaterializeKit_KeyInputError for any other I/O failure, with the file system
 * error as `cause`.
 */
function readNames(path, allowAbsent) {
    let descriptor;
    try {
        descriptor = openSync(path, "r");
        return EnvMaterialize_parseKeyNames(bytes(descriptor));
    }
    catch (error) {
        if (descriptor === undefined && allowAbsent && error instanceof Error &&
            "code" in error && error.code === "ENOENT")
            return null;
        throw EnvMaterializeKit_keyInputError("Unable to read key names from", path, error);
    }
    finally {
        if (descriptor !== undefined) {
            try {
                closeSync(descriptor);
            }
            catch (error) {
                throw EnvMaterializeKit_keyInputError("Unable to close key input", path, error);
            }
        }
    }
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
export function checkKeys(templatePath, targetPath, options = {}) {
    const template = readNames(templatePath, false);
    const target = readNames(targetPath, true);
    const expected = new Set(template);
    const actual = new Set(target ?? []);
    const optional = new Set(options.optional);
    return {
        targetExists: target !== null,
        missing: template.filter(name => !actual.has(name) && !optional.has(name)),
        extra: [...actual].filter(name => !expected.has(name) && !options.ignoreExtra?.some(rule => typeof rule === "string" ? rule === name : new RegExp(rule.source, rule.flags).test(name))),
        present: template.filter(name => actual.has(name)),
    };
}
