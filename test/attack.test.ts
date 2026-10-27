import { afterEach, expect, test, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { transportBindings } from "../src/catalogue.js";
import { fakeHttpsTenable, fakeTransport, syntheticKeys, type Reply } from "./support/fake-tenable.js";
import { localFixture } from "./support/local-cli.js";

const path = { vector_id: "path-1", name: "Example attack path", priority: 8 };
const technique = { serial_id: 42, name: "Example technique", assets_ids: ["asset-1", "asset-2"] };
const log = { connector_id: 7, status: "FAILED", sync_timestamp: { start: "2026-01-05T09:00:00Z" },
  sync_uuid: "sync-1", type: "FULL", trigger_reason: "SCHEDULE", sync_stages_info: [], sync_logs: [] };
const page = (data: unknown[], total?: number, offset = 0) => ({ data,
  pagination: { offset, limit: 100, ...(total === undefined ? {} : { total }) } });
const fixtures: ReturnType<typeof localFixture>[] = [];
function fixture() {
  const local = localFixture();
  fixtures.push(local);
  Object.assign(local.env, { TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey, TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey });
  return { ...local, async run(args: string[], replies: (Reply | "disconnect" | "hang")[] = []) {
    const fake = fakeTransport(replies, transportBindings);
    return { ...await local.cli(args, {}, () => fake.transport), requests: fake.requests };
  } };
}
afterEach(() => { for (const f of fixtures.splice(0)) f.cleanup(); vi.useRealTimers(); });

test("attack paths use the published route with AI off and the minimum wire limit through verified HTTPS", async () => {
  const fake = await fakeHttpsTenable([{ body: page([{ ...path, beta: true }], 1) }]);
  try {
    const result = await fixture().cli(["attack-path", "list", "--limit", "1"], {}, () => fake.transport(transportBindings));
    expect(result.code).toBe(0);
    expect(result.data).toMatchObject({ attackPaths: [{ id: "path-1", name: path.name, priority: 8 }], count: 1, total: 1, complete: true });
    expect(fake.requests[0]).toMatchObject({ method: "POST", body: "",
      url: "/api/v1/t1/apa/top-attack-paths/search?exclude_resolved=true&run_ai_summarization=false&offset=0&limit=100" });
  } finally { await fake.close(); }
});

test("attack techniques render their serial identifier and affected asset count without requiring unrendered fields", async () => {
  const result = await fixture().run(["attack-technique", "list"], [{ body: page([{ ...technique, beta: true }], 1) }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ attackTechniques: [{ id: 42, name: technique.name, affectedAssets: 2 }], complete: true });
  expect(new URL(result.requests[0]!.url).pathname).toBe("/api/v1/t1/apa/top-attack-techniques/search");
  expect(new URL(result.requests[0]!.url).searchParams.has("run_ai_summarization")).toBe(false);
});

test("attack search maps repeated filters, sorting, resolution and explicit AI selection to server parameters", async () => {
  const result = await fixture().run(["attack-path", "list", "--include-resolved", "--run-ai-summarization", "true",
    "--offset", "5", "--sort", "priority:desc", "--filter", "priority gte 8", "--filter", "critical_asset eq true"],
  [{ body: page([path], 6, 5) }]);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.requests[0]!.init.body as string)).toEqual({ operator: "AND", value: [
    { property: "priority", operator: "gte", value: 8 }, { property: "critical_asset", operator: "eq", value: true },
  ] });
  const query = new URL(result.requests[0]!.url).searchParams;
  expect(Object.fromEntries(query)).toEqual({ exclude_resolved: "false", run_ai_summarization: "true", sort: "priority:desc", offset: "5", limit: "100" });
});

test.each(["attack-path", "attack-technique"])("%s supports its documented two-level filter file", async (kind) => {
  const f = fixture();
  const file = join(f.home, "filters.json");
  const body = { operator: kind === "attack-path" ? "AND" : "and", value: [
    { operator: kind === "attack-path" ? "OR" : "or", value: [{ property: "name", operator: "contains", value: "example" }] },
  ] };
  writeFileSync(file, JSON.stringify(body));
  const result = await f.run([kind, "list", "--filter-file", file, "--sort", kind === "attack-path" ? "name:asc" : "name:Ascending"], [{ body: page([], 0) }]);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.requests[0]!.init.body as string)).toEqual(body);
});

test.each([
  { property: "unreviewed", operator: "eq", value: "example" },
  { property: "priority", operator: "gte", value: 1.5 },
  { property: "name", operator: "in", value: ["example", 1] },
  { operator: "and", value: [{ property: "priority", operator: "gte", value: 8 }] },
  { operator: "AND", value: [{ operator: "OR", value: [{ operator: "AND", value: [] }] }] },
  { property: "name", operator: "eq", value: "example", ignored: true },
])("rejects unsupported filter-file grammar before credentials: %j", async (body) => {
  const f = fixture();
  delete f.env.TENABLE_AXI_SECRET_KEY;
  const file = join(f.home, "filters.json");
  writeFileSync(file, JSON.stringify(body));
  const result = await f.run(["attack-path", "list", "--filter-file", file]);
  expect(result.code).toBe(2);
  expect(result.requests).toHaveLength(0);
  expect(result.data).toMatchObject({ error: { message: expect.stringContaining("Invalid documented filter") } });
});

test("connector logs send only supported selectors and render the sync start timestamp", async () => {
  const result = await fixture().run(["connector", "logs", "--connector-id", "7", "--status", "FAILED",
    "--start-date", "2026-01-01", "--end-date", "2026-02-01", "--limit", "1"], [{ body: { items: [{ ...log, beta: "new" }], total_count: 1 } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ logs: [{ connectorId: 7, status: "FAILED", timestamp: "2026-01-05T09:00:00Z" }], count: 1, total: 1, complete: true });
  expect(result.requests[0]!.init.method).toBe("GET");
  expect(new URL(result.requests[0]!.url).search).toBe("?connector_id=7&status=FAILED&start_date=2026-01-01&end_date=2026-02-01");
});

test("denied connector logs explain their own privilege without requiring Administrator for ordinary inventory reads", async () => {
  const result = await fixture().run(["connector", "logs"], [{ status: 403, body: { detail: { display_message: "Denied", msg: "Access refused" } } }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "PERMISSION_DENIED", operation: "connectors-logs" } });
  expect(result.data).not.toHaveProperty("logs");
  expect(JSON.stringify(result.data.help)).toContain("ordinary inventory reads do not require Administrator");
});

test("failed connector syncs show the first failed stage and first error summary", async () => {
  const result = await fixture().run(["connector", "logs"], [{ body: { items: [{ ...log,
    sync_stages_info: [{ name: "read", status: "SUCCEEDED" }, { name: "import", status: "FAILED" }, { name: "finish", status: "FAILED" }],
    sync_logs: [{ level: "INFO", text: "started" }, { level: "ERROR", summarized_text: "Import failed", text: "full failure" }, { level: "ERROR", text: "later" }],
  }] } }]);
  expect(result.code).toBe(0);
  expect(result.data.logs).toMatchObject([{ syncUuid: "sync-1", type: "FULL", triggerReason: "SCHEDULE", failedStage: "import", error: "Import failed" }]);
});

test.each([
  { sync_stages_info: [{ name: "import", status: "SUCCEEDED" }], sync_logs: [{ level: "INFO", text: "done" }] },
  { sync_stages_info: undefined, sync_logs: undefined },
])("successful connector syncs show null failure details: %j", async (details) => {
  const result = await fixture().run(["connector", "logs"], [{ body: { items: [{ ...log, status: "SUCCEEDED",
    ...details,
  }] } }]);
  expect(result.code).toBe(0);
  expect(result.data.logs).toMatchObject([{ failedStage: null, error: null }]);
});

test("connector error text falls back to full text and stays redacted through truncation and resume", async () => {
  const f = fixture();
  const entry = { ...log, sync_logs: [{ level: "ERROR", text: `${syntheticKeys.secretKey} ${"x".repeat(1200)}` }] };
  const first = await f.run(["connector", "logs", "--limit", "1"], [{ body: { items: [entry, entry] } }]);
  expect(first.code).toBe(0);
  expect(first.data.logs).toMatchObject([{ error: expect.stringContaining("chars total") }]);
  expect(first.stdout).not.toContain(syntheticKeys.secretKey);
  const second = await f.run(["connector", "logs", "--full", "--cursor", first.data.cursor as string]);
  expect(second.code).toBe(0);
  expect(second.data.logs).toMatchObject([{ error: expect.stringContaining("x".repeat(1200)) }]);
  expect(second.stdout).not.toContain(syntheticKeys.secretKey);
  expect(second.requests).toHaveLength(0);
});

test.each([
  ["attack-path", "list", { data: [] }], ["attack-technique", "list", { data: [] }], ["connector", "logs", { items: [] }],
] as const)("%s %s empty success is definitive while absent totals stay unknown", async (noun, verb, body) => {
  const result = await fixture().run([noun, verb], [{ body }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ count: 0, total: null, complete: true, message: expect.stringContaining("0 ") });
});

test.each([
  ["attack-path", "list", { data: [{ ...path, priority: "high" }] }],
  ["attack-technique", "list", { data: [{ serial_id: 42, name: "missing assets" }] }],
  ["connector", "logs", { items: [{ ...log, sync_timestamp: {} }] }],
  ["connector", "logs", {}], ["attack-path", "list", { items: [] }],
  ["attack-path", "list", { data: [], pagination: { offset: 0, limit: 100, total: "unknown" } }],
  ["attack-path", "list", page([], 1)],
] as const)("%s %s malformed success fails without plausible empty data: %j", async (noun, verb, body) => {
  const result = await fixture().run([noun, verb], [{ body }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
  expect(result.data).not.toHaveProperty("count");
});

test.each([
  ["attack-path", "list", "--unknown"], ["attack-path", "list", "--limit", "0"],
  ["attack-path", "list", "--all", "--limit", "1"], ["attack-path", "list", "--run-ai-summarization", "yes"],
  ["attack-path", "list", "--sort", "priority:sideways"], ["attack-path", "list", "--limit", "1", "--limit", "2"],
  ["attack-path", "list", "--cursor", "bad", "--offset", "0"], ["attack-path", "list", "--filter", "name eq invalid-json"],
  ["attack-path", "list", "--filter", 'name eq "example"', "--filter-file", "unused.json"],
  ["attack-technique", "list", "--run-ai-summarization", "true"],
  ["connector", "logs", "--connector-id", "-1"], ["connector", "logs", "--status", "RUNNING"],
  ["connector", "logs", "--start-date", "2026-01-01"],
  ["connector", "logs", "--start-date", "2026-02-30", "--end-date", "2026-03-01"],
  ["connector", "logs", "--start-date", "2026-02-01", "--end-date", "2026-01-01"],
  ["connector", "logs", "--offset", "1"], ["connector", "logs", "unexpected"],
])("rejects invalid input before credentials and lists valid flags: %j", async (...args) => {
  const f = fixture();
  delete f.env.TENABLE_AXI_SECRET_KEY;
  const result = await f.run(args);
  expect(result.code).toBe(2);
  expect(result.requests).toHaveLength(0);
  expect(result.data).toMatchObject({ help: [expect.stringContaining("--limit")] });
});

test("small attack windows retain excess rows and resume without re-fetching or skipping them", async () => {
  const f = fixture();
  const first = await f.run(["attack-path", "list", "--limit", "1"], [{ body: page([path, { ...path, vector_id: "path-2" }, { ...path, vector_id: "path-3" }], 3) }]);
  expect(first.data).toMatchObject({ count: 1, total: 3, complete: false, reason: "LIMIT" });
  const second = await f.run(["attack-path", "list", "--limit", "2", "--cursor", first.data.cursor as string]);
  expect(second.code).toBe(0);
  expect(second.data).toMatchObject({ attackPaths: [{ id: "path-2" }, { id: "path-3" }], count: 2, total: 3, complete: true });
  expect(second.requests).toHaveLength(0);
});

test("attack all reads sequential offsets and keeps unknown totals unknown", async () => {
  const result = await fixture().run(["attack-technique", "list", "--all", "--fields", "id"], [
    { body: page(Array.from({ length: 1000 }, (_, serial_id) => ({ serial_id }))) },
    { body: page([{ serial_id: 1000 }], undefined, 1000) },
  ]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ count: 1001, total: null, complete: true });
  expect(result.requests.map((request) => new URL(request.url).searchParams.get("offset"))).toEqual(["0", "1000"]);
});

test("unpaged connector logs retain bounded overflow for local resume", async () => {
  const f = fixture();
  const first = await f.run(["connector", "logs", "--limit", "1"], [{ body: { items: [log, { ...log, connector_id: 8 }], total_count: 2 } }]);
  const second = await f.run(["connector", "logs", "--cursor", first.data.cursor as string]);
  expect(second.data).toMatchObject({ logs: [{ connectorId: 8 }], total: 2, complete: true });
  expect(second.requests).toHaveLength(0);
});

test("connector totals beyond unpaged results report unavailable history without a false resume promise", async () => {
  const result = await fixture().run(["connector", "logs"], [{ body: { items: [log], total_count: 10 } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ count: 1, total: 10, complete: false, reason: "UPSTREAM_UNPAGED" });
  expect(result.data).not.toHaveProperty("cursor");
  expect(JSON.stringify(result.data.help)).toContain("no server paging");
});

test.each([
  ["attack-path", "list", "--include-resolved"], ["attack-path", "list", "--sort", "name:asc"],
  ["attack-path", "list", "--filter", 'name eq "changed"'], ["attack-path", "list", "--fields", "id"],
  ["attack-technique", "list"],
])("resume refuses changed request scope before HTTP: %j", async (...args) => {
  const f = fixture();
  const first = await f.run(["attack-path", "list", "--limit", "1"], [{ body: page([path, path], 2) }]);
  const changed = await f.run([...args, "--cursor", first.data.cursor as string]);
  expect(changed.code).toBe(2);
  expect(changed.requests).toHaveLength(0);
  expect(changed.data).toMatchObject({ error: { message: expect.stringContaining("Cursor belongs") } });
});

test.each([
  { body: page([path], 2, 0) }, { body: page([{ ...path, vector_id: "path-2", name: 1 }], 2, 1) },
  { status: 403, body: { message: "Denied" } }, { body: page([], 2, 1) },
] as Reply[])("partial paging failures retain valid rows and exit nonzero", async (reply) => {
  const result = await fixture().run(["attack-path", "list", "--all"], [{ body: page([path], 2) }, reply]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ attackPaths: [{ id: "path-1" }], count: 1, complete: false, cursor: expect.any(String), error: { code: expect.any(String) } });
});

test("deadline stops normally and preserves the next offset for resume", async () => {
  vi.useFakeTimers();
  const f = fixture();
  const pending = f.run(["attack-path", "list", "--all"], [{ body: page([path], 2) }, "hang"]);
  await vi.advanceTimersByTimeAsync(20000);
  const first = await pending;
  expect(first.code).toBe(0);
  expect(first.data).toMatchObject({ count: 1, complete: false, reason: "DEADLINE_EXCEEDED" });
  expect(vi.getTimerCount()).toBe(0);
  const resumed = await f.run(["attack-path", "list", "--all", "--cursor", first.data.cursor as string], [{ body: page([{ ...path, vector_id: "path-2" }], 2, 1) }]);
  expect(resumed.data).toMatchObject({ attackPaths: [{ id: "path-2" }], complete: true });
});

test("full text leaves the ten thousand row budget in force", async () => {
  const result = await fixture().run(["attack-path", "list", "--all", "--full", "--fields", "id"],
    Array.from({ length: 10 }, (_, pageIndex) => ({ body: page(Array.from({ length: 1000 }, (_, index) => ({ vector_id: `path-${pageIndex * 1000 + index}` })), 10001, pageIndex * 1000) })));
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ count: 10000, complete: false, reason: "ROW_BUDGET_EXCEEDED", cursor: expect.any(String) });
  expect(result.requests).toHaveLength(10);
});

test("request budget stops normally and resumes with the next unfetched offset", async () => {
  const f = fixture();
  const first = await f.run(["attack-path", "list", "--all"], Array.from({ length: 20 }, (_, offset) => ({
    body: page([{ ...path, vector_id: `path-${offset}` }], 21, offset),
  })));
  expect(first.code).toBe(0);
  expect(first.data).toMatchObject({ count: 20, total: 21, complete: false, reason: "REQUEST_BUDGET_EXCEEDED" });
  expect(first.requests).toHaveLength(20);
  const resumed = await f.run(["attack-path", "list", "--all", "--cursor", first.data.cursor as string],
    [{ body: page([{ ...path, vector_id: "path-20" }], 21, 20) }]);
  expect(resumed.data).toMatchObject({ attackPaths: [{ id: "path-20" }], count: 1, complete: true });
  expect(new URL(resumed.requests[0]!.url).searchParams.get("offset")).toBe("20");
});

test("repeated attack data at an advancing offset is a partial failure", async () => {
  const result = await fixture().run(["attack-path", "list", "--all"], [
    { body: page([path], 2) }, { body: page([path], 2, 1) },
  ]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ count: 1, complete: false, error: { code: "RESPONSE_INVALID", message: expect.stringContaining("repeated") } });
});

test("selected log details and buffered continuations redact secrets before rendering", async () => {
  const f = fixture();
  const args = ["connector", "logs", "--limit", "1", "--fields", "connectorId,sync_logs"];
  const entry = { ...log, sync_logs: [{ text: `${syntheticKeys.secretKey} ${"x".repeat(1200)}`, token: "synthetic-token" }] };
  const first = await f.run(args, [{ body: { items: [entry, entry], total_count: 2 } }]);
  expect(first.code).toBe(0);
  expect(first.stdout).not.toContain(syntheticKeys.secretKey);
  expect(first.stdout).not.toContain("synthetic-token");
  expect(JSON.stringify(first.data.logs)).toContain("chars total");
  const cursor = Buffer.from(first.data.cursor as string, "base64url").toString("utf8");
  expect(cursor).not.toContain(syntheticKeys.secretKey);
  expect(cursor).not.toContain("synthetic-token");
  const second = await f.run([...args, "--full", "--cursor", first.data.cursor as string]);
  expect(second.code).toBe(0);
  expect(JSON.stringify(second.data.logs)).toContain("x".repeat(1200));
  expect(second.data).not.toHaveProperty("help");
});
