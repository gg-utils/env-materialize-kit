/** @fileoverview Read-only key coverage checks using the value-discarding core scanner. */
import { openSync, readSync, closeSync } from "node:fs";
import { EnvMaterialize_parseKeyNames } from "@gg-utils/env-materialize-core/key-names";
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
 * Scan a file with fixed, path-free I/O errors.
 * @param path - File to open; never interpolated into errors.
 * @param allowAbsent - Whether a missing file returns null.
 * @returns Sorted key names, or null for an allowed absent file.
 * @throws Error with a fixed message for any other I/O failure.
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
        throw new Error("Unable to read key names.");
    }
    finally {
        if (descriptor !== undefined) {
            try {
                closeSync(descriptor);
            }
            catch {
                throw new Error("Unable to close key input.");
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
 * @throws Error with a fixed message on I/O errors other than an absent target.
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
