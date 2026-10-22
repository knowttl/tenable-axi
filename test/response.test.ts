import { afterEach, expect, test } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decode } from "@toon-format/toon";
import { main } from "../src/cli.js";
import { mutationOperations, transportBindings } from "../src/catalogue.js";
import { constructWriteCoordinator } from "../src/writes-core.js";
import { fakeHttpsTenable, fakeTransport, syntheticKeys, type Reply } from "./support/fake-tenable.js";
import { localFixture } from "./support/local-cli.js";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const third = "00000000-0000-4000-8000-000000000003";
const query = { property: "cve.vpr.score", operator: "gte", value: 9 };
const combination = { name: "Synthetic combination", query, is_public: false };
const initiative = { name: "Synthetic initiative", scope: [other], combination_ids: [], tenable_ids: [], owner: other, sla_in_days: 7 };
const fixtures: ReturnType<typeof localFixture>[] = [];
function fixture(kind = "combination", verb = "create", body: unknown = kind === "combination" ? combination : initiative) {
  const local = localFixture(); fixtures.push(local);
  Object.assign(local.env, { TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey, TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey });
  local.config({ example: { writes: { allowWrites: true, operations: [`${kind}s-${verb}`] } } });
  const file = join(local.home, "body.json"); writeFileSync(file, JSON.stringify(body));
  const args = [kind, verb, "--profile", "example", ...(["show", "update", "delete"].includes(verb) ? ["--id", id] : []),
    ...(["create", "update"].includes(verb) ? ["--body-file", file] : [])];
  async function run(args: string[], replies: (Reply | "disconnect")[] = []) {
    const fake = fakeTransport(replies, transportBindings);
    let stdout = "";
    const previous = process.exitCode; process.exitCode = 0;
    try {
      await main(args, { credentials: { home: local.home, env: local.env }, stdout: { write: (chunk) => { stdout += chunk; } },
        transportFactory: () => fake.transport,
        writeCoordinatorFactory: (options) => constructWriteCoordinator(options, { operations: mutationOperations, bindings: transportBindings,
          fetch: fake.fetch, credentials: { home: local.home, env: local.env } }),
      });
      return { code: process.exitCode, data: decode(stdout) as Record<string, unknown>, stdout, requests: fake.requests };
    } finally { process.exitCode = previous; }
  }
  return { ...local, run, args, file, journal: join(local.home, "state/tenable-axi/writes.log") };
}
afterEach(() => { for (const f of fixtures.splice(0)) f.cleanup(); });

test.each(["initiative", "combination"])("%s lists resume locally without invented server parameters", async (kind) => {
  const f = fixture(kind, "list");
  const body = { [`${kind}s`]: [{ id, ...(kind === "initiative" ? initiative : combination), beta: true }, { id: other, ...(kind === "initiative" ? initiative : combination) }] };
  const first = await f.run([...f.args, "--limit", "1"], [{ body }]);
  expect(first.code).toBe(0);
  expect(first.data).toMatchObject({ count: 1, total: null, complete: false, cursor: expect.any(String) });
  expect(first.requests[0]!.url).toBe(`https://cloud.tenable.com/exposure-response/${kind}s`);
  const resumed = await f.run([...f.args, "--cursor", first.data.cursor as string], [{ body }]);
  expect(resumed.data).toMatchObject({ [`${kind}s`]: [{ id: other }], count: 1, complete: true });
  expect(resumed.requests).toHaveLength(0);
});

test("combination type scopes both the request and resume cursor", async () => {
  const f = fixture("combination", "list");
  const first = await f.run([...f.args, "--type", "tenable", "--limit", "1"], [{ body: { combinations: [{ id, name: "Curated" }, { id: other, name: "Other" }] } }]);
  expect(first.data).toMatchObject({ combinations: [{ type: "tenable" }] });
  expect(first.requests[0]!.url).toBe("https://cloud.tenable.com/exposure-response/combinations?type=tenable");
  const changed = await f.run([...f.args, "--type", "private", "--cursor", first.data.cursor as string]);
  expect(changed.code).toBe(2);
  expect(changed.requests).toHaveLength(0);
});

test("resume preserves unreturned rows and redacts secrets before encoding the cursor", async () => {
  const f = fixture("combination", "list");
  const args = [...f.args, "--fields", "id,name,description"];
  const first = await f.run([...args, "--limit", "1"], [{ body: { combinations: [{ id, ...combination, description: "First" },
    { id: other, ...combination, description: syntheticKeys.secretKey, unused: "discard" }] } }]);
  const saved = Buffer.from(first.data.cursor as string, "base64url").toString("utf8");
  expect(saved).not.toContain(syntheticKeys.secretKey); expect(saved).not.toContain("discard");
  const resumed = await f.run([...args, "--cursor", first.data.cursor as string]);
  expect(resumed.code).toBe(0);
  expect(resumed.data).toMatchObject({ combinations: [{ id: other, description: "***redacted***" }], complete: true });
  expect(resumed.requests).toHaveLength(0);
});

test("a malformed later row retains valid rows and exits with a failure", async () => {
  const f = fixture("initiative", "list");
  const result = await f.run(f.args, [{ body: { initiatives: [{ id, ...initiative }, { id: other, name: "Missing owner" }] } }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ initiatives: [{ id }], count: 1, complete: false, reason: "READ_FAILED", error: { code: "RESPONSE_INVALID" } });
});

test.each([
  { args: ["initiative", "list"], body: { initiatives: [] }, key: "initiatives" },
  { args: ["combination", "list"], body: { combinations: [] }, key: "combinations" },
  { args: ["combination", "filters"], body: { filters: [] }, key: "filters" },
])("$key empty success is definitive", async ({ args, body, key }) => {
  const f = fixture(); const result = await f.run(args, [{ body }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ [key]: [], count: 0, complete: true, message: expect.stringContaining(`0 ${key}`) });
});

test("combination filters map the documented property name and retain operator metadata", async () => {
  const f = fixture();
  const result = await f.run(["combination", "filters", "--fields", "property,operators,type"], [{ body: { filters: [{ name: "cve.vpr.score", operators: ["gte"], type: "Integer", beta: true }] } }]);
  expect(result.data).toMatchObject({ filters: [{ property: "cve.vpr.score", operators: ["gte"], type: "Integer" }] });
  expect(result.requests[0]!.url).toBe("https://cloud.tenable.com/exposure-response/combinations/allowed/filters");
});

test("initiative detail metrics preserve missing values and reject malformed counters", async () => {
  const f = fixture("initiative", "show");
  const metrics = { statistics: { total_assets: 0, total_findings: 2, beta: true }, trending: [{ date_generated: "2026-01-01", active_count: 2 }] };
  const result = await f.run([...f.args, "--fields", "id,statistics,trending"], [{ body: { id, ...initiative, ...metrics } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ initiative: { id, ...metrics } });
  expect((result.data.initiative as { statistics: object }).statistics).not.toHaveProperty("findings_remediated");
  const malformed = await f.run([...f.args, "--fields", "statistics"], [{ body: { id, ...initiative, statistics: { total_assets: "unknown" } } }]);
  expect(malformed.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
});

test.each(["initiative", "combination"])("%s show validates the selected response and truncates text", async (kind) => {
  const f = fixture(kind, "show");
  const result = await f.run([...f.args, "--fields", "id,name,description"], [{ body: { id, name: "Example", description: "a".repeat(1001), beta: true } }]);
  expect(result.code).toBe(0);
  expect(result.stdout).toContain("truncated, 1001 chars total");
  expect(result.stdout).toContain("--full");
  const wrong = await f.run(f.args, [{ body: { id: other, ...(kind === "initiative" ? initiative : combination) } }]);
  expect(wrong.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
});

test.each([
  { args: ["initiative", "list"], reply: { body: {} } },
  { args: ["initiative", "list"], reply: { body: { initiatives: [{ id, name: "Missing owner and SLA" }] } } },
  { args: ["combination", "filters"], reply: { body: { filters: [{ name: "cve.id", operators: "eq" }] } } },
  { args: ["combination", "list"], reply: { text: "not JSON" } },
  { args: ["initiative", "show", "--id", id], reply: { text: "" } },
])("malformed $args response stays an error", async ({ args, reply }) => {
  const f = fixture(); const result = await f.run(args, [reply]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
});

test.each([
  { policy: { allowWrites: false, operations: ["combinations-create"] }, forced: undefined, code: "WRITES_DISABLED" },
  { policy: { allowWrites: true, operations: [] }, forced: undefined, code: "OPERATION_NOT_WRITABLE" },
  { policy: { allowWrites: true, operations: ["combinations-create"] }, forced: "true", code: "WRITES_DISABLED" },
])("writes refuse $code without reading or sending", async ({ policy, forced, code }) => {
  const f = fixture(); f.config({ example: { writes: policy } }); f.env.TENABLE_AXI_READ_ONLY = forced;
  const result = await f.run(f.args);
  expect(result.code).toBe(1); expect(result.data).toMatchObject({ error: { code } });
  expect(result.requests).toHaveLength(0); expect(existsSync(f.journal)).toBe(false);
});

test("confirmation mismatch reads preview state but sends no mutation", async () => {
  const f = fixture();
  const result = await f.run([...f.args, "--execute", "--confirm", "wrong"], [{ body: { combinations: [] } }]);
  expect(result.data).toMatchObject({ error: { code: "CONFIRM_MISMATCH" } });
  expect(result.requests).toHaveLength(1); expect(result.requests[0]!.init.method).toBe("GET");
  expect(existsSync(f.journal)).toBe(false);
});

test.each(["initiative", "combination"])("%s creation sends once after preview and records a redacted journal", async (kind) => {
  const f = fixture(kind);
  const empty = { body: { [`${kind}s`]: [] } };
  const preview = await f.run(f.args, [empty]);
  expect(preview.code).toBe(0); expect(preview.data).toMatchObject({ kind: "dry-run", preview: { proposed: { body: kind === "initiative" ? initiative : combination } } });
  const confirm = (preview.data.preview as { confirm: string }).confirm;
  const result = await f.run([...f.args, "--execute", "--confirm", confirm], [empty, empty, { body: { id } }]);
  expect(result.code).toBe(0); expect(result.data).toMatchObject({ kind: "success", response: { id }, auditId: expect.any(String) });
  expect(result.requests.map((r) => r.init.method)).toEqual(["GET", "GET", "POST"]);
  expect(JSON.parse(result.requests[2]!.init.body as string)).toEqual(kind === "initiative" ? initiative : combination);
  const journal = readFileSync(f.journal, "utf8");
  expect(journal).toContain('"result":"SUCCESS"'); expect(journal).not.toMatch(/Synthetic|headers|scope|sentinel/);
});

test.each([true, false])("combination preview makes public=%s visibility explicit", async (is_public) => {
  const f = fixture("combination", "create", { ...combination, is_public });
  const result = await f.run(f.args, [{ body: { combinations: [] } }]);
  expect(result.data).toMatchObject({ preview: { proposed: { body: { is_public } }, effect: expect.stringContaining("organization") } });
});

test.each(["initiative", "combination"])("identical %s updates are no-ops", async (kind) => {
  const f = fixture(kind, "update");
  const result = await f.run([...f.args, "--execute"], [{ body: { id, ...(kind === "initiative" ? initiative : combination), beta: true } }]);
  expect(result.code).toBe(0); expect(result.data).toMatchObject({ kind: "noop" });
  expect(result.requests).toHaveLength(1); expect(existsSync(f.journal)).toBe(false);
});

test("identical existing creates are no-ops but duplicate names with different state conflict", async () => {
  const f = fixture();
  const listed = { body: { combinations: [{ id, name: combination.name }] } };
  const noop = await f.run([...f.args, "--execute"], [listed, { body: { id, ...combination } }]);
  expect(noop.data).toMatchObject({ kind: "noop" });
  const conflict = await f.run(f.args, [listed, { body: { id, ...combination, is_public: true } }]);
  expect(conflict.data).toMatchObject({ error: { code: "CONFLICT" } });
});

test.each(["initiative", "combination"])("%s updates refuse changed preview state", async (kind) => {
  const f = fixture(kind, "update");
  const old = { id, ...(kind === "initiative" ? initiative : combination), name: "Old" };
  const preview = await f.run(f.args, [{ body: old }]);
  const result = await f.run([...f.args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm], [{ body: old }, { body: { ...old, name: "Changed" } }]);
  expect(result.data).toMatchObject({ error: { code: "PREVIEW_CHANGED" } });
  expect(result.requests.map((r) => r.init.method)).toEqual(["GET", "GET"]);
  expect(readFileSync(f.journal, "utf8")).toContain('"result":"NOT_SENT"');
});

test.each(["initiative", "combination"])("%s delete verifies absence and deletes present targets only after confirmation", async (kind) => {
  const f = fixture(kind, "delete");
  const absent = await f.run([...f.args, "--execute"], [{ body: { [`${kind}s`]: [] } }]);
  expect(absent.data).toMatchObject({ kind: "noop" });
  const listed = { body: { [`${kind}s`]: [{ id, name: "Example" }] } }, detail = { body: { id, name: "Example" } };
  const preview = await f.run(f.args, [listed, detail]);
  const result = await f.run([...f.args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm], [listed, detail, listed, detail, { body: {} }]);
  expect(result.code).toBe(0); expect(result.data).toMatchObject({ kind: "success" });
  expect(result.requests.map((r) => r.init.method)).toEqual(["GET", "GET", "GET", "GET", "DELETE"]);
  expect(result.requests[4]!.init.body).toBeUndefined();
});

test.each(["initiative", "combination"])("%s update sends the complete replacement body", async (kind) => {
  const f = fixture(kind, "update"); const body = kind === "initiative" ? initiative : combination;
  const old = { body: { id, ...body, name: "Old" } };
  const preview = await f.run(f.args, [old]);
  const result = await f.run([...f.args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm], [old, old, { body: { id, ...body } }]);
  expect(result.code).toBe(0); expect(result.requests.map((r) => r.init.method)).toEqual(["GET", "GET", "PUT"]);
  expect(JSON.parse(result.requests[2]!.init.body as string)).toEqual(body);
});

test.each([403, 409])("server reject %s records failure without replay", async (status) => {
  const f = fixture(); const empty = { body: { combinations: [] } };
  const preview = await f.run(f.args, [empty]);
  const result = await f.run([...f.args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm], [empty, empty, { status, body: { message: `Rejected ${syntheticKeys.secretKey}` } }]);
  expect(result.code).toBe(1); expect(result.data).toMatchObject({ error: { status, auditId: expect.any(String) } });
  expect(result.stdout).not.toContain(syntheticKeys.secretKey);
  expect(result.requests).toHaveLength(3); expect(readFileSync(f.journal, "utf8")).toContain('"result":"FAILED"');
});

test("an interrupted mutation reports unknown outcome and never replays", async () => {
  const f = fixture(); const empty = { body: { combinations: [] } };
  const preview = await f.run(f.args, [empty]);
  const result = await f.run([...f.args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm], [empty, empty, "disconnect"]);
  expect(result.data).toMatchObject({ error: { code: "OUTCOME_UNKNOWN", auditId: expect.any(String) } });
  expect(result.requests).toHaveLength(3); expect(result.stdout).not.toContain(syntheticKeys.secretKey);
});

test.each([
  { kind: "initiative", body: { ...initiative, owner: "not-a-uuid" } },
  { kind: "initiative", body: { ...initiative, scope: Array(11).fill(other) } },
  { kind: "initiative", body: { ...initiative, combination_ids: Array(11).fill(other) } },
  { kind: "initiative", body: { ...initiative, sla_in_days: 1.5 } },
  { kind: "combination", body: { ...combination, query: { and: Array(7).fill(query) } } },
  { kind: "combination", body: { ...combination, query: { and: [{ or: Array(4).fill(query) }, { or: Array(3).fill(query) }] } } },
  { kind: "combination", body: { ...combination, query: { property: "cve.id", operator: "eq" } } },
  { kind: "combination", body: { ...combination, query: { ...query, access_control: [] } } },
  { kind: "initiative", body: { ...initiative, permissions: [] } },
])("invalid $kind body fails before credentials or HTTP", async ({ kind, body }) => {
  const f = fixture(kind, "create", body); delete f.env.TENABLE_AXI_ACCESS_KEY;
  const result = await f.run(f.args);
  expect(result.code).toBe(2); expect(result.requests).toHaveLength(0);
});

test("initiative previews enforce seventeen queries across referenced combinations", async () => {
  const f = fixture("initiative", "create", { ...initiative, combination_ids: [id, other], tenable_ids: [third] });
  const six = { and: Array(6).fill(query) };
  const result = await f.run(f.args, [{ body: { initiatives: [] } }, { body: { combinations: [
    { id, ...combination, query: six }, { id: other, ...combination, query: six }, { id: third, ...combination, query: six },
  ] } }]);
  expect(result.code).toBe(1); expect(result.stdout).toContain("seventeen");
  expect(result.requests.every((request) => request.init.method === "GET")).toBe(true);
});

test("an initiative with seventeen queries executes within the shared request budget", async () => {
  const f = fixture("initiative", "create", { ...initiative, combination_ids: [id, other], tenable_ids: [third] });
  const empty = { body: { initiatives: [] } };
  const selected = { body: { combinations: [{ id, ...combination, query: { and: Array(6).fill(query) } },
    { id: other, ...combination, query: { or: Array(6).fill(query) } }, { id: third, ...combination, query: { and: Array(5).fill(query) } }] } };
  const preview = await f.run(f.args, [empty, selected]);
  expect(preview.code).toBe(0);
  const result = await f.run([...f.args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm], [empty, selected, empty, selected, { body: { id } }]);
  expect(result.code).toBe(0);
  expect(result.requests.map((request) => request.init.method)).toEqual(["GET", "GET", "GET", "GET", "POST"]);
});

test("an unavailable selected combination prevents an initiative write", async () => {
  const f = fixture("initiative", "create", { ...initiative, combination_ids: [id] });
  const result = await f.run(f.args, [{ body: { initiatives: [] } }, { body: { combinations: [] } }]);
  expect(result.data).toMatchObject({ error: { code: "NOT_FOUND" } });
  expect(existsSync(f.journal)).toBe(false);
});

test("a changed referenced combination refuses the initiative send", async () => {
  const f = fixture("initiative", "create", { ...initiative, combination_ids: [id] });
  const empty = { body: { initiatives: [] } }, selected = { body: { combinations: [{ id, ...combination }] } };
  const preview = await f.run(f.args, [empty, selected]);
  const changed = { body: { combinations: [{ id, ...combination, query: { ...query, value: 7 } }] } };
  const result = await f.run([...f.args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm], [empty, selected, empty, changed]);
  expect(result.data).toMatchObject({ error: { code: "PREVIEW_CHANGED" } });
  expect(result.requests).toHaveLength(4);
  expect(readFileSync(f.journal, "utf8")).toContain('"result":"NOT_SENT"');
});

test("an omitted description does not treat a different existing create as identical", async () => {
  const f = fixture();
  const result = await f.run([...f.args, "--execute"], [{ body: { combinations: [{ id, ...combination }] } },
    { body: { id, ...combination, description: "Existing description" } }]);
  expect(result.data).toMatchObject({ error: { code: "CONFLICT" } });
  expect(existsSync(f.journal)).toBe(false);
});

test.each([
  ["initiative", "list", "--unknown"], ["combination", "list", "unexpected"],
  ["combination", "list", "--limit", "1", "--limit", "2"], ["initiative", "show"],
  ["initiative", "list", "--all", "--limit", "1"], ["combination", "create", "--execute", "--dry-run"],
  ["combination", "create", "--fields", "name"], ["initiative", "show", "--id", id, "--fields", "query"],
])("invalid flags on %j fail before credentials or HTTP", async (...args) => {
  const f = fixture(); delete f.env.TENABLE_AXI_ACCESS_KEY;
  const result = await f.run(args);
  expect(result.code).toBe(2); expect(result.data).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  expect(result.requests).toHaveLength(0); expect(result.stdout).toContain("Valid flags");
});

test("update permission denial gives the documented EDIT privilege", async () => {
  const f = fixture("initiative", "update");
  const old = { body: { id, ...initiative, name: "Old" } };
  const preview = await f.run(f.args, [old]);
  const result = await f.run([...f.args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm], [old, old, { status: 403, body: { message: "Denied" } }]);
  expect(result.code).toBe(1);
  expect(result.stdout).toContain("EXPOSURE_MANAGEMENT.EM_ER.EM_ER.EDIT");
});

test("the CLI reads initiatives over verified fake HTTPS without a live tenant", async () => {
  const f = fixture("initiative", "list");
  const server = await fakeHttpsTenable([{ body: { initiatives: [{ id, ...initiative }] } }]);
  try {
    const result = await f.cli(f.args, {}, () => server.transport(transportBindings));
    expect(result.code).toBe(0); expect(result.data).toMatchObject({ initiatives: [{ id, owner: other, slaInDays: 7 }] });
    expect(server.requests[0]).toMatchObject({ method: "GET", url: "/exposure-response/initiatives" });
  } finally { await server.close(); }
});
