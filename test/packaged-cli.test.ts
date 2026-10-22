import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { decode } from "@toon-format/toon";
import { parse as parseToml } from "smol-toml";
import { afterAll, beforeAll, expect, test } from "vitest";
import { fakeHttpsTenable, syntheticKeys } from "./support/fake-tenable.js";

let directory: string;
let entry: string;
let packageRoot: string;
let version: string;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "tenable-axi-package-"));
  const packed = spawnSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", directory], { encoding: "utf8" });
  expect(packed.status, packed.stderr).toBe(0);
  const [metadata] = JSON.parse(packed.stdout) as { filename: string; version: string }[];
  version = metadata!.version;
  // Supply real dependency tarballs locally so npm installation needs no registry.
  const tarballs = [join(directory, metadata!.filename)];
  for (const dependency of ["axi-sdk-js", "@toon-format/toon", "zod", "smol-toml"]) {
    // Break pnpm store hardlinks before repacking: npm extraction omits linked entries.
    const source = join(directory, "dependencies", dependency);
    cpSync(realpathSync(resolve("node_modules", dependency)), source, { recursive: true });
    const dependencyPack = spawnSync("npm", ["pack", "--force", "--ignore-scripts", "--json", "--pack-destination", directory], {
      cwd: source, encoding: "utf8",
    });
    expect(dependencyPack.status, dependencyPack.stderr).toBe(0);
    tarballs.push(join(directory, JSON.parse(dependencyPack.stdout)[0].filename));
  }
  const prefix = join(directory, "Agent's $Tools");
  const installed = spawnSync("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", prefix, ...tarballs], { encoding: "utf8" });
  expect(installed.status, installed.stderr).toBe(0);
  packageRoot = join(prefix, "node_modules/@knowttl/tenable-axi");
  entry = join(packageRoot, "bin/tenable-axi.js");
}, 30_000);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

function cli(...args: string[]) {
  return spawnSync(process.execPath, [entry, ...args], { encoding: "utf8", cwd: directory, timeout: 10_000 });
}

function hookFixture() {
  const home = mkdtempSync(join(tmpdir(), "tenable-axi-hook-"));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("TENABLE_AXI_")));
  const isolated = { ...env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, ".config"),
    XDG_STATE_HOME: join(home, "state"), APPDATA: join(home, "AppData/Roaming"), LOCALAPPDATA: join(home, "AppData/Local"),
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${resolve("test/support/deny-network.mjs")}` };
  const run = (args: string[], extra: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [entry, ...args], {
    cwd: home, env: { ...isolated, ...extra }, encoding: "utf8", timeout: 10_000,
  });
  return { home, env: isolated, run, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}

test("ordinary packaged commands and setup help never install agent integrations", () => {
  const fixture = hookFixture();
  try {
    for (const args of [["home"], ["profile", "list"], ["--help"], ["hook"], ["setup", "hooks", "--help"]]) {
      expect(fixture.run(args).status).toBe(0);
    }
    expect(existsSync(join(fixture.home, ".claude"))).toBe(false);
    expect(existsSync(join(fixture.home, ".codex"))).toBe(false);
    expect(existsSync(join(fixture.home, ".config/opencode"))).toBe(false);
  } finally { fixture.cleanup(); }
});

test("explicit setup installs executable hooks and preserves unrelated integrations on repeated setup", () => {
  const fixture = hookFixture();
  try {
    mkdirSync(join(fixture.home, ".claude"));
    const settings = join(fixture.home, ".claude/settings.json");
    const unrelated = { matcher: "startup", hooks: [{ type: "command", command: "other-tool hook" }] };
    writeFileSync(settings, JSON.stringify({ permissions: { allow: [] }, hooks: { SessionStart: [unrelated] } }));
    const result = fixture.run(["setup", "hooks"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(decode(result.stdout)).toMatchObject({ hooks: { status: "installed", scope: "user" } });
    const claude = JSON.parse(readFileSync(settings, "utf8"));
    expect(claude.permissions).toEqual({ allow: [] });
    expect(claude.hooks.SessionStart).toContainEqual(unrelated);
    const hook = claude.hooks.SessionStart.flatMap((group: { hooks: { command: string }[] }) => group.hooks)
      .find((item: { command: string }) => item.command.includes("tenable-axi-hook"));
    const ambient = spawnSync(hook.command, [], { shell: true, env: fixture.env, cwd: fixture.home, encoding: "utf8" });
    expect(ambient.status, ambient.stderr).toBe(0);
    expect(decode(ambient.stdout)).toMatchObject({ status: "not configured" });
    const paths = [settings, join(fixture.home, ".codex/hooks.json"), join(fixture.home, ".codex/config.toml"),
      join(fixture.home, ".config/opencode/plugins/axi-tenable-axi-hook.js")];
    const before = paths.map((path) => ({ path, content: readFileSync(path, "utf8"), modified: statSync(path).mtimeMs }));
    expect(fixture.run(["setup", "hooks"]).status).toBe(0);
    expect(before.map(({ path }) => ({ path, content: readFileSync(path, "utf8"), modified: statSync(path).mtimeMs }))).toEqual(before);
    const codex = JSON.parse(readFileSync(paths[1]!, "utf8"));
    expect(codex.hooks.SessionStart.flatMap((group: { hooks: unknown[] }) => group.hooks)).toEqual([hook]);
    expect(parseToml(readFileSync(paths[2]!, "utf8"))).toMatchObject({ features: { hooks: true } });
  } finally { fixture.cleanup(); }
});

test("setup repairs a stale hook path using the verified installed binary on PATH", () => {
  const fixture = hookFixture();
  try {
    mkdirSync(join(fixture.home, ".claude"));
    const settings = join(fixture.home, ".claude/settings.json");
    writeFileSync(settings, JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "/old/tenable-axi-hook" }] }] } }));
    const nonExecutable = join(fixture.home, "non-executable");
    mkdirSync(nonExecutable);
    writeFileSync(join(nonExecutable, "tenable-axi-hook"), "unusable binary", { mode: 0o600 });
    symlinkSync(join(packageRoot, "bin/tenable-axi-hook.js"), join(fixture.home, "tenable-axi-hook"));
    const result = fixture.run(["setup", "hooks"], { PATH: `${nonExecutable}:${fixture.home}:${process.env.PATH}` });
    expect(result.status, result.stdout).toBe(0);
    const installed = JSON.parse(readFileSync(settings, "utf8")).hooks.SessionStart;
    expect(installed.flatMap((group: { hooks: unknown[] }) => group.hooks)).toEqual([
      { type: "command", command: "tenable-axi-hook", timeout: 10 },
    ]);
  } finally { fixture.cleanup(); }
});

test("project setup confines integrations to the working directory and enables Codex user hooks", () => {
  const fixture = hookFixture();
  const project = join(fixture.home, "project");
  try {
    mkdirSync(project);
    const result = spawnSync(process.execPath, [entry, "setup", "hooks", "--scope", "project"], {
      cwd: project, env: fixture.env, encoding: "utf8",
    });
    expect(result.status, result.stdout).toBe(0);
    expect(existsSync(join(project, ".claude/settings.json"))).toBe(true);
    expect(existsSync(join(project, ".codex/hooks.json"))).toBe(true);
    expect(existsSync(join(project, ".opencode/plugins/axi-tenable-axi-hook.js"))).toBe(true);
    expect(existsSync(join(fixture.home, ".claude/settings.json"))).toBe(false);
    expect(parseToml(readFileSync(join(fixture.home, ".codex/config.toml"), "utf8"))).toMatchObject({ features: { hooks: true } });
  } finally { fixture.cleanup(); }
});

test.each(["user", "project"])("%s hooks execute fallback paths with shell metacharacters in every integration", (scope) => {
  const fixture = hookFixture();
  try {
    const older = join(fixture.home, "older-bin"), current = join(fixture.home, "current-bin");
    mkdirSync(older);
    mkdirSync(current);
    writeFileSync(join(older, "tenable-axi-hook"), "#!/bin/sh\nprintf 'wrong installation\\n'\n");
    chmodSync(join(older, "tenable-axi-hook"), 0o755);
    symlinkSync(join(packageRoot, "bin/tenable-axi-hook.js"), join(current, "tenable-axi-hook"));
    const env = { ...fixture.env, PATH: `${older}:${current}:${process.env.PATH}` };
    expect(fixture.run(["setup", "hooks", "--scope", scope], env).status).toBe(0);
    for (const path of [".claude/settings.json", ".codex/hooks.json"]) {
      const settings = JSON.parse(readFileSync(join(fixture.home, path), "utf8"));
      const command = settings.hooks.SessionStart[0].hooks[0].command;
      const result = spawnSync(command, { shell: true, cwd: fixture.home, env, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      expect(decode(result.stdout)).toMatchObject({ status: "not configured" });
    }
    const plugin = join(fixture.home, scope === "user" ? ".config/opencode" : ".opencode", "plugins/axi-tenable-axi-hook.js");
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      const { default: plugin } = await import(${JSON.stringify(pathToFileURL(plugin).href)});
      const server = await plugin.server({ directory: process.cwd() });
      const output = { system: [] };
      await server["experimental.chat.system.transform"]({ sessionID: "example" }, output);
      let context;
      await plugin.setup({ location: { directory: process.cwd() }, session: { hook: async (_, handler) => { context = handler; } } });
      const event = { sessionID: "example", system: [] };
      await context(event);
      console.log(JSON.stringify({ legacy: output.system, current: event.system }));
    `], { cwd: fixture.home, env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const context = JSON.parse(result.stdout);
    expect(decode(context.legacy[0].split("\n").slice(1).join("\n"))).toMatchObject({ status: "not configured" });
    expect(context.current).toEqual([{ type: "text", text: context.legacy[0] }]);
  } finally { fixture.cleanup(); }
});

test.each(["user", "project"].flatMap((scope) => [
  "features.hooks = false\nfeatures.other = true",
  '["features"]\n"hooks" = false\nother = true',
  "['features']\n'hooks' = false\nother = true",
  '"features"."hooks" = false\nfeatures.other = true',
  "features = { hooks = false, other = true }",
  "[features]\n# hooks = true\nhooks = false\nother = true",
].map((features) => ({ scope, features }))))("$scope setup enables existing Codex hooks semantically: $features", ({ scope, features }) => {
  const fixture = hookFixture();
  try {
    mkdirSync(join(fixture.home, ".codex"));
    const path = join(fixture.home, ".codex/config.toml");
    writeFileSync(path, `model = "synthetic-model"\nthreshold = 9007199254740993\n${features}\n[projects.synthetic-project]\ntrust_level = "trusted"\n`);
    const result = fixture.run(["setup", "hooks", "--scope", scope]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(parseToml(readFileSync(path, "utf8"), { integersAsBigInt: true })).toEqual({
      model: "synthetic-model", threshold: 9007199254740993n,
      features: { hooks: true, other: true }, projects: { "synthetic-project": { trust_level: "trusted" } },
    });
    const before = { content: readFileSync(path, "utf8"), modified: statSync(path).mtimeMs };
    expect(fixture.run(["setup", "hooks", "--scope", scope]).status).toBe(0);
    expect({ content: readFileSync(path, "utf8"), modified: statSync(path).mtimeMs }).toEqual(before);
  } finally { fixture.cleanup(); }
});

test.each(["features = false\n", "[features\n"])("setup leaves unusable Codex configuration unchanged: %j", (content) => {
  const fixture = hookFixture();
  try {
    mkdirSync(join(fixture.home, ".codex"));
    const path = join(fixture.home, ".codex/config.toml");
    writeFileSync(path, content);
    const result = fixture.run(["setup", "hooks"]);
    expect(result.status).toBe(1);
    expect(decode(result.stdout)).toMatchObject({ error: expect.anything() });
    expect(readFileSync(path, "utf8")).toBe(content);
  } finally { fixture.cleanup(); }
});

test("ambient hook reports the selected local profile without resolving its secret files", () => {
  const fixture = hookFixture();
  try {
    const config = join(fixture.home, "config.json");
    writeFileSync(config, JSON.stringify({ version: 1, profiles: { example: { accessKey: { file: join(fixture.home, "absent-access") },
      secretKey: { file: join(fixture.home, "absent-secret") } } } }), { mode: 0o600 });
    const result = spawnSync(process.execPath, [join(packageRoot, "bin/tenable-axi-hook.js")], {
      env: { ...fixture.env, TENABLE_AXI_CONFIG: config, TENABLE_AXI_PROFILE: "example" }, cwd: fixture.home, encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(decode(result.stdout)).toEqual({ profile: "example", origin: "https://cloud.tenable.com", readOnly: true });
  } finally { fixture.cleanup(); }
});

test("packaged version aliases work without the command graph", () => {
  const graph = join(packageRoot, "dist");
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
  const schema = JSON.parse(readFileSync(join(packageRoot, "axi-credential.schema.json"), "utf8"));
  expect(schema.properties).toMatchObject({ accessKey: { "x-secret": true }, secretKey: { "x-secret": true } });
});

test("packaged CLI resumes an inventory read through the closed HTTPS transport", async () => {
  const { main } = await import(pathToFileURL(join(packageRoot, "dist/src/cli.js")).href);
  const { transportBindings } = await import(pathToFileURL(join(packageRoot, "dist/src/catalogue.js")).href);
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
  const { main } = await import(pathToFileURL(join(packageRoot, "dist/src/cli.js")).href);
  const { transportBindings, mutationOperations } = await import(pathToFileURL(join(packageRoot, "dist/src/catalogue.js")).href);
  const { constructWriteCoordinator } = await import(pathToFileURL(join(packageRoot, "dist/src/writes-core.js")).href);
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

test("packaged CLI guards an attack export then downloads redacted JSON through HTTPS", async () => {
  const { main } = await import(pathToFileURL(join(packageRoot, "dist/src/cli.js")).href);
  const { transportBindings, mutationOperations } = await import(pathToFileURL(join(packageRoot, "dist/src/catalogue.js")).href);
  const { constructWriteCoordinator } = await import(pathToFileURL(join(packageRoot, "dist/src/writes-core.js")).href);
  const id = "00000000-0000-4000-8000-000000000001";
  const fake = await fakeHttpsTenable([
    { status: 202, body: { export_id: id } },
    { body: { export_id: id, status: "FINISHED" } },
    { body: [{ path_name: "Synthetic path", password: "synthetic-hidden", note: syntheticKeys.secretKey }] },
  ]);
  const config = join(directory, "export-config.json"), body = join(directory, "export-body.json"), output = join(directory, "attack.json");
  writeFileSync(config, JSON.stringify({ version: 1, profiles: { example: { writes: { allowWrites: true, operations: ["apa-export-attack-path"] } } } }), { mode: 0o600 });
  writeFileSync(body, '{"file_format":"JSON"}');
  const credentials = { home: directory, env: { XDG_STATE_HOME: directory, TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey, TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey } };
  const invoke = async (args: string[]) => {
    let stdout = "";
    await main([...args, "--config", config, "--profile", "example"], { credentials,
      transportFactory: () => fake.transport(transportBindings),
      writeCoordinatorFactory: (options: Record<string, unknown>) => constructWriteCoordinator(options, {
        operations: mutationOperations, bindings: transportBindings, fetch: fake.fetch, credentials,
      }), stdout: { write: (chunk: string) => { stdout += chunk; } },
    });
    expect(stdout).not.toContain(syntheticKeys.secretKey);
    return decode(stdout) as Record<string, unknown>;
  };
  try {
    const start = ["export", "attack-path", "start", "--body-file", body];
    const preview = await invoke(start);
    expect(fake.requests).toHaveLength(0);
    const created = await invoke([...start, "--execute", "--confirm", (preview.preview as { confirm: string }).confirm]);
    expect(created).toMatchObject({ job: { id, state: "SUBMITTED" } });
    expect(await invoke(["export", "attack", "status", "--id", id])).toMatchObject({ job: { id, state: "FINISHED" } });
    expect(await invoke(["export", "attack", "download", "--id", id, "--output", output])).toMatchObject({ file: { id, format: "JSON" } });
    expect(JSON.parse(readFileSync(output, "utf8"))).toEqual([{ path_name: "Synthetic path", password: "***redacted***", note: "***redacted***" }]);
    expect(fake.requests.map(({ method, url }) => [method, url])).toEqual([
      ["POST", "/api/v1/export/attack-path"], ["GET", `/api/v1/export/${id}/status`], ["GET", `/api/v1/export/${id}/download`],
    ]);
  } finally { await fake.close(); }
});
