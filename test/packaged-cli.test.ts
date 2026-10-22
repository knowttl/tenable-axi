import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

test("packaged help describes executable commands offline", () => {
  const result = cli("--help");
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  expect(decode(result.stdout)).toMatchObject({ commands: { home: "Show profile state and up to five live exposure cards", "card list": "List exposure view cards" } });
});

test("packaged unconfigured home provides setup guidance offline", () => {
  const result = cli("home");
  expect(result.status, result.stderr).toBe(0);
  expect(decode(result.stdout)).toMatchObject({ status: "not configured", bin: expect.stringContaining("tenable-axi.js"), help: expect.arrayContaining([expect.stringContaining("config path")]) });
  expect(result.stderr).toBe("");
});

test("packaged credentials report sources locally and ship the host schema", () => {
  const config = join(directory, "credentials-config.json");
  writeFileSync(config, JSON.stringify({ version: 1, profiles: { example: {} } }), { mode: 0o600 });
  const result = spawnSync(process.execPath, [entry, "auth", "status", "--config", config, "--profile", "example"], {
    encoding: "utf8", cwd: directory, timeout: 10_000,
    env: { ...process.env, HOME: directory, XDG_CONFIG_HOME: directory, XDG_STATE_HOME: directory,
      TENABLE_AXI_ACCESS_KEY: "synthetic-packaged-access", TENABLE_AXI_SECRET_KEY: "synthetic-packaged-secret" },
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  expect(decode(result.stdout)).toMatchObject({ profile: "example", accessKey: { env: "TENABLE_AXI_ACCESS_KEY" }, secretKey: { env: "TENABLE_AXI_SECRET_KEY" }, readOnly: true });
  expect(result.stdout).not.toContain("synthetic-packaged");
  const schema = JSON.parse(readFileSync(join(directory, "package/axi-credential.schema.json"), "utf8"));
  expect(schema.properties).toMatchObject({ accessKey: { "x-secret": true }, secretKey: { "x-secret": true } });
});

test.each([["asset", "list"], ["home", "--unknown"], ["home", "--help", "--help"]])(
  "rejects unsupported invocation %j with actionable usage output", (...args) => {
    const result = cli(...args);
    expect(result.status).toBe(2);
    expect(decode(result.stdout)).toMatchObject({ error: expect.anything() });
    expect(result.stdout).toMatch(/Valid (commands|flags)/);
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
