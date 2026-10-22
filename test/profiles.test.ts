import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { localFixture } from "./support/local-cli.js";

let fixture: ReturnType<typeof localFixture>;
beforeEach(() => { fixture = localFixture(); });
afterEach(() => fixture.cleanup());
const keys = { TENABLE_AXI_ACCESS_KEY: "synthetic-access", TENABLE_AXI_SECRET_KEY: "synthetic-secret" };

test("reports setup required and lists an empty configuration without networking", async () => {
  expect(await fixture.cli(["auth", "status"])).toMatchObject({ code: 1, data: { error: { code: "PROFILE_REQUIRED" } } });
  expect(await fixture.cli(["profile", "list"])).toMatchObject({ code: 0, data: { count: 0, profiles: [] } });
});

test("chooses config flag before environment and ignores repository discovery", async () => {
  fixture.env.TENABLE_AXI_CONFIG = join(fixture.home, "missing.json");
  expect(await fixture.cli(["config", "path", "--config", fixture.path])).toMatchObject({ code: 0, data: { config: fixture.path } });
  expect(await fixture.cli(["profile", "list"])).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INVALID" } } });
  fixture.config();
  expect(await fixture.cli(["profile", "list", "--config", fixture.path])).toMatchObject({ code: 0, data: { count: 1 } });
});

test.each([
  { args: ["--profile", "other"], env: { ...keys, TENABLE_AXI_PROFILE: "example" }, source: "flag", profile: "other" },
  { args: [], env: { ...keys, TENABLE_AXI_PROFILE: "other" }, source: "env", profile: "other" },
  { args: [], env: keys, source: "env-profile", profile: "env" },
  { args: [], env: { FILE_ACCESS: "file-access", FILE_SECRET: "file-secret" }, source: "config-default", profile: "example" },
])("selects the $source profile without mixing its fields", async ({ args, env, source, profile }) => {
  const refs = { accessKey: { env: "FILE_ACCESS" }, secretKey: { env: "FILE_SECRET" } };
  fixture.config({ example: refs, other: refs }, { defaultProfile: "example" });
  Object.assign(fixture.env, env, { FILE_ACCESS: "file-access", FILE_SECRET: "file-secret" });
  expect(await fixture.cli(["auth", "status", ...args])).toMatchObject({ code: 0, data: { profile, source, origin: "https://cloud.tenable.com" } });
});

test("selects a sole profile while ignoring invalid environment fields when explicitly selected", async () => {
  fixture.config({ example: { accessKey: { env: "A" }, secretKey: { env: "S" } } });
  Object.assign(fixture.env, { A: "synthetic-access-key", S: "synthetic-secret-key" });
  expect(await fixture.cli(["auth", "status"])).toMatchObject({ code: 0, data: { source: "sole" } });
  Object.assign(fixture.env, { TENABLE_AXI_ORIGIN: "https://invalid.example", TENABLE_AXI_ACCESS_KEY: "partial" });
  expect(await fixture.cli(["auth", "status", "--profile", "example"])).toMatchObject({ code: 0, data: { profile: "example" } });
});

test.each([
  { TENABLE_AXI_ACCESS_KEY: "partial" }, { TENABLE_AXI_SECRET_KEY: "partial" },
  { TENABLE_AXI_ORIGIN: "https://cloud.tenable.com" }, { ...keys, TENABLE_AXI_ORIGIN: "https://cloud.tenable.com/" },
  { ...keys, TENABLE_AXI_ACCESS_KEY: "" },
])("fails partial or invalid env profiles before configured defaults can supply missing fields %j", async (env) => {
  fixture.config({ example: { accessKey: { env: "A" }, secretKey: { env: "S" } } }, { defaultProfile: "example" });
  Object.assign(fixture.env, { A: "synthetic-file-access", S: "synthetic-file-secret" });
  Object.assign(fixture.env, env);
  expect(await fixture.cli(["auth", "status"])).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INVALID" } } });
});

test.each([
  [{ example: {}, other: {} }, [], "PROFILE_AMBIGUOUS"],
  [{ example: {} }, ["--profile", "missing"], "PROFILE_NOT_FOUND"],
  [{}, ["--profile", "missing"], "PROFILE_NOT_FOUND"],
] as const)("reports profile selection failures without exposing names %j", async (profiles, args, code) => {
  fixture.config(profiles);
  expect(await fixture.cli(["auth", "status", ...args])).toMatchObject({ code: 1, data: { error: { code } } });
});

test.each([
  { accessKey: "inline-sentinel" }, { accessKey: { stored: true } }, { accessKey: { env: "BAD-NAME" } },
  { accessKey: { env: "A", file: "/synthetic/key" } }, { secretKey: { file: "relative" } },
  { unknown: "sentinel" }, { origin: "https://cloud.tenable.com:443" }, { writes: { allowWrites: true, operations: ["*"] } },
])("rejects unsafe profile configuration even when listing profiles %j", async (profile) => {
  fixture.config({ example: profile });
  expect(await fixture.cli(["profile", "list"])).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INVALID" } } });
});

test.each([{ version: 2 }, { defaultProfile: "missing" }, { extra: true }])("rejects invalid config envelopes %j", async (extra) => {
  fixture.config(undefined, extra);
  expect(await fixture.cli(["profile", "list"])).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INVALID" } } });
});

test.each([undefined, "false", "0", "TRUE", "1", "FaLsE", "invalid", ""]) ("handles forced read-only %j without enabling env writes", async (value) => {
  Object.assign(fixture.env, keys);
  if (value !== undefined) fixture.env.TENABLE_AXI_READ_ONLY = value;
  const result = await fixture.cli(["auth", "status"]);
  expect(result).toMatchObject(value === "invalid" || value === "" ? { code: 1, data: { error: { code: "CONFIG_INVALID" } } } : { code: 0, data: { readOnly: true } });
});

test("forced read-only narrows an explicitly configured write policy", async () => {
  fixture.config({ example: { writes: { allowWrites: true, operations: ["tags-create-tag"] } } });
  Object.assign(fixture.env, keys, { TENABLE_AXI_PROFILE: "example" });
  expect(await fixture.cli(["auth", "status"])).toMatchObject({ code: 0, data: { readOnly: false } });
  fixture.env.TENABLE_AXI_READ_ONLY = "true";
  expect(await fixture.cli(["auth", "status"])).toMatchObject({ code: 0, data: { readOnly: true } });
});

test("reads private BOM and CRLF secret files while reporting only their source", async () => {
  const path = join(fixture.home, "key");
  writeFileSync(path, "\uFEFFsynthetic-key\r\n ", { mode: 0o400 });
  fixture.config({ example: { accessKey: { file: path }, secretKey: { file: path } } });
  expect(await fixture.cli(["auth", "status"])).toMatchObject({ code: 0, data: { accessKey: { file: path }, secretKey: { file: path } } });
});

test.each(["missing", "empty", "public", "symlink", "directory"])("refuses a %s secret file", async (kind) => {
  const path = join(fixture.home, "key");
  if (kind === "directory") mkdirSync(path);
  else if (kind !== "missing") writeFileSync(path, kind === "empty" ? "\uFEFF\r\n" : "synthetic-key", { mode: kind === "public" ? 0o644 : 0o600 });
  const ref = kind === "symlink" ? `${path}.link` : path;
  if (kind === "symlink") symlinkSync(path, ref);
  fixture.config({ example: { accessKey: { file: ref } } });
  expect(await fixture.cli(["auth", "status"])).toMatchObject({ code: 1, data: { error: { code: ["missing", "empty"].includes(kind) ? "AUTH_REQUIRED" : "CONFIG_INSECURE" } } });
});

test("rejects group-writable configs and configs owned by another uid", async () => {
  fixture.config();
  chmodSync(fixture.path, 0o660);
  expect(await fixture.cli(["profile", "list"])).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INSECURE" } } });
  chmodSync(fixture.path, 0o600);
  expect(await fixture.cli(["profile", "list"], { uid: process.getuid!() + 1 })).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INSECURE" } } });
});

test("refuses symlinked configuration rather than reading its target", async () => {
  fixture.config();
  const link = join(fixture.home, "config-link.json");
  symlinkSync(fixture.path, link);
  expect(await fixture.cli(["profile", "list", "--config", link])).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INSECURE" } } });
});

test("reports missing default SecretRef values without silently accepting a configured profile", async () => {
  fixture.config();
  expect(await fixture.cli(["auth", "status"])).toMatchObject({ code: 1, data: { error: { code: "AUTH_REQUIRED" } } });
});

test.each(["win32", "linux", "darwin"] as const)("uses platform defaults and only absolute XDG overrides on %s", async (platform) => {
  Object.assign(fixture.env, { XDG_CONFIG_HOME: "relative", XDG_STATE_HOME: "relative", APPDATA: "C:\\Roaming", LOCALAPPDATA: "C:\\Local" });
  const result = await fixture.cli(["config", "path"], { platform, home: platform === "win32" ? "C:\\Home" : fixture.home });
  expect(result).toMatchObject({ code: 0, data: platform === "win32" ? { config: "C:\\Roaming\\tenable-axi\\config.json", state: "C:\\Local\\tenable-axi" }
    : { config: join(fixture.home, ".config/tenable-axi/config.json"), state: join(fixture.home, ".local/state/tenable-axi") } });
});

test("verifies Windows DACLs in auth status and rejects reparse points on ordinary reads", async () => {
  fixture.config();
  chmodSync(fixture.path, 0o666);
  Object.assign(fixture.env, keys);
  const context = { platform: "win32" as const, acl: () => {} };
  expect(await fixture.cli(["auth", "status", "--config", fixture.path, "--profile", "example"], context)).toMatchObject({ code: 0 });
  const rejectAcl = { platform: "win32" as const, acl: (_path: string, action: string) => { if (action === "verify") throw new Error("unprotected DACL"); } };
  expect(await fixture.cli(["auth", "status", "--config", fixture.path], rejectAcl)).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INSECURE" } } });
  expect(await fixture.cli(["profile", "list", "--config", fixture.path], rejectAcl)).toMatchObject({ code: 0 });
  expect(await fixture.cli(["profile", "list", "--config", fixture.path], { platform: "win32", acl: () => { throw new Error("reparse point"); } })).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INSECURE" } } });
});

test.each(["\\\\server\\share\\key", "\\\\?\\C:\\key", "relative", "/posix/key"])("rejects non-drive Windows SecretRef path %s", async (file) => {
  fixture.config({ example: { accessKey: { file } } });
  expect(await fixture.cli(["profile", "list", "--config", fixture.path], { platform: "win32", acl: () => {} })).toMatchObject({ code: 1, data: { error: { code: "CONFIG_INVALID" } } });
});

test.each([
  ["auth", "status", "--access-key", "secret"], ["auth", "status", "--profile", "a", "--profile", "b"],
  ["auth", "status", "unexpected"], ["auth", "login"], ["config", "path", "--fields", "secret"],
  ["auth", "status", "--help", "--unknown"], ["profile", "list", "--config"],
])("rejects invalid invocation before touching an insecure config %j", async (...args) => {
  fixture.config();
  chmodSync(fixture.path, 0o666);
  expect(await fixture.cli(args)).toMatchObject({ code: 2, data: { error: { code: "VALIDATION_ERROR" } } });
});
