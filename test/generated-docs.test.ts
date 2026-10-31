import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

test("documentation check detects stale release artifacts and regeneration repairs them", () => {
  const directory = mkdtempSync(join(tmpdir(), "tenable-axi-docs-"));
  try {
    mkdirSync(join(directory, "scripts"));
    cpSync("scripts/generate-docs.ts", join(directory, "scripts/generate-docs.ts"));
    cpSync("README.md", join(directory, "README.md"));
    cpSync("docs", join(directory, "docs"), { recursive: true });
    cpSync("skills", join(directory, "skills"), { recursive: true });
    symlinkSync(resolve("dist"), join(directory, "dist"), "junction");
    const run = (...args: string[]) => spawnSync(process.execPath, [join(directory, "scripts/generate-docs.ts"), ...args], { encoding: "utf8" });
    expect(run("--check").status).toBe(0);
    writeFileSync(join(directory, "docs/commands.md"), "outdated reference\n");
    writeFileSync(join(directory, "skills/tenable-axi/SKILL.md"), "outdated skill\n");
    const stale = run("--check");
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("docs/commands.md");
    expect(stale.stderr).toContain("skills/tenable-axi/SKILL.md");
    expect(run().status).toBe(0);
    expect(run("--check").status).toBe(0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
