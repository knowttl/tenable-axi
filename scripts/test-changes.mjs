import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(`Cannot compute changed files: git ${args.join(" ")} failed`);
  return result.stdout;
}

try {
  const base = git(["merge-base", "origin/main", "HEAD"]).trim();
  if (!base) throw new Error("Cannot compute changed files: merge base is empty");
  const changed = [...new Set([
    ...git(["diff", "--name-only", "-z", base, "--"]).split("\0"),
    ...git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0"),
  ].filter(Boolean))];
  const baseline = ["test/packaged-cli.test.ts", "test/write-safety.test.ts", "test/redaction.test.ts"].filter(existsSync);
  if (!baseline.includes("test/packaged-cli.test.ts")) throw new Error("Required packaged CLI baseline is missing");
  const full = changed.some((path) => /^(package\.json|pnpm-lock\.yaml|tsconfig[^/]*\.json|vitest\.config\.[^/]+|\.no-mistakes\.yaml)$/.test(path)
    || /^(scripts\/|specs\/|test\/(support|fixtures)\/)/.test(path) || path === "inventory/specs.json");
  const vitestArgs = full ? ["run"] : ["related", "--run", ...new Set([...changed, ...baseline])];
  console.log(`Test mode: ${full ? "full-suite" : "affected-only"}; baseline: ${baseline.join(", ")}`);
  // The plan is an executable diagnostic interface used by the temporary-repository tests.
  if (process.argv.includes("--plan")) console.log(JSON.stringify({ mode: full ? "full-suite" : "affected-only", changed, baseline, vitestArgs }));
  else {
    const root = new URL("../", import.meta.url);
    const guard = fileURLToPath(new URL("../test/support/deny-network.mjs", import.meta.url));
    const steps = [
      ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"],
      ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"],
      ["node_modules/vitest/vitest.mjs", ...vitestArgs],
    ];
    for (const [entry, ...args] of steps) {
      const test = entry.includes("vitest");
      const result = spawnSync(process.execPath, [fileURLToPath(new URL(entry, root)), ...args], {
        stdio: "inherit",
        env: { ...process.env, ...(test ? { NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${guard}`.trim() } : {}) },
      });
      if (result.error) throw result.error;
      if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
