import { decode } from "@toon-format/toon";
import { afterEach, expect, test, vi } from "vitest";
import { main } from "../src/cli.js";
import { transportBindings } from "../src/catalogue.js";
import { fakeTransport, syntheticKeys, type Reply } from "./support/fake-tenable.js";
import { localFixture } from "./support/local-cli.js";

const fixtures: ReturnType<typeof localFixture>[] = [];
afterEach(() => { fixtures.splice(0).forEach((fixture) => fixture.cleanup()); vi.useRealTimers(); });
function setup(replies: Reply[] = [], configured = true) {
  const fixture = localFixture();
  fixtures.push(fixture);
  if (configured) Object.assign(fixture.env, { TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey, TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey });
  const fake = fakeTransport(replies, transportBindings);
  async function cli(args: string[]) {
    let stdout = "";
    const previous = process.exitCode;
    process.exitCode = 0;
    try {
      await main(args, { credentials: { home: fixture.home, env: fixture.env }, transportFactory: () => fake.transport,
        stdout: { write: (chunk) => { stdout += chunk; } } });
      return { code: process.exitCode, data: decode(stdout) as Record<string, unknown>, stdout };
    } finally { process.exitCode = previous; }
  }
  return { ...fixture, ...fake, cli };
}
const card = (id: string, score = 42) => ({ id, name: `Card ${id}`, ces_score: { score } });

test("configured home requests five cards once and reports the upstream total", async () => {
  const fixture = setup([{ body: { data: [card("1"), card("2"), card("3"), card("4"), card("5")], pagination: { total_record_count: 60 } } }]);
  const result = await fixture.cli([]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ profile: "env", origin: "https://cloud.tenable.com", readOnly: true, count: 5, total: 60, complete: false });
  expect(result.data.cards).toHaveLength(5);
  expect(fixture.requests.map((request) => request.url)).toEqual(["https://cloud.tenable.com/api/v1/t1/exposure-view/cards?limit=5&offset=0"]);
});

test("unconfigured home explains setup without HTTP", async () => {
  const fixture = setup([], false);
  const result = await fixture.cli(["home"]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ status: "not configured", help: expect.arrayContaining([expect.stringContaining("SecretRefs")]) });
  expect(fixture.requests).toHaveLength(0);
});

test("hook context reads profile posture without resolving unavailable secrets or HTTP", async () => {
  const fixture = setup([], false);
  fixture.config({ example: { writes: { allowWrites: true, operations: ["tags-create-tag-value"] } } });
  const result = await fixture.cli(["hook"]);
  expect(result).toMatchObject({ code: 0, data: { profile: "example", readOnly: false } });
  expect(fixture.requests).toHaveLength(0);
});

test("doctor verifies one tag-properties read and limits its claim to that privilege", async () => {
  const fixture = setup([{ body: { data: [{ key: "tag_name", operators: ["="] }] } }]);
  const result = await fixture.cli(["doctor"]);
  expect(result).toMatchObject({ code: 0, data: { status: "ok", check: "inventory-tag-properties-list", scope: expect.stringContaining("other modules are untested") } });
  expect(fixture.requests).toHaveLength(1);
  expect(fixture.requests[0]!.url).toBe("https://cloud.tenable.com/api/v1/t1/tags/properties");
});

test.each([[401, "AUTH_REQUIRED"], [403, "PERMISSION_DENIED"]])("doctor maps HTTP %i to actionable tag privilege advice", async (status, code) => {
  const fixture = setup([{ status, body: { message: "Denied" } }]);
  const result = await fixture.cli(["doctor"]);
  expect(result).toMatchObject({ code: 1, data: { error: { code, operation: "inventory-tag-properties-list", status }, help: expect.arrayContaining([expect.stringContaining("EXPOSURE_MANAGEMENT.TAG.TAG.READ")]) } });
  expect(fixture.requests).toHaveLength(1);
});

test.each([429, 503])("doctor never retries HTTP %i", async (status) => {
  vi.useFakeTimers();
  const fixture = setup([{ status, body: { message: "Try later" } }, { body: { data: [] } }]);
  const pending = fixture.cli(["doctor"]);
  await vi.runAllTimersAsync();
  expect(await pending).toMatchObject({ code: 1, data: { error: { code: status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED" } } });
  expect(fixture.requests).toHaveLength(1);
});

test("card list caps wire pages at 25 and resumes a scoped output window", async () => {
  const fixture = setup([{ body: { data: [card("1"), card("2")], pagination: { total_record_count: 3 } } }, { body: { data: [card("3")], pagination: { total_record_count: 3 } } }]);
  const first = await fixture.cli(["card", "list", "--global", "false", "--query", "Card", "--sorting-order", "desc", "--limit", "2"]);
  expect(first.data).toMatchObject({ count: 2, total: 3, complete: false });
  const second = await fixture.cli(["card", "list", "--global", "false", "--query", "Card", "--sorting-order", "desc", "--limit", "100", "--cursor", String(first.data.cursor)]);
  expect(second).toMatchObject({ code: 0, data: { cards: [{ id: "3", name: "Card 3", score: 42 }], count: 1, complete: true } });
  expect(new URL(fixture.requests[1]!.url).searchParams.get("limit")).toBe("25");
  expect(new URL(fixture.requests[1]!.url).searchParams.get("offset")).toBe("2");
});

test("card cursor refuses changed search scope before HTTP", async () => {
  const fixture = setup([{ body: { data: [card("1")], pagination: { total_record_count: 2 } } }]);
  const first = await fixture.cli(["card", "list", "--limit", "1"]);
  const result = await fixture.cli(["card", "list", "--query", "changed", "--cursor", String(first.data.cursor)]);
  expect(result).toMatchObject({ code: 2, data: { error: { code: "VALIDATION_ERROR", message: expect.stringContaining("Cursor does not match") } } });
  expect(fixture.requests).toHaveLength(1);
});

test("card details map total score and trend/SLA selectors without losing zero", async () => {
  const fixture = setup([{ body: { id: "example", name: "Example", ces_scores: { total: { score: 0 } }, ces_trend: [], exposure_classes_details: {} } }]);
  const result = await fixture.cli(["card", "show", "--id", "example", "--trend-start-date", "2026-01-01T00:00:00Z", "--trend-end-date", "2026-01-31T00:00:00Z", "--sla-breakdown-filter", "NON_REMEDIATED", "--include-trend-events", "true"]);
  expect(result).toMatchObject({ code: 0, data: { card: { id: "example", score: 0, ces_trend: [], exposure_classes_details: {} } } });
  const url = new URL(fixture.requests[0]!.url);
  expect(url.pathname).toBe("/api/v1/t1/exposure-view/cards/example");
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ trend_start_date: "2026-01-01T00:00:00Z", trend_end_date: "2026-01-31T00:00:00Z", sla_breakdown_filter: "NON_REMEDIATED", include_trend_events: "true" });
});

test("tag search requests category and selected extra properties with documented filters", async () => {
  const fixture = setup([{ body: { data: [{ id: "tag-1", name: "Production", extra_properties: { tag_category_name: "Environment", aes_average: 147 } }], pagination: { total: 1 } } }]);
  const result = await fixture.cli(["tag", "list", "--query", "Production", "--filter", 'asset_count >= ["1"]', "--fields", "id,category,value,aes_average"]);
  expect(result).toMatchObject({ code: 0, data: { tags: [{ id: "tag-1", category: "Environment", value: "Production", aes_average: 147 }], total: 1, complete: true } });
  const request = fixture.requests[0]!;
  expect(request.init.method).toBe("POST");
  expect(JSON.parse(String(request.init.body))).toEqual({ query: { mode: "simple", text: "Production" }, filters: [{ property: "asset_count", operator: ">=", value: ["1"] }] });
  expect(new URL(request.url).searchParams.get("extra_properties")).toBe("tag_category_name,aes_average");
});

test("tag properties projects discovery names and truncates long descriptions with an escape hatch", async () => {
  const fixture = setup([{ body: { data: [{ key: "tag_name", operators: ["contains"], description: "x".repeat(1200) }] } }]);
  const result = await fixture.cli(["tag", "properties", "--fields", "property,operators,description"]);
  expect(result).toMatchObject({ code: 0, data: { properties: [{ property: "tag_name", operators: ["contains"], description: { text: "x".repeat(1000), length: 1200 } }], count: 1, complete: true, help: expect.arrayContaining([expect.stringContaining("--full")]) } });
});

test("card details redact sensitive upstream content before rendering it", async () => {
  const fixture = setup([{ body: { id: "example", name: syntheticKeys.accessKey, ces_scores: { total: { score: 1 } }, exposure_classes_details: { CLOUD: { token: "synthetic-upstream-token", note: "AccountKey=synthetic-storage-key;" } } } }]);
  const result = await fixture.cli(["card", "show", "--id", "example"]);
  expect(result.code).toBe(0);
  expect(result.stdout).not.toContain(syntheticKeys.accessKey);
  expect(result.stdout).not.toContain("synthetic-upstream-token");
  expect(result.stdout).not.toContain("synthetic-storage-key");
});

test("empty cards state success without inventing a total", async () => {
  const fixture = setup([{ body: { data: [] } }]);
  const result = await fixture.cli(["card", "list"]);
  expect(result).toMatchObject({ code: 0, data: { cards: [], count: 0, complete: true, message: "0 cards matched the selected filters" } });
  expect(result.data).not.toHaveProperty("total");
});

test("a malformed selected card field is rejected rather than rendered as plausible data", async () => {
  const fixture = setup([{ body: { data: [{ ...card("1"), sla_percentage: "unavailable" }], pagination: { total_record_count: 1 } } }]);
  const result = await fixture.cli(["card", "list", "--fields", "id,sla_percentage"]);
  expect(result).toMatchObject({ code: 1, data: { error: { code: "RESPONSE_INVALID", message: "Response has an invalid sla_percentage field" } } });
  expect(result.data).not.toHaveProperty("cards");
});

test.each([{ status: 403, body: { message: "No access" } }, { body: { data: [{ id: "missing-score", name: "Invalid" }] } }, { body: { unexpected: [] } }])("denied or malformed cards cannot become an empty success: %j", async (reply) => {
  const fixture = setup([reply]);
  const result = await fixture.cli(["card", "list"]);
  expect(result.code).toBe(1);
  expect(result.data).toHaveProperty("error");
  expect(result.data).not.toHaveProperty("cards");
});

test("a failed later card page retains valid rows with a failing exit", async () => {
  const fixture = setup([{ body: { data: [card("1")], pagination: { total_record_count: 2 } } }, { status: 403, body: { message: "Denied" } }]);
  const result = await fixture.cli(["card", "list"]);
  expect(result).toMatchObject({ code: 1, data: { cards: [{ id: "1", name: "Card 1", score: 42 }], complete: false, error: { code: "PERMISSION_DENIED" }, cursor: expect.any(String) } });
});

test("a repeated card page stops without emitting duplicate results", async () => {
  const fixture = setup([{ body: { data: [card("1")] } }, { body: { data: [card("1")] } }]);
  const result = await fixture.cli(["card", "list"]);
  expect(result).toMatchObject({ code: 1, data: { count: 1, complete: false, error: { code: "CONTINUATION_REPEATED" } } });
  expect(fixture.requests).toHaveLength(2);
});

test.each([["card", "list", "--global", "yes"], ["card", "show", "--id", "../escape"], ["card", "show", "--id", "x", "--trend-start-date", "2026-01-01T00:00:00Z"], ["tag", "list", "--filter", 'asset_count >= 1'], ["card", "list", "--all", "--limit", "5"], ["doctor", "--unknown"]])("invalid invocation fails before credentials or HTTP: %j", async (...args) => {
  const fixture = setup([], false);
  const result = await fixture.cli(args);
  expect(result).toMatchObject({ code: 2, data: { error: { code: "VALIDATION_ERROR" } } });
  expect(fixture.requests).toHaveLength(0);
});
