import { afterEach, expect, test } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
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

function shellArgs(command: string): string[] {
  return execFileSync("sh", ["-c", `set -- ${command}; printf '%s\\0' "$@"`], { encoding: "utf8" }).split("\0").slice(0, -1);
}

test.each(["initiative", "combination"])("%s list show hint preserves environment-only credentials", async (kind) => {
  const f = fixture(kind, "list");
  f.config({});
  const row = { id, ...(kind === "initiative" ? initiative : combination) };
  const listed = await f.run([kind, "list", "--config", f.path], [{ body: { [`${kind}s`]: [row] } }]);
  expect(listed.code).toBe(0);
  const args = shellArgs((listed.data.help as string[])[0]!.slice(4).replace("<id>", id));
  const shown = await f.run(args.slice(1), [{ body: row }]);
  expect(shown.code).toBe(0);
  expect(shown.data).toMatchObject({ [kind]: { id, name: row.name } });
  expect(shown.requests).toHaveLength(1);
  expect(shown.requests[0]!.url).toBe(`https://cloud.tenable.com/exposure-response/${kind}s/${id}`);
});

test.each(["initiative", "combination"].flatMap((kind) => [
  { kind, verb: "update", response: { id: other, name: "Different target" }, fields: "id" },
  { kind, verb: "delete", response: { id: other }, fields: "id" },
  { kind, verb: "update", response: { name: "Missing ID" }, fields: "id" },
  { kind, verb: "delete", response: { id: null }, fields: "id" },
  { kind, verb: "update", response: { id, name: "Malformed field", owner: null }, fields: "owner" },
]))("$kind $verb rejects malformed successful response $response with audit context", async ({ kind, verb, response, fields }) => {
  const f = fixture(kind, verb);
  const row = { id, ...(kind === "initiative" ? initiative : combination), name: "Old" };
  const reads = [...(verb === "delete" ? [{ body: { [`${kind}s`]: [row] } }] : []), { body: row }];
  const args = [...f.args, "--fields", fields];
  const preview = await f.run(args, [...reads]);
  expect(preview.code).toBe(0);
  const result = await f.run([...args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm],
    [...reads, ...reads, { body: response }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "RESPONSE_INVALID", operation: `${kind}s-${verb}`, status: 200,
    auditId: expect.any(String), message: expect.stringContaining("mutation may have been applied") } });
  expect(result.data).not.toHaveProperty("kind");
  expect(result.data).not.toHaveProperty("response");
  expect(result.requests.filter((request) => request.init.method !== "GET")).toHaveLength(1);
  const journal = readFileSync(f.journal, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(journal).toContainEqual(expect.objectContaining({ kind: "outcome", auditId: (result.data.error as { auditId: string }).auditId,
    operation: `${kind}s-${verb}`, result: "SUCCESS", status: 200 }));
});

test.each(["show", "list"])("%s redacts secrets before truncating nested and plain text", async (verb) => {
  const f = fixture("combination", verb);
  const secret = "sensitive-boundary-".repeat(2);
  f.env.TENABLE_AXI_SECRET_KEY = secret;
  const text = "a".repeat(969) + secret + "z".repeat(100);
  const row = { id, ...combination, description: text, query: { ...query, value: text } };
  const result = await f.run([...f.args, "--fields", "description,query"], [
    { body: verb === "show" ? row : { combinations: [row] } },
  ]);
  expect(result.code).toBe(0);
  expect(result.stdout).not.toContain(secret.slice(0, 31));
  expect(result.stdout).toContain("***redacted***");
  expect(result.stdout).toContain("truncated");
});

test("generated hints preserve shell-sensitive selectors and body paths literally", async () => {
  const f = fixture("combination", "update", { ...combination, description: "a".repeat(1001) });
  const special = "literal '$HOME `printf expanded` $(printf expanded)";
  const path = join(f.home, special + ".json");
  writeFileSync(path, readFileSync(f.file));
  const config = join(f.home, special + "-config.json");
  writeFileSync(config, JSON.stringify({ version: 1, profiles: { example: { writes: { allowWrites: true, operations: ["combinations-update"] } } } }), { mode: 0o600 });
  const args = ["combination", "update", "--id", id, "--body-file", path, "--config", config, "--profile", "example"];
  const old = { body: { id, ...combination, name: "Old" } };
  const preview = await f.run(args, [old]);
  expect(preview.code).toBe(0);
  const full = shellArgs((preview.data.help as string[])[0]!.slice(4, -" to read complete text".length));
  const followed = await f.run(full.slice(1), [old]);
  expect(followed.code).toBe(0);
  expect(followed.data).toMatchObject({ kind: "dry-run", preview: { proposed: { body: { description: "a".repeat(1001) } } } });
  const listArgs = ["combination", "list", "--config", config, "--profile", "example", "--limit", "1"];
  const listed = { body: { combinations: [{ id, ...combination }, { id: other, ...combination }] } };
  const first = await f.run(listArgs, [listed]);
  expect(first.code).toBe(0);
  const hints = first.data.help as string[];
  const show = shellArgs(hints[0]!.slice(4).replace("<id>", id));
  expect((await f.run(show.slice(1), [{ body: { id, ...combination } }])).code).toBe(0);
  const resume = shellArgs(hints[1]!.slice(4, -" to re-fetch the collection and resume".length).replace("<cursor>", first.data.cursor as string));
  const resumed = await f.run(resume.slice(1), [listed]);
  expect(resumed.code).toBe(0);
  expect(resumed.data).toMatchObject({ combinations: [{ id: other }], complete: true });
  expect(resumed.requests).toHaveLength(1);
});

test.each([null, { property: "cve.id", operator: "eq" }, { and: [{ or: [null] }] }, { or: [] }])(
  "malformed combination query %j fails across reads, continuation and write state", async (invalid) => {
    const f = fixture("combination", "update");
    const row = { id, ...combination, query: invalid };
    const show = await f.run(["combination", "show", "--id", id], [{ body: row }]);
    expect(show.code).toBe(1);
    expect(show.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
    const args = ["combination", "list", "--fields", "id,query"];
    const collection = { body: { combinations: [{ id: other, ...combination }, row] } };
    const first = await f.run([...args, "--limit", "1"], [collection]);
    expect(first.code).toBe(0);
    const resumed = await f.run([...args, "--cursor", first.data.cursor as string], [collection]);
    expect(resumed.code).toBe(1);
    expect(resumed.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
    const listed = await f.run(args, [{ body: { combinations: [row] } }]);
    expect(listed.code).toBe(1);
    const update = await f.run(f.args, [{ body: row }]);
    expect(update.code).toBe(1);
    expect(update.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
    expect(update.requests).toHaveLength(1);
    expect(existsSync(f.journal)).toBe(false);
  },
);

test.each(["create", "delete"])("combination %s refuses malformed existing query state", async (verb) => {
  const f = fixture("combination", verb);
  const result = await f.run(f.args, [{ body: { combinations: [{ id, name: combination.name }] } },
    { body: { id, ...combination, query: null } }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
  expect(result.requests.every((request) => request.init.method === "GET")).toBe(true);
  expect(existsSync(f.journal)).toBe(false);
});

test("initiative preview refuses malformed referenced queries", async () => {
  const f = fixture("initiative", "create", { ...initiative, combination_ids: [other] });
  const result = await f.run(f.args, [{ body: { initiatives: [] } },
    { body: { combinations: [{ id: other, ...combination, query: { and: [null] } }] } }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
  expect(existsSync(f.journal)).toBe(false);
});

test("combination reads preserve valid recursive and existence queries", async () => {
  const f = fixture("combination", "show");
  const nested = { and: [query, { or: [{ property: "cve.id", operator: "exists" }, { ...query, value: [7, 9] }] }] };
  const result = await f.run(f.args, [{ body: { id, ...combination, query: nested } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ combination: { query: nested } });
});

test.each(["initiative", "combination"])("%s lists re-fetch and resume without invented server parameters", async (kind) => {
  const f = fixture(kind, "list");
  const body = { [`${kind}s`]: [{ id, ...(kind === "initiative" ? initiative : combination), beta: true }, { id: other, ...(kind === "initiative" ? initiative : combination) }] };
  const first = await f.run([...f.args, "--limit", "1"], [{ body }]);
  expect(first.code).toBe(0);
  expect(first.data).toMatchObject({ count: 1, total: null, complete: false, cursor: expect.any(String) });
  expect(first.requests[0]!.url).toBe(`https://cloud.tenable.com/exposure-response/${kind}s`);
  const resumed = await f.run([...f.args, "--cursor", first.data.cursor as string], [{ body }]);
  expect(resumed.data).toMatchObject({ [`${kind}s`]: [{ id: other }], count: 1, complete: true });
  expect(resumed.requests).toHaveLength(1);
  expect(resumed.requests[0]!.url).toBe(first.requests[0]!.url);
});

test.each(["initiative", "combination"])("%s continuation commands stay small with long selected descriptions", async (kind) => {
  const f = fixture(kind, "list");
  const rows = Array.from({ length: 250 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
    name: `Synthetic ${index}`, description: "d".repeat(1024),
  }));
  const reply = { body: { [`${kind}s`]: rows } };
  const first = await f.run([...f.args, "--fields", "id,name,description", "--full"], [reply]);
  expect(first.code).toBe(0);
  expect(first.data).toMatchObject({ [`${kind}s`]: rows.slice(0, 100), count: 100, complete: false });
  expect(Buffer.byteLength(first.data.cursor as string)).toBeLessThan(1024);
  const command = (first.data.help as string[])[1]!.slice(4, -" to re-fetch the collection and resume".length)
    .replace("<cursor>", first.data.cursor as string);
  expect(Buffer.byteLength(command)).toBeLessThan(8192);
  const second = await f.run(shellArgs(command).slice(1), [reply]);
  expect(second.code).toBe(0);
  expect(second.data).toMatchObject({ [`${kind}s`]: rows.slice(100, 200), count: 100, complete: false });
  const nextCommand = (second.data.help as string[])[1]!.slice(4, -" to re-fetch the collection and resume".length)
    .replace("<cursor>", second.data.cursor as string);
  expect(Buffer.byteLength(nextCommand)).toBeLessThan(8192);
  const thirdPage = await f.run(shellArgs(nextCommand).slice(1), [reply]);
  expect(thirdPage.code).toBe(0);
  expect(thirdPage.data).toMatchObject({ [`${kind}s`]: rows.slice(200), count: 50, complete: true });
  expect(thirdPage.data).not.toHaveProperty("cursor");
});

test.each([
  { kind: "initiative", verb: "list", key: "initiatives" },
  { kind: "combination", verb: "list", key: "combinations" },
  { kind: "combination", verb: "filters", key: "filters" },
])("$kind $verb refuses continuation after collection reordering", async ({ kind, verb, key }) => {
  const f = fixture(kind, verb);
  const rows = [{ id, name: "First", operators: ["eq"] }, { id: other, name: "Second", operators: ["eq"] }];
  const args = [...f.args, "--fields", "name"];
  const first = await f.run([...args, "--limit", "1"], [{ body: { [key]: rows } }]);
  expect(first.code).toBe(0);
  const resumed = await f.run([...args, "--cursor", first.data.cursor as string], [{ body: { [key]: [rows[1], rows[0]] } }]);
  expect(resumed.code).toBe(2);
  expect(resumed.data).toMatchObject({ error: { code: "VALIDATION_ERROR", message: expect.stringContaining("restart without --cursor") } });
  expect(resumed.data).not.toHaveProperty(key);
});

test("combination type scopes both the request and resume cursor", async () => {
  const f = fixture("combination", "list");
  const reply = { body: { combinations: [{ id, name: "Curated" }, { id: other, name: "Other" }] } };
  const first = await f.run([...f.args, "--type", "tenable", "--limit", "1"], [reply]);
  expect(first.data).toMatchObject({ combinations: [{ type: "tenable" }] });
  expect(first.requests[0]!.url).toBe("https://cloud.tenable.com/exposure-response/combinations?type=tenable");
  const resumed = await f.run([...f.args, "--type", "tenable", "--cursor", first.data.cursor as string], [reply]);
  expect(resumed.code).toBe(0);
  expect(resumed.data).toMatchObject({ combinations: [{ id: other, type: "tenable" }], complete: true });
  expect(resumed.requests[0]!.url).toBe(first.requests[0]!.url);
  const changed = await f.run([...f.args, "--type", "private", "--cursor", first.data.cursor as string]);
  expect(changed.code).toBe(2);
  expect(changed.requests).toHaveLength(0);
});

test("resume re-fetches unreturned rows and redacts secrets without encoding row data", async () => {
  const f = fixture("combination", "list");
  const args = [...f.args, "--fields", "id,name,description"];
  const listed = { body: { combinations: [{ id, ...combination, description: "First" },
    { id: other, ...combination, description: syntheticKeys.secretKey, unused: "discard" }] } };
  const first = await f.run([...args, "--limit", "1"], [listed]);
  const saved = Buffer.from(first.data.cursor as string, "base64url").toString("utf8");
  expect(saved).not.toContain(syntheticKeys.secretKey); expect(saved).not.toContain("discard");
  const resumed = await f.run([...args, "--cursor", first.data.cursor as string], [listed]);
  expect(resumed.code).toBe(0);
  expect(resumed.data).toMatchObject({ combinations: [{ id: other, description: "***redacted***" }], complete: true });
  expect(resumed.requests).toHaveLength(1);
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

test("optional filter metadata stays absent through continuation", async () => {
  const f = fixture();
  const args = ["combination", "filters", "--fields", "property,operators,allowedValues,selectMultiValue"];
  const listed = { body: { filters: [
    { name: "cve.category", operators: ["eq"], allowedValues: ["ransomware"], selectMultiValue: true },
    { name: "cve.vulnerability_names", operators: ["eq", "exists"] },
    { name: "cve.zero_day", operators: ["eq"], allowedValues: [], selectMultiValue: false },
  ] } };
  const first = await f.run([...args, "--limit", "1"], [listed]);
  expect(first.code).toBe(0);
  expect(first.data).toMatchObject({ filters: [{ property: "cve.category", allowedValues: ["ransomware"], selectMultiValue: true }], complete: false });
  const resumed = await f.run([...args, "--cursor", first.data.cursor as string], [listed]);
  expect(resumed.code).toBe(0);
  expect(resumed.data).toMatchObject({ filters: [
    { property: "cve.vulnerability_names", operators: ["eq", "exists"] },
    { property: "cve.zero_day", operators: ["eq"], allowedValues: [], selectMultiValue: false },
  ], complete: true });
  expect((resumed.data.filters as object[])[0]).not.toHaveProperty("allowedValues");
  expect((resumed.data.filters as object[])[0]).not.toHaveProperty("selectMultiValue");
  expect(resumed.requests).toHaveLength(1);
});

test("optional filter metadata stays absent on the initial read", async () => {
  const f = fixture();
  const result = await f.run(["combination", "filters", "--fields", "property,allowedValues,selectMultiValue"], [
    { body: { filters: [{ name: "cve.vulnerability_names", operators: ["eq", "exists"] }] } },
  ]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ filters: [{ property: "cve.vulnerability_names" }], complete: true });
  expect((result.data.filters as object[])[0]).not.toHaveProperty("allowedValues");
  expect((result.data.filters as object[])[0]).not.toHaveProperty("selectMultiValue");
});

test.each([
  { field: "allowedValues", value: null }, { field: "allowedValues", value: [1] },
  { field: "selectMultiValue", value: null }, { field: "selectMultiValue", value: "true" },
])("malformed present $field metadata fails", async ({ field, value }) => {
  const f = fixture();
  const result = await f.run(["combination", "filters", "--fields", `property,${field}`], [
    { body: { filters: [{ name: "cve.category", operators: ["eq"], [field]: value }] } },
  ]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
  const args = ["combination", "filters", "--fields", `property,${field}`];
  const listed = { body: { filters: [
    { name: "cve.vulnerability_names", operators: ["eq"] },
    { name: "cve.category", operators: ["eq"], [field]: value },
  ] } };
  const first = await f.run([...args, "--limit", "1"], [listed]);
  expect(first.code).toBe(0);
  const resumed = await f.run([...args, "--cursor", first.data.cursor as string], [listed]);
  expect(resumed.code).toBe(1);
  expect(resumed.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
  expect(resumed.requests).toHaveLength(1);
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

test.each(["initiative", "combination"].flatMap((kind) =>
  ["create", "update", "delete"].map((verb) => ({ kind, verb }))))("$kind $verb full-text hints only preview", async ({ kind, verb }) => {
  const description = "a".repeat(1001);
  const body = { ...(kind === "initiative" ? initiative : combination), description };
  const f = fixture(kind, verb, body);
  const listed = { body: { [`${kind}s`]: verb === "create" ? [] : [{ id, name: body.name }] } };
  const old = { body: { id, ...body, name: "Old" } };
  const reads = verb === "create" ? [listed] : verb === "update" ? [old] : [listed, old];
  const preview = await f.run(f.args, [...reads]);
  expect(preview.code).toBe(0);
  const executed = await f.run([...f.args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm], [
    ...reads, ...reads, { body: verb === "delete" ? {} : { id, ...body } },
  ]);
  expect(executed.code).toBe(0);
  expect(executed.data).toMatchObject({ kind: "success" });
  const hint = (executed.data.help as string[])[0]!;
  const tokens = shellArgs(hint.slice("Run tenable-axi ".length, -" to read complete text".length));
  expect(tokens).not.toContain("--execute");
  expect(tokens).not.toContain("--confirm");
  expect(tokens).toContain("--full");
  const journal = readFileSync(f.journal, "utf8");
  const changed = { body: { id, ...body, description: "b".repeat(1001), ...(kind === "initiative" ? { scope: [third] } : {}) } };
  const replayReads = verb === "create" ? [listed] : verb === "update" ? [changed] : [listed, changed];
  const followed = await f.run(tokens, replayReads);
  expect(followed.code).toBe(0);
  expect(followed.data).toMatchObject({ kind: "dry-run", preview: { noop: false } });
  expect(followed.requests.every((request) => request.init.method === "GET")).toBe(true);
  expect(followed.data).not.toHaveProperty("help");
  expect(readFileSync(f.journal, "utf8")).toBe(journal);
});

test.each(["initiative", "combination"])("identical %s updates are no-ops", async (kind) => {
  const f = fixture(kind, "update");
  const result = await f.run([...f.args, "--execute"], [{ body: { id, ...(kind === "initiative" ? initiative : combination), beta: true } }]);
  expect(result.code).toBe(0); expect(result.data).toMatchObject({ kind: "noop" });
  expect(result.requests).toHaveLength(1); expect(existsSync(f.journal)).toBe(false);
});

test.each(["scope", "combination_ids", "tenable_ids"].flatMap((field) =>
  ["create", "update"].map((verb) => ({ field, verb }))))("initiative $verb ignores $field order", async ({ field, verb }) => {
  const body = { ...initiative, [field]: [other, third] };
  const f = fixture("initiative", verb, body);
  const result = await f.run([...f.args, "--execute"], [
    ...(verb === "create" ? [{ body: { initiatives: [{ id, name: body.name }] } }] : []),
    { body: { id, ...body, [field]: [third, other] } },
    ...(field === "scope" ? [] : [{ body: { combinations: [{ id: other, ...combination }, { id: third, ...combination }] } }]),
  ]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ kind: "noop" });
  expect(result.requests.every((request) => request.init.method === "GET")).toBe(true);
  expect(existsSync(f.journal)).toBe(false);
});

test.each(["scope", "combination_ids", "tenable_ids"])("initiative update detects changed %s membership", async (field) => {
  const f = fixture("initiative", "update", { ...initiative, [field]: [other, third] });
  const result = await f.run(f.args, [
    { body: { id, ...initiative, [field]: [other] } },
    ...(field === "scope" ? [] : [{ body: { combinations: [{ id: other, ...combination }, { id: third, ...combination }] } }]),
  ]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ kind: "dry-run", preview: { noop: false } });
});

test.each(["update", "delete"])("initiative %s tolerates membership reordering between state reads", async (verb) => {
  const body = { ...initiative, scope: [other, third], combination_ids: [other, third], tenable_ids: [other, third] };
  const f = fixture("initiative", verb, body);
  const listed = { body: { initiatives: [{ id, name: body.name }] } };
  const old = { body: { id, ...body, name: "Old" } };
  const reordered = { body: { id, ...body, name: "Old", scope: [third, other], combination_ids: [third, other], tenable_ids: [third, other] } };
  const selected = { body: { combinations: [{ id: other, ...combination }, { id: third, ...combination }] } };
  const initial = verb === "delete" ? [listed, old] : [old, selected];
  const fresh = verb === "delete" ? [listed, reordered] : [reordered, selected];
  const preview = await f.run(f.args, [...initial]);
  expect(preview.code).toBe(0);
  const result = await f.run([...f.args, "--execute", "--confirm", (preview.data.preview as { confirm: string }).confirm], [
    ...initial, ...fresh, { body: verb === "delete" ? {} : { id, ...body } },
  ]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ kind: "success" });
  expect(result.requests.at(-1)!.init.method).toBe(verb === "delete" ? "DELETE" : "PUT");
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
