import { spawnSync } from "node:child_process";
import { decode } from "@toon-format/toon";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { localFixture } from "./support/local-cli.js";
import { transportBindings } from "../src/catalogue.js";
import { fakeTransport } from "./support/fake-tenable.js";

let fixture: ReturnType<typeof localFixture>;
beforeEach(() => { fixture = localFixture(); });
afterEach(() => fixture.cleanup());

test("CLI renders bounded schema diagnostics with known secrets and tenant keys redacted", async () => {
  const keys = { accessKey: "SyntheticAccess", secretKey: "SyntheticSecret" };
  Object.assign(fixture.env, { TENABLE_AXI_ACCESS_KEY: keys.accessKey, TENABLE_AXI_SECRET_KEY: keys.secretKey });
  const fake = fakeTransport([{ body: { data: null, [keys.accessKey]: "private-value",
    "tenant.example.test": keys.secretKey }, headers: { "content-type": `application/${keys.secretKey}; private=header-sentinel` } }],
  transportBindings, { keys });
  const result = await fixture.cli(["asset", "list"], {}, () => fake.transport);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "RESPONSE_INVALID", status: 200,
    contentType: expect.stringContaining("REDACTED"), shape: [
      { path: "$", type: "object" }, { path: '$["data"]', type: "null", expected: "array" },
      { path: expect.stringContaining("REDACTED"), type: "string" }, { path: '$["<key>"]', type: "string" },
    ], issues: [{ path: '$["data"]', received: "null", expected: "array", code: "invalid_type" }] } });
  for (const sentinel of [keys.accessKey, keys.secretKey, "private-value", "tenant.example.test", "header-sentinel"])
    expect(result.stdout).not.toContain(sentinel);
});

test.each(["raw", "json", "url", "header", "header-json", "header-url"])("removes %s credential sentinels from CLI output and diagnostics", (form) => {
  const access = 'synthetic-access"sentinel';
  const secret = 'synthetic-secret"sentinel';
  const header = `accessKey=${access}; secretKey=${secret}`;
  const input = form.startsWith("header") ? header : secret;
  const value = form.endsWith("json") ? JSON.stringify(input).slice(1, -1) : form.endsWith("url") ? encodeURIComponent(input) : input;
  const path = join(fixture.home, value, "config.json");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify({ version: 1, profiles: { example: {} } }), { mode: 0o600 });
  const result = spawnSync(process.execPath, [resolve("bin/tenable-axi.js"), "auth", "status", "--config", path, "--profile", "example"], {
    encoding: "utf8", env: { ...process.env, HOME: fixture.home, XDG_CONFIG_HOME: fixture.home, XDG_STATE_HOME: fixture.home,
      TENABLE_AXI_ACCESS_KEY: access, TENABLE_AXI_SECRET_KEY: secret },
  });
  expect(result.status, result.stderr).toBe(0);
  expect(decode(result.stdout)).toMatchObject({ accessKey: "env", secretKey: "env" });
  expect(decode(result.stdout)).not.toHaveProperty("config");
  expect(result.stdout + result.stderr).not.toContain(value);
  expect(result.stdout + result.stderr).not.toContain(access);
  expect(result.stdout + result.stderr).not.toContain(secret);
  expect(result.stdout).not.toContain("accessKey=");
  expect(result.stderr).toBe("");
});

test("redacts a resolved secret in an insecure-file error and emits no raw stderr", async () => {
  const secret = 'synthetic-file-secret"sentinel';
  Object.assign(fixture.env, { A: secret });
  const file = join(fixture.home, secret);
  writeFileSync(file, "other", { mode: 0o644 });
  fixture.config({ example: { accessKey: { env: "A" }, secretKey: { file } } });
  const result = await fixture.cli(["auth", "status"]);
  expect(result).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INSECURE" } } });
  expect(result.stdout).not.toContain(fixture.home);
  expect(result.stdout).not.toContain(secret);
});

test.each(["synthetic;injection", "synthetic=delimiter", "synthetic\r\nheader", "synthetic\u0000key", "synthetic\u0085control", "synthetic\u2028separator"])("rejects unsafe key values without echoing sentinels %j", async (secret) => {
  Object.assign(fixture.env, { TENABLE_AXI_ACCESS_KEY: secret, TENABLE_AXI_SECRET_KEY: "other-secret" });
  const result = await fixture.cli(["auth", "status"]);
  expect(result).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INVALID" } } });
  expect(result.stdout).not.toContain(secret);
});
