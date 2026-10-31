import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";

const script = resolve("scripts/test-changes.ts");
let repo: string;
function git(...args: string[]): string {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
function file(path: string, content = "fixture\n"): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
}
function plan() {
  return spawnSync(process.execPath, [script, "--plan"], { cwd: repo, encoding: "utf8" });
}
function selection() {
  const result = plan();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout.trim().split("\n").at(-1)!) as {
    mode: string; changed: string[]; baseline: string[]; vitestArgs: string[];
  };
}
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "tenable-axi-git-"));
  git("init", "--initial-branch=main");
  file("test/packaged-cli.test.ts");
  file("src/asset.ts");
  git("add", ".");
  git("-c", "user.name=Example", "-c", "user.email=example@example.invalid", "commit", "-m", "baseline");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

test("runs affected tests for committed and working-tree changes since the merge base", () => {
  file("src/asset.ts", "export const asset = 1;\n");
  git("add", ".");
  git("-c", "user.name=Example", "-c", "user.email=example@example.invalid", "commit", "-m", "asset");
  file("src/finding.ts");
  const selected = selection();
  expect(selected.mode).toBe("affected-only");
  expect(selected.changed).toEqual(["src/asset.ts", "src/finding.ts"]);
  expect(selected.vitestArgs).toEqual(["related", "--run", "src/asset.ts", "src/finding.ts", "test/packaged-cli.test.ts"]);
});

test.each([
  "package.json", "pnpm-lock.yaml", "tsconfig.json", "tsconfig.test.json", "vitest.config.ts",
  "test/support/upstream.ts", "test/fixtures/assets.json", "scripts/isolated.ts", "specs/exposure-management.json",
  "inventory/specs.json", ".no-mistakes.yaml",
])("runs the full suite when shared validation input %s changes", (path) => {
  file(path);
  expect(selection().vitestArgs).toEqual(["run"]);
});

test("always includes the packaged CLI baseline even with no changed files", () => {
  expect(selection().vitestArgs).toEqual(["related", "--run", "test/packaged-cli.test.ts"]);
});

test("includes write-safety and redaction baselines once they exist", () => {
  file("test/write-safety.test.ts");
  file("test/redaction.test.ts");
  expect(selection().baseline).toEqual(["test/packaged-cli.test.ts", "test/write-safety.test.ts", "test/redaction.test.ts"]);
});

test("fails before validation when origin/main is unavailable", () => {
  git("update-ref", "-d", "refs/remotes/origin/main");
  const result = plan();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Cannot compute changed files");
  expect(result.stdout).not.toContain("Test mode:");
});

test("fails when the required packaged CLI baseline has been removed", () => {
  rmSync(join(repo, "test/packaged-cli.test.ts"));
  const result = plan();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Required packaged CLI baseline is missing");
});
