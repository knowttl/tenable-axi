import { spawnSync } from "node:child_process";
import { mkdtempSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { decode } from "@toon-format/toon";
import { afterAll, beforeAll, expect, test } from "vitest";

let directory: string;
let entry: string;
let version: string;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "tenable-axi-package-"));
  const packed = spawnSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", directory], { encoding: "utf8" });
  expect(packed.status, packed.stderr).toBe(0);
  const [metadata] = JSON.parse(packed.stdout) as { filename: string; version: string }[];
  version = metadata!.version;
  const extracted = spawnSync("tar", ["-xzf", join(directory, metadata!.filename), "-C", directory], { encoding: "utf8" });
  expect(extracted.status, extracted.stderr).toBe(0);
  symlinkSync(resolve("node_modules"), join(directory, "package/node_modules"), "junction");
  entry = join(directory, "package/bin/tenable-axi.js");
}, 30_000);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

function cli(...args: string[]) {
  return spawnSync(process.execPath, [entry, ...args], { encoding: "utf8", cwd: directory, timeout: 10_000 });
}

test("packaged version aliases work without the command graph", () => {
  const graph = join(directory, "package/dist");
  renameSync(graph, `${graph}.hidden`);
  try {
    for (const flag of ["--version", "-v", "-V"]) {
      const result = cli(flag);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe(`${version}\n`);
      expect(result.stderr).toBe("");
    }
  } finally {
    renameSync(`${graph}.hidden`, graph);
  }
});

test("packaged help describes only executable scaffold commands offline", () => {
  const result = cli("--help");
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  expect(decode(result.stdout)).toMatchObject({ commands: { home: "Show scaffold status without contacting Tenable" } });
});

test.each([["asset", "list"], ["home", "--unknown"], ["home", "--help", "--help"]])(
  "rejects unsupported invocation %j with actionable usage output", (...args) => {
    const result = cli(...args);
    expect(result.status).toBe(2);
    expect(decode(result.stdout)).toMatchObject({ error: expect.anything() });
    expect(result.stdout).toContain("Valid command: home; valid flag: --help");
    expect(result.stderr).toBe("");
  },
);

test("version startup stays close to the same-machine Node startup floor", () => {
  const floor: number[] = [];
  const versionTimes: number[] = [];
  for (let index = 0; index < 7; index++) {
    let start = performance.now();
    const node = spawnSync(process.execPath, ["-e", "console.log(1)"], { encoding: "utf8" });
    floor.push(performance.now() - start);
    expect(node.status).toBe(0);
    start = performance.now();
    const result = cli("--version");
    versionTimes.push(performance.now() - start);
    expect(result.stdout).toBe(`${version}\n`);
    expect(result.status).toBe(0);
  }
  const median = (values: number[]) => values.sort((a, b) => a - b)[3]!;
  expect(median(versionTimes) / median(floor)).toBeLessThan(4);
});
