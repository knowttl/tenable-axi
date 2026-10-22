import { afterEach, expect, test, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { transportBindings } from "../src/catalogue.js";
import { fakeHttpsTenable, fakeTransport, syntheticKeys, type Reply } from "./support/fake-tenable.js";
import { localFixture } from "./support/local-cli.js";

const asset = { id: "asset-1", name: "Example device", asset_class: "DEVICE", aes: 913 };
const finding = { id: "finding-1", name: "Example finding", severity: "HIGH", state: "ACTIVE" };
const software = { application: "example-app", publisher: "Example Publisher", extra_properties: { version: "1.2.3" } };
function page(data: unknown[], total?: number, offset = 0) {
  return { data, pagination: { offset, limit: 1000, ...(total === undefined ? {} : { total }) } };
}
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
afterEach(() => { for (const fixture of fixtures.splice(0)) fixture.cleanup(); vi.useRealTimers(); });

test.each([
  ["asset", asset, { id: "asset-1", name: "Example device", class: "DEVICE", exposureScore: 913 }],
  ["finding", finding, finding],
  ["software", software, { name: "example-app", version: "1.2.3", publisher: "Example Publisher" }],
] as const)("%s list renders compact defaults while tolerating beta fields", async (kind, row, expected) => {
  const result = await fixture().run([kind, "list"], [{ body: page([{ ...row, beta: { new_field: true } }], 1) }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ [kind === "software" ? kind : `${kind}s`]: [expected], count: 1, total: 1, complete: true });
  if (kind === "software") {
    expect(result.data.help).toContain("The pinned API exposes no stable software ID");
    expect(new URL(result.requests[0]!.url).searchParams.get("extra_properties")).toBe("version");
  }
});

test.each(["asset", "finding", "software"])("%s empty search is a definitive success", async (kind) => {
  const result = await fixture().run([kind, "list"], [{ body: page([], 0) }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ count: 0, total: 0, complete: true, message: expect.stringContaining("0 ") });
});

test.each([
  [403, { message: "Denied" }, "PERMISSION_DENIED", "EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ"],
  [400, { message: "Requested unknown_field not found", status: 400 }, "VALIDATION_ERROR", "asset properties"],
  [200, { data: [{ id: "asset-1", name: "Broken", asset_class: "DEVICE" }] }, "RESPONSE_INVALID", undefined],
  [200, { unexpected: [] }, "RESPONSE_INVALID", undefined],
  [200, { data: [], pagination: { total: "unknown", offset: 0, limit: 100 } }, "RESPONSE_INVALID", undefined],
] as const)("HTTP %i and invalid data fail without an empty success", async (status, body, code, hint) => {
  const result = await fixture().run(["asset", "list"], [{ status, body }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code } });
  expect(result.data).not.toHaveProperty("assets");
  if (hint) expect(JSON.stringify(result.data.help)).toContain(hint);
});

test.each([
  ["--unknown"], ["--limit", "2", "--limit", "3"], ["--all", "--limit", "1"], ["--limit", "0"],
  ["--offset", "-1"], ["--cursor", "bad", "--offset", "1"], ["--sort", "name:sideways"],
  ["--class", "INVALID"], ["--filter", 'name matches ["example"]'], ["--filter", 'aes >= [5]'],
  ["--filter", 'name = "example"'], ["--fields", "id,id"], ["--fields", "bad.field"], ["unexpected"],
])("rejects invalid arguments before credentials or HTTP: %j", async (...flags) => {
  const f = fixture();
  delete f.env.TENABLE_AXI_SECRET_KEY;
  const result = await f.run(["asset", "list", ...flags]);
  expect(result.code).toBe(2);
  expect(result.data).toMatchObject({ error: { code: "VALIDATION_ERROR" }, help: [expect.stringContaining("--limit")] });
  expect(result.requests).toHaveLength(0);
});

test("search sends query, repeated filters, sort and class as documented server parameters", async () => {
  const result = await fixture().run(["asset", "list", "--query", "example", "--filter", 'aes >= ["500"]',
    "--filter", 'name not contains ["old"]', "--class", "DEVICE", "--sort", "aes:desc", "--offset", "5", "--limit", "2"],
  [{ body: page([asset], 6, 5) }]);
  expect(result.code).toBe(0);
  expect(result.requests[0]!.init.method).toBe("POST");
  expect(JSON.parse(result.requests[0]!.init.body as string)).toEqual({ query: { mode: "simple", text: "example" }, filters: [
    { property: "aes", operator: ">=", value: ["500"] }, { property: "name", operator: "not contains", value: ["old"] },
    { property: "asset_class", operator: "=", value: ["DEVICE"] },
  ] });
  expect(new URL(result.requests[0]!.url).searchParams.toString()).toBe("sort=aes%3Adesc&offset=5&limit=2");
});

test("flat filter files constrain the search without adding a second filter grammar", async () => {
  const f = fixture();
  const path = join(f.home, "filter.json");
  writeFileSync(path, JSON.stringify([{ property: "severity", operator: "=", value: ["HIGH"] }]));
  const result = await f.run(["finding", "list", "--filter-file", path], [{ body: page([finding], 1) }]);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.requests[0]!.init.body as string).filters).toEqual([{ property: "severity", operator: "=", value: ["HIGH"] }]);
});

test.each([
  { and: [{ property: "name", operator: "=", value: ["example"] }] },
  [{ property: "name", operator: "=", value: ["example"], or: [] }],
])("nested filter files fail before credentials with the supported shape", async (value) => {
  const f = fixture();
  delete f.env.TENABLE_AXI_SECRET_KEY;
  const path = join(f.home, "filter.json");
  writeFileSync(path, JSON.stringify(value));
  const result = await f.run(["asset", "list", "--filter-file", path]);
  expect(result.code).toBe(2);
  expect(result.data).toMatchObject({ error: { message: expect.stringContaining("flat array") } });
  expect(result.requests).toHaveLength(0);
});

test.each(["asset", "finding", "software"])("%s properties decodes its documented envelope", async (kind) => {
  const property = { key: "name", readable_name: "Name", operators: ["=", "match"], sortable: true, filterable: true, beta: "ignored" };
  const result = await fixture().run([kind, "properties"], [{ body: { [kind === "asset" ? "properties" : "data"]: [property] } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ properties: [{ key: "name", operators: ["=", "match"] }], count: 1, total: null, complete: true });
  expect(result.requests[0]!.init.method).toBe("GET");
  expect(new URL(result.requests[0]!.url).search).toBe("");
});

test("asset properties sends exploded asset_classes through verified HTTPS", async () => {
  const fake = await fakeHttpsTenable([{ body: { properties: [] } }]);
  try {
    const f = fixture();
    const result = await f.cli(["asset", "properties", "--asset-classes", "DEVICE,ACCOUNT"], {}, () => fake.transport(transportBindings));
    expect(result.code).toBe(0);
    expect(fake.requests[0]!.url).toBe("/api/v1/t1/inventory/assets/properties?asset_classes=DEVICE&asset_classes=ACCOUNT");
  } finally { await fake.close(); }
});

test.each(["asset", "finding"])("%s show uses an exact ID filter", async (kind) => {
  const row = kind === "asset" ? asset : finding;
  const result = await fixture().run([kind, "show", "--id", row.id], [{ body: page([row], 1) }]);
  expect(result.code).toBe(0);
  expect(result.data).toHaveProperty(`${kind}.id`, row.id);
  expect(JSON.parse(result.requests[0]!.init.body as string)).toEqual({ filters: [{ property: `${kind}_id`, operator: "=", value: [row.id] }] });
});

test.each([[[], "NOT_FOUND"], [[{ ...asset, id: "wrong-id" }], "RESPONSE_INVALID"], [[asset, asset], "RESPONSE_INVALID"]])(
  "exact show refuses absent, mismatched or ambiguous data: %j", async (data, code) => {
    const result = await fixture().run(["asset", "show", "--id", "asset-1"], [{ body: page(data as unknown[], (data as unknown[]).length) }]);
    expect(result.code).toBe(1);
    expect(result.data).toMatchObject({ error: { code } });
  },
);

test("requested extra fields are fetched and truncated with original size and an escape hatch", async () => {
  const f = fixture();
  const args = ["finding", "show", "--id", "finding-1", "--fields", "id,description", "--extra-properties", "solution"];
  const body = page([{ id: "finding-1", extra_properties: { description: "x".repeat(1200), solution: "fix" } }], 1);
  const preview = await f.run(args, [{ body }]);
  expect(preview.code).toBe(0);
  expect(preview.data).toMatchObject({ finding: { id: "finding-1", description: expect.stringContaining("1200 chars total") },
    help: [expect.stringContaining("--full")] });
  expect(new URL(preview.requests[0]!.url).searchParams.get("extra_properties")).toBe("description,solution");
  const full = await f.run([...args, "--full"], [{ body }]);
  expect(full.data).toEqual({ finding: { id: "finding-1", description: "x".repeat(1200) } });
});

test("selected views require their fields without requiring unrendered fields", async () => {
  const f = fixture();
  const minimal = await f.run(["asset", "list", "--fields", "id"], [{ body: page([{ id: "asset-1" }], 1) }]);
  expect(minimal.code).toBe(0);
  expect(minimal.data.assets).toEqual([{ id: "asset-1" }]);
  const malformed = await f.run(["asset", "list", "--fields", "id,description"], [{ body: page([{ id: "asset-1", extra_properties: { description: 12 } }], 1) }]);
  expect(malformed.code).toBe(1);
  expect(malformed.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
});

test("bounded all retains rows at the request budget and resumes the next offset", async () => {
  const f = fixture();
  const first = await f.run(["asset", "list", "--all"], Array.from({ length: 20 }, (_, offset) => ({ body: page([{ ...asset, id: `asset-${offset}` }], 21, offset) })));
  expect(first.code).toBe(0);
  expect(first.requests).toHaveLength(20);
  expect(first.data).toMatchObject({ count: 20, total: 21, complete: false, reason: "REQUEST_BUDGET_EXCEEDED", cursor: expect.any(String) });
  const resumed = await f.run(["asset", "list", "--all", "--cursor", first.data.cursor as string], [{ body: page([{ ...asset, id: "asset-20" }], 21, 20) }]);
  expect(resumed.code).toBe(0);
  expect(resumed.data).toMatchObject({ assets: [{ id: "asset-20" }], count: 1, total: 21, complete: true });
  expect(new URL(resumed.requests[0]!.url).searchParams.get("offset")).toBe("20");
});

test("row budget stops at ten thousand and full does not widen it", async () => {
  const result = await fixture().run(["asset", "list", "--all", "--full", "--fields", "id"], Array.from({ length: 10 }, (_, pageIndex) => ({
    body: page(Array.from({ length: 1000 }, (_, index) => ({ id: `asset-${pageIndex * 1000 + index}` })), 10001, pageIndex * 1000),
  })));
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ count: 10000, complete: false, reason: "ROW_BUDGET_EXCEEDED", cursor: expect.any(String) });
  expect(result.requests).toHaveLength(10);
});

test("resume preserves a within-page position without skipping unreturned rows", async () => {
  const f = fixture();
  const body = page([asset, { ...asset, id: "asset-2" }, { ...asset, id: "asset-3" }], 3);
  const first = await f.run(["asset", "list", "--limit", "1"], [{ body }]);
  expect(first.data).toMatchObject({ count: 1, complete: false });
  const second = await f.run(["asset", "list", "--limit", "2", "--cursor", first.data.cursor as string], [{ body }]);
  expect(second.data).toMatchObject({ assets: [{ id: "asset-2" }, { id: "asset-3" }], count: 2, complete: true });
});

test.each([["--query", "changed"], ["--sort", "name:asc"], ["--fields", "id"], ["--filter", 'name = ["changed"]']])(
  "resume rejects changed scope before HTTP: %j", async (...args) => {
    const f = fixture();
    const first = await f.run(["asset", "list", "--limit", "1"], [{ body: page([asset], 2) }]);
    const result = await f.run(["asset", "list", "--cursor", first.data.cursor as string, ...args]);
    expect(result.code).toBe(2);
    expect(result.data).toMatchObject({ error: { message: expect.stringContaining("Cursor belongs") } });
    expect(result.requests).toHaveLength(0);
  },
);

test("resume rejects different profiles and operation namespaces", async () => {
  const f = fixture();
  const first = await f.run(["asset", "list", "--limit", "1"], [{ body: page([asset], 2) }]);
  f.config({ different: {} });
  const differentProfile = await f.run(["asset", "list", "--profile", "different", "--cursor", first.data.cursor as string]);
  const differentOperation = await f.run(["finding", "list", "--cursor", first.data.cursor as string]);
  expect(differentProfile.code).toBe(2);
  expect(differentOperation.code).toBe(2);
  expect(differentProfile.requests).toHaveLength(0);
  expect(differentOperation.requests).toHaveLength(0);
});

test.each([
  { body: page([{ ...asset, id: "asset-2" }], 2, 0) },
  { body: page([{ id: "asset-2" }], 2, 1) },
  { status: 403, body: { message: "Denied" } },
] as Reply[])("partial failures retain only validated rows and exit nonzero", async (reply) => {
  const result = await fixture().run(["asset", "list", "--all"], [{ body: page([asset], 2) }, reply]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ assets: [{ id: "asset-1" }], count: 1, complete: false, error: { code: expect.any(String) }, cursor: expect.any(String) });
});

test("deadline budget stops normally with valid partial rows and a resumable cursor", async () => {
  vi.useFakeTimers();
  const pending = fixture().run(["asset", "list", "--all"], [{ body: page([asset], 2) }, "hang"]);
  await vi.advanceTimersByTimeAsync(20000);
  const result = await pending;
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ count: 1, complete: false, reason: "DEADLINE_EXCEEDED", cursor: expect.any(String) });
  expect(vi.getTimerCount()).toBe(0);
});

test("unknown totals remain unknown after the last short page", async () => {
  const result = await fixture().run(["finding", "list"], [{ body: { data: [finding] } }]);
  expect(result.data).toMatchObject({ total: null, complete: true, count: 1 });
});

test("upstream secrets are redacted before any selected extra property is rendered", async () => {
  const result = await fixture().run(["asset", "list", "--fields", "id,metadata"], [{ body: page([{ id: "asset-1",
    extra_properties: { metadata: { password: "synthetic-password", notes: syntheticKeys.secretKey } } }], 1) }]);
  expect(result.code).toBe(0);
  expect(result.stdout).not.toContain("synthetic-password");
  expect(result.stdout).not.toContain(syntheticKeys.secretKey);
});
