import { existsSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { constructWriteCoordinator, type MutationOperation, type WriteCoordinatorOptions } from "../src/writes-core.js";
import { privateFiles } from "../src/private-file.js";
import type { OperationBinding } from "../src/transport.js";
import { fakeTransport, syntheticKeys, type Reply } from "./support/fake-tenable.js";
import { localFixture } from "./support/local-cli.js";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const input = { id, name: "Example" };
const state = { id, name: "Old", version: 1 };
const changed = { ...state, name: "Example", version: 2 };
const response = z.object({ id: z.string(), name: z.string(), version: z.number() });
const binding: OperationBinding = { method: "PUT", path: "/synthetic/resources/{id}", effect: "write", query: [],
  decoder: response, permissionHelp: "Check synthetic write permission", validationHelp: "Check synthetic input" };
const bindings = { change: binding, show: { ...binding, method: "GET" as const, effect: "read" as const } };
const operation: MutationOperation = {
  input: z.strictObject({ id: z.string(), name: z.string() }),
  prepare(value) {
    const input = value as { id: string; name: string };
    return { target: { kind: "resource", id: input.id }, request: { pathParams: { id: input.id }, body: { name: input.name } } };
  },
  async current(transport, value) {
    const input = value as { id: string; name: string };
    const { body } = await transport.request("show", { pathParams: { id: input.id } });
    return { state: body, noop: (body as typeof state).name === input.name };
  },
  effect: "Replace the synthetic resource name", readBackHelp: ["Read the resource before a new intent; never replay this intent"],
};
let fixture: ReturnType<typeof localFixture>;
let journal: string;
beforeEach(() => {
  fixture = localFixture();
  journal = join(fixture.home, "state", "writes.log");
  fixture.config({ example: { writes: { allowWrites: true, operations: ["change"] } } });
  Object.assign(fixture.env, { TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey, TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey,
    TENABLE_AXI_WRITE_LOG: journal });
});
afterEach(() => { vi.useRealTimers(); fixture.cleanup(); });

function coordinator(replies: (Reply | "disconnect" | "hang")[] = [], options: WriteCoordinatorOptions = {}, definition = operation,
  files = privateFiles()) {
  const fake = fakeTransport(replies, bindings);
  return { ...fake, ...constructWriteCoordinator({ config: fixture.path, profile: "example", ...options }, {
    operations: { change: definition }, bindings, fetch: fake.fetch, credentials: { env: fixture.env, home: fixture.home }, files,
  }) };
}
const confirm = JSON.stringify(["example", "change", { id, kind: "resource" }]);
const execute = { execute: true, confirm, intentId: "synthetic-intent" };
const records = () => readFileSync(journal, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);

test.each([
  [undefined, {}, "WRITES_DISABLED"],
  [{ allowWrites: false, operations: ["change"] }, {}, "WRITES_DISABLED"],
  [{ allowWrites: true, operations: [] }, {}, "OPERATION_NOT_WRITABLE"],
  [{ allowWrites: true, operations: ["other"] }, {}, "OPERATION_NOT_WRITABLE"],
  [{ allowWrites: true, operations: ["change"] }, { readOnly: true }, "WRITES_DISABLED"],
])("configured write gates refuse previews and sends before upstream reads: %j", async (writes, options, code) => {
  fixture.config({ example: writes === undefined ? {} : { writes } });
  const client = coordinator([], options);
  await expect(client.run("change", input)).rejects.toMatchObject({ error: { code } });
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code } });
  expect(client.requests).toHaveLength(0);
  expect(existsSync(journal)).toBe(false);
});

test.each(["true", "1", "TRUE"])("forced read-only %s blocks an enabled profile", async (value) => {
  fixture.env.TENABLE_AXI_READ_ONLY = value;
  const client = coordinator();
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "WRITES_DISABLED" } });
  expect(client.requests).toHaveLength(0);
});

test.each(["", "invalid"])("invalid read-only %j fails closed", (value) => {
  fixture.env.TENABLE_AXI_READ_ONLY = value;
  expect(() => coordinator()).toThrowError(expect.objectContaining({ code: "CONFIG_INVALID" }));
});

test.each(["0", "false"])("read-only %s cannot enable an environment profile", async (value) => {
  fixture.env.TENABLE_AXI_READ_ONLY = value;
  const client = coordinator([], { profile: undefined });
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "WRITES_DISABLED" } });
  expect(client.requests).toHaveLength(0);
});

test("a configuration edit cannot widen an existing coordinator's scope", async () => {
  fixture.config({ example: { writes: { allowWrites: true, operations: [] } } });
  const client = coordinator();
  fixture.config({ example: { writes: { allowWrites: true, operations: ["change"] } } });
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "OPERATION_NOT_WRITABLE" } });
  expect(client.requests).toHaveLength(0);
});

test.each([undefined, { dryRun: true }])("preview %j reads current state without reserving intent or sending a write", async (flags) => {
  const client = coordinator([{ body: state }]);
  expect(await client.run("change", input, flags)).toMatchObject({ kind: "dry-run", preview: {
    current: state, proposed: { body: { name: "Example" } }, effect: operation.effect, confirm,
  } });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET"]);
  expect(existsSync(journal)).toBe(false);
});

test.each([undefined, "1", JSON.stringify(["other-profile", "change", { id, kind: "resource" }])])(
  "missing or wrong confirmation %j never reserves or sends", async (confirmation) => {
    const client = coordinator([{ body: state }]);
    await expect(client.run("change", input, { execute: true, confirm: confirmation })).rejects.toMatchObject({
      error: { code: confirmation === undefined ? "CONFIRM_REQUIRED" : "CONFIRM_MISMATCH" },
    });
    expect(client.requests.map(({ init }) => init.method)).toEqual(["GET"]);
    expect(existsSync(journal)).toBe(false);
  },
);

test("verified desired state returns a no-op without confirmation, journal or mutation", async () => {
  const client = coordinator([{ body: changed }]);
  expect(await client.run("change", input, { execute: true })).toMatchObject({ kind: "noop" });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET"]);
  expect(existsSync(journal)).toBe(false);
});

test("exact confirmation sends once and preserves intent and outcome durably", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T00:00:00Z"));
  const client = coordinator([{ body: state }, { body: state }, { body: changed }]);
  const result = await client.run("change", input, execute);
  expect(result).toMatchObject({ kind: "success", status: 200, response: changed });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET", "GET", "PUT"]);
  expect(records()).toMatchObject([
    { kind: "intent", time: "2026-10-22T00:00:00.000Z", profile: "example", operation: "change" },
    { kind: "outcome", result: "SUCCESS", status: 200 },
  ]);
  expect(records()[0]!.auditId).toBe(records()[1]!.auditId);
  expect(statSync(journal).mode & 0o777).toBe(0o600);
  expect(existsSync(`${journal}.lock`)).toBe(false);
});

test("host approval denial prevents intent reservation and mutation", async () => {
  const client = coordinator([{ body: state }], { approval: async () => false });
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "APPROVAL_DENIED" } });
  expect(client.requests).toHaveLength(1);
  expect(existsSync(journal)).toBe(false);
});

test("a target version change after approval refuses the stale preview", async () => {
  const client = coordinator([{ body: state }, { body: { ...state, version: 2 } }]);
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "PREVIEW_CHANGED" } });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET", "GET"]);
  expect(records()[1]).toMatchObject({ result: "NOT_SENT" });
});

test.each(["lock", "malformed", "incomplete", "symlink"])("a %s journal blocks the write", async (failure) => {
  mkdirSync(join(fixture.home, "state"), { mode: 0o700 });
  if (failure === "lock") writeFileSync(`${journal}.lock`, "", { mode: 0o600 });
  else if (failure === "symlink") symlinkSync(fixture.path, journal);
  else writeFileSync(journal, failure === "incomplete" ? "{}" : "{}\n", { mode: 0o600 });
  const client = coordinator([{ body: state }]);
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "INTENT_NOT_RECORDED" } });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET"]);
  if (failure === "lock") expect(existsSync(`${journal}.lock`)).toBe(true);
});

test("intent persistence failure prevents sending", async () => {
  const client = coordinator([{ body: state }], {}, operation, { ...privateFiles(), write() { throw new Error("disk full"); } });
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "INTENT_NOT_RECORDED" } });
  expect(client.requests).toHaveLength(1);
});

test("outcome persistence failure reports possible remote success and keeps the reservation", async () => {
  const files = privateFiles();
  const client = coordinator([{ body: state }, { body: state }, { body: changed }], {}, operation, {
    ...files, write(path, content) { if (content.includes('"kind":"outcome"')) throw new Error("disk full"); files.write(path, content); },
  });
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: {
    code: "OUTCOME_UNKNOWN", auditId: expect.any(String), message: expect.stringContaining("remote success is possible"),
  } });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET", "GET", "PUT"]);
  expect(records()).toHaveLength(1);
});

test("a durable intent cannot be replayed by another coordinator", async () => {
  const first = coordinator([{ body: state }, { body: state }, { body: changed }]);
  await first.run("change", input, execute);
  const second = coordinator([{ body: state }]);
  await expect(second.run("change", input, execute)).rejects.toMatchObject({ error: { code: "ALREADY_EXECUTED" } });
  expect(second.requests.map(({ init }) => init.method)).toEqual(["GET"]);
  expect(records()).toHaveLength(2);
});

test.each(["disconnect", "hang"] as const)("an ambiguous %s is journalled without replay", async (failure) => {
  vi.useFakeTimers();
  const client = coordinator([{ body: state }, { body: state }, failure]);
  const result = expect(client.run("change", input, execute)).rejects.toMatchObject({ error: {
    code: "OUTCOME_UNKNOWN", auditId: expect.any(String),
  }, help: operation.readBackHelp });
  await vi.runAllTimersAsync();
  await result;
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET", "GET", "PUT"]);
  expect(records()[1]).toMatchObject({ result: "OUTCOME_UNKNOWN" });
  expect(vi.getTimerCount()).toBe(0);
});

test.each([429, 503])("write HTTP %i is recorded and never retried", async (status) => {
  const client = coordinator([{ body: state }, { body: state }, { status, body: { message: "refused" } }]);
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { status, auditId: expect.any(String) } });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET", "GET", "PUT"]);
  expect(records()[1]).toMatchObject({ result: "FAILED", status });
});

test("previews redact credentials and journals exclude request and response bodies", async () => {
  const secretInput = { id, name: `Resource ${syntheticKeys.secretKey}` };
  const upstream = { ...state, name: syntheticKeys.accessKey, password: "synthetic-password" };
  const definition = { ...operation, current: async (transport: Parameters<NonNullable<MutationOperation["current"]>>[0]) => {
    const { body } = await transport.request("show", { pathParams: { id } });
    return { state: { ...body as object, token: "synthetic-token" } };
  } };
  const client = coordinator([{ body: upstream }, { body: upstream }, { body: upstream }], {}, definition);
  const result = await client.run("change", secretInput, execute);
  const output = JSON.stringify(result);
  expect(output).not.toContain(syntheticKeys.accessKey);
  expect(output).not.toContain(syntheticKeys.secretKey);
  expect(output).not.toContain("synthetic-token");
  const log = readFileSync(journal, "utf8");
  expect(log).not.toContain("Resource");
  expect(log).not.toContain("name");
  expect(log).not.toContain(syntheticKeys.accessKey);
  expect(log).not.toContain(syntheticKeys.secretKey);
});

test("bulk confirmation binds the sorted full target set instead of its count", async () => {
  const definition: MutationOperation = { ...operation, current: undefined,
    prepare: () => ({ target: { kind: "resources", ids: [other, id] }, request: { pathParams: { id }, body: { ids: [other, id] } } }),
  };
  const client = coordinator([], {}, definition);
  expect(await client.run("change", input)).toMatchObject({ preview: {
    confirm: JSON.stringify(["example", "change", { ids: [id, other], kind: "resources" }]),
  } });
  expect(client.requests).toHaveLength(0);
});

test("export confirmation changes with the full filter payload", async () => {
  const definition: MutationOperation = { ...operation, current: undefined,
    prepare: (value) => ({ target: { kind: "export", payload: true }, request: { pathParams: { id }, body: value } }),
  };
  const client = coordinator([], {}, definition);
  const first = await client.run("change", input);
  const second = await client.run("change", { ...input, name: "Different filter" });
  expect(first.preview.confirm).not.toBe(second.preview.confirm);
  expect(first.preview.confirm).toContain('"digest":');
  expect(client.requests).toHaveLength(0);
});

test("create confirmation includes the exact proposed name and profile", async () => {
  const definition: MutationOperation = { ...operation, current: undefined,
    prepare: () => ({ target: { kind: "resource", name: "Exact Name" }, request: { pathParams: { id }, body: { name: "Exact Name" } } }),
  };
  const client = coordinator([], {}, definition);
  expect(await client.run("change", input)).toMatchObject({ preview: {
    confirm: JSON.stringify(["example", "change", { kind: "resource", name: "Exact Name" }]),
  } });
  await expect(client.run("change", input, { execute: true, confirm: "exact name" })).rejects.toMatchObject({ error: { code: "CONFIRM_MISMATCH" } });
  expect(client.requests).toHaveLength(0);
});

test("execution cannot be combined with an explicit dry run", async () => {
  const client = coordinator();
  await expect(client.run("change", input, { ...execute, dryRun: true })).rejects.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  expect(client.requests).toHaveLength(0);
});

test("inventory evidence and configured allowlists never enable an unregistered mutation", async () => {
  const client = coordinator();
  await expect(client.run("users-keys", input, execute)).rejects.toMatchObject({ error: { code: "OPERATION_BLOCKED" } });
  expect(client.requests).toHaveLength(0);
});

test("nested security administration fields are refused before upstream reads", async () => {
  const definition: MutationOperation = { ...operation,
    prepare: () => ({ target: { kind: "resource", id }, request: { pathParams: { id }, body: { nested: [{ access_control: [] }] } } }),
  };
  const client = coordinator([], {}, definition);
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  expect(client.requests).toHaveLength(0);
});

test("a missing current resource is not inferred to be an idempotent no-op", async () => {
  const client = coordinator([{ status: 404, body: { message: "Missing" } }]);
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "NOT_FOUND" } });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET"]);
  expect(existsSync(journal)).toBe(false);
});

test("approval cannot retarget the snapshotted request through caller input", async () => {
  const mutable = { ...input };
  const client = coordinator([{ body: state }, { body: state }, { body: changed }], {
    approval: () => { mutable.id = other; mutable.name = "Changed after preview"; return true; },
  });
  await client.run("change", mutable, execute);
  expect(client.requests[2]).toMatchObject({ url: `https://cloud.tenable.com/synthetic/resources/${id}`,
    init: { method: "PUT", body: '{"name":"Example"}' } });
});

test("a successful write with malformed output records remote success without replay", async () => {
  const client = coordinator([{ body: state }, { body: state }, { text: "not JSON" }]);
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "RESPONSE_INVALID", status: 200, auditId: expect.any(String) } });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET", "GET", "PUT"]);
  expect(records()[1]).toMatchObject({ result: "SUCCESS", status: 200 });
});

test("a failed freshness read records no send", async () => {
  const client = coordinator([{ body: state }, { status: 403, body: { message: "Permission changed" } }]);
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "PERMISSION_DENIED" } });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET", "GET"]);
  expect(records()[1]).toMatchObject({ result: "NOT_SENT" });
});

test("a journal with an invalid outcome refuses new mutations", async () => {
  await coordinator([{ body: state }, { body: state }, { body: changed }]).run("change", input, execute);
  const logged = records();
  logged[1]!.result = "UNRECOGNIZED";
  writeFileSync(journal, logged.map((record) => JSON.stringify(record)).join("\n") + "\n", { mode: 0o600 });
  const client = coordinator([{ body: state }]);
  await expect(client.run("change", input, { ...execute, intentId: "new-intent" })).rejects.toMatchObject({ error: { code: "INTENT_NOT_RECORDED" } });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET"]);
});

test.each([undefined, "   "])("an absent or blank journal override %j uses the private state directory", async (override) => {
  fixture.env.TENABLE_AXI_WRITE_LOG = override;
  journal = join(fixture.home, "state", "tenable-axi", "writes.log");
  await coordinator([{ body: state }, { body: state }, { body: changed }]).run("change", input, execute);
  expect(records()[1]).toMatchObject({ result: "SUCCESS" });
  expect(statSync(join(fixture.home, "state", "tenable-axi")).mode & 0o777).toBe(0o700);
});

test("failure to protect a Windows journal lock refuses the send", async () => {
  const files = privateFiles({ platform: "win32", acl(path, action) {
    if (path.endsWith(".lock") && action === "restrict") throw new Error("DACL denied");
  } });
  const client = coordinator([{ body: state }], {}, operation, files);
  await expect(client.run("change", input, execute)).rejects.toMatchObject({ error: { code: "INTENT_NOT_RECORDED" } });
  expect(client.requests.map(({ init }) => init.method)).toEqual(["GET"]);
  expect(existsSync(journal)).toBe(false);
});
