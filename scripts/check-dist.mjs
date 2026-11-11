import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const temp = mkdtempSync(join(tmpdir(), "check-dist-"));
try {
  cpSync("dist", join(temp, "dist"), { recursive: true });
  rmSync("dist", { recursive: true });
  const build = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
  if (build.status !== 0) process.exitCode = 1;
  else {
    const diff = spawnSync("git", ["diff", "--no-index", "--exit-code", join(temp, "dist"), "dist"], { stdio: "inherit" });
    process.exitCode = diff.status === 0 ? 0 : 1;
  }
} finally { rmSync(temp, { recursive: true, force: true }); }
