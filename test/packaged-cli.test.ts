import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { decode } from "@toon-format/toon";
import { afterAll, beforeAll, expect, test } from "vitest";
import { fakeHttpsTenable, syntheticKeys } from "./support/fake-tenable.js";

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

test("packaged CLI resumes an inventory read through the closed HTTPS transport", async () => {
  const { main } = await import(pathToFileURL(join(directory, "package/dist/src/cli.js")).href);
  const { transportBindings } = await import(pathToFileURL(join(directory, "package/dist/src/catalogue.js")).href);
  const fake = await fakeHttpsTenable([
    { body: { data: [{ id: "asset-1" }], pagination: { offset: 0, limit: 1, total: 2 } } },
    { body: { data: [{ id: "asset-2" }], pagination: { offset: 1, limit: 1, total: 2 } } },
  ]);
  const invoke = async (args: string[]) => {
    let stdout = "";
    await main(args, { credentials: { home: directory, env: { TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey,
      TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey } }, transportFactory: () => fake.transport(transportBindings),
    stdout: { write: (chunk: string) => { stdout += chunk; } } });
    expect(stdout).not.toContain(syntheticKeys.secretKey);
    return decode(stdout) as Record<string, unknown>;
  };
  try {
    const first = await invoke(["asset", "list", "--fields", "id", "--limit", "1"]);
    expect(first).toMatchObject({ assets: [{ id: "asset-1" }], total: 2, complete: false, cursor: expect.any(String) });
    const resumed = await invoke(["asset", "list", "--fields", "id", "--limit", "1", "--cursor", first.cursor as string]);
    expect(resumed).toMatchObject({ assets: [{ id: "asset-2" }], total: 2, complete: true });
    expect(fake.requests.map((request) => request.url)).toEqual([
      "/api/v1/t1/inventory/assets/search?offset=0&limit=1", "/api/v1/t1/inventory/assets/search?offset=1&limit=1",
    ]);
  } finally { await fake.close(); }
});

test("packaged export previews, creates once and downloads a redacted chunk over HTTPS", async () => {
  const { main } = await import(pathToFileURL(join(directory, "package/dist/src/cli.js")).href);
  const { transportBindings, mutationOperations } = await import(pathToFileURL(join(directory, "package/dist/src/catalogue.js")).href);
  const { constructWriteCoordinator } = await import(pathToFileURL(join(directory, "package/dist/src/writes-core.js")).href);
  const id = "00000000-0000-4000-8000-000000000001";
  const config = join(directory, "export-config.json");
  writeFileSync(config, JSON.stringify({ version: 1, profiles: { example: { writes: {
    allowWrites: true, operations: ["inventory-export-assets"],
  } } } }), { mode: 0o600 });
  const credentials = { home: directory, env: { TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey,
    TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey, XDG_STATE_HOME: join(directory, "export-state") } };
  const fake = await fakeHttpsTenable([{ body: { export_id: id } },
    { body: [{ asset_name: "Example device", password: "synthetic-export-password", description: syntheticKeys.secretKey }] }]);
  const invoke = async (args: string[]) => {
    let stdout = "";
    await main(["export", ...args, "--config", config, "--profile", "example"], { credentials,
      transportFactory: () => fake.transport(transportBindings),
      writeCoordinatorFactory: (options: unknown) => constructWriteCoordinator(options, {
        credentials, bindings: transportBindings, operations: mutationOperations, fetch: fake.fetch,
      }), stdout: { write: (chunk: string) => { stdout += chunk; } } });
    expect(stdout).not.toContain(syntheticKeys.secretKey);
    return decode(stdout) as Record<string, any>;
  };
  try {
    const preview = await invoke(["asset", "start"]);
    expect(preview.kind).toBe("dry-run");
    expect(fake.requests).toHaveLength(0);
    const started = await invoke(["asset", "start", "--execute", "--confirm", preview.preview.confirm]);
    expect(started.job).toEqual({ id, state: "QUEUED" });
    expect(fake.requests).toHaveLength(1);
    const output = join(directory, "assets.json");
    const downloaded = await invoke(["inventory", "download", "--id", id, "--chunk", "2", "--output", output]);
    expect(downloaded.file).toMatchObject({ id, chunk: 2, output, format: "JSON" });
    expect(JSON.parse(readFileSync(output, "utf8"))).toEqual([
      { asset_name: "Example device", password: "***redacted***", description: "***redacted***" },
    ]);
    expect(fake.requests.map((request) => [request.method, request.url])).toEqual([
      ["POST", "/api/v1/t1/inventory/export/assets"],
      ["GET", `/api/v1/t1/inventory/export/${id}/download/2`],
    ]);
  } finally { await fake.close(); }
});

test.each([["unknown", "list"], ["home", "--unknown"], ["home", "--help", "--help"]])(
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
