#!/usr/bin/env node
/** @fileoverview Standalone key-name checker; output and errors never echo argv or values. */
import { checkKeys } from "./check-keys.js";

/**
 * Execute the key checker with sanitized usage and I/O diagnostics.
 * @param argv - User arguments, never echoed on failure.
 * @returns 0 for required coverage, 1 for missing input/keys, 2 for usage/I/O errors.
 */
function main(argv: string[]): number {
  let template: string | undefined;
  let target: string | undefined;
  let json = false;
  const optional: string[] = [];
  try {
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === "--json" && !json) json = true;
      else if (arg === "--template" || arg === "--target") {
        const value = argv[++i];
        if (!value || value.startsWith("--")) throw new Error();
        if (arg === "--template" && template === undefined) template = value;
        else if (arg === "--target" && target === undefined) target = value;
        else throw new Error();
      } else if (arg === "--optional") {
        const start = optional.length;
        while (argv[i + 1] && !argv[i + 1]!.startsWith("--")) {
          const name = argv[++i]!;
          if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) throw new Error();
          optional.push(name);
        }
        if (optional.length === start) throw new Error();
      } else throw new Error();
    }
    if (!template || !target) throw new Error();
  } catch {
    console.error("Usage: env-materialize-check-keys --template <path> --target <path> [--optional NAME ...] [--json]");
    return 2;
  }
  try {
    const result = checkKeys(template, target, { optional });
    if (json) console.log(JSON.stringify(result));
    else {
      if (!result.targetExists) console.log("Target: not present");
      console.log(`Missing: ${result.missing.join(", ") || "none"}`);
      console.log(`Extra: ${result.extra.join(", ") || "none"}`);
      console.log(`Present: ${result.present.join(", ") || "none"}`);
    }
    return !result.targetExists || result.missing.length ? 1 : 0;
  } catch {
    console.error("Unable to check key names.");
    return 2;
  }
}
process.exitCode = main(process.argv.slice(2));
