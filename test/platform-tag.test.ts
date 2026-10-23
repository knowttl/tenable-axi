import { decode } from "@toon-format/toon";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { main } from "../src/cli.js";
import { mutationOperations, transportBindings } from "../src/catalogue.js";
import { constructWriteCoordinator } from "../src/writes-core.js";
import { fakeTransport, syntheticKeys, type Reply } from "./support/fake-tenable.js";
import { localFixture } from "./support/local-cli.js";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const third = "00000000-0000-4000-8000-000000000003";
const category = { uuid: id, name: "Location", reserved: false, description: "Synthetic location" };
const value = { uuid: id, category_uuid: other, category_name: "Location", value: "West", type: "static", description: "Synthetic value", access_control: { version: 3 } };
const assigned = { asset_uuid: other, value_uuid: id, category_name: "Location", value: "West" };
const page = (key: string, rows: unknown[], total = rows.length, limit = 100, offset = 0) => ({ [key]: rows, pagination: { total, limit, offset } });
const locals: ReturnType<typeof localFixture>[] = [];
function fixture() {
  const local = localFixture();
  locals.push(local);
  Object.assign(local.env, { TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey, TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey });
  local.config({ example: { writes: { allowWrites: true, operations: Object.keys(mutationOperations) } } });
  const credentials = { home: local.home, env: local.env };
  function file(name: string, body: unknown) {
    const path = join(local.home, name);
    writeFileSync(path, JSON.stringify(body));
    return path;
  }
  async function run(args: string[], replies: (Reply | "disconnect")[] = []) {
    const upstream = fakeTransport([...replies], transportBindings);
    let stdout = "";
    const previous = process.exitCode;
    process.exitCode = 0;
    try {
      await main(["tag", ...args, "--profile", "example"], { credentials, stdout: { write: (chunk) => { stdout += chunk; } },
        transportFactory: () => upstream.transport,
        writeCoordinatorFactory: (options) => constructWriteCoordinator(options, { credentials,
          operations: mutationOperations, bindings: transportBindings, fetch: upstream.fetch }),
      });
      return { code: process.exitCode, data: decode(stdout) as Record<string, any>, stdout, requests: upstream.requests };
    } finally { process.exitCode = previous; }
  }
  return { ...local, file, run };
}
afterEach(() => { for (const local of locals.splice(0)) local.cleanup(); });

test.each([
  ["category", "categories", category, { id, name: "Location", reserved: false }],
  ["value", "values", value, { id, category: "Location", value: "West", type: "static" }],
] as const)("%s list resumes scoped paging with repeated filters and sort", async (noun, key, row, expected) => {
  const f = fixture();
  const field = noun === "category" ? "name" : "value";
  const args = [noun, "list", "--limit", "1", "--filter", `${field}:match:W`, "--filter", "description:match:Synthetic", "--filter-type", "or", "--sort", `${field}:asc,updated_at:desc`];
  const first = await f.run(args, [{ body: page(key, [row], 2, 1) }]);
  expect(first.code).toBe(0);
  expect(first.data).toMatchObject({ [key]: [expected], count: 1, total: 2, complete: false });
  const query = new URL(first.requests[0]!.url).searchParams;
  expect(query.getAll("f")).toEqual([`${field}:match:W`, "description:match:Synthetic"]);
  expect(query.get("ft")).toBe("or");
  expect(query.get("sort")).toBe(`${field}:asc,updated_at:desc`);
  const next = await f.run([...args, "--cursor", first.data.cursor], [{ body: page(key, [{ ...row, uuid: third }], 2, 1, 1) }]);
  expect(next.code).toBe(0);
  expect(next.data).toMatchObject({ count: 1, total: 2, complete: true });
  expect(new URL(next.requests[0]!.url).searchParams.get("offset")).toBe("1");
  const wrong = await f.run([noun, "list", "--cursor", first.data.cursor]);
  expect(wrong.code).toBe(2);
  expect(wrong.requests).toHaveLength(0);
});

test("value wildcard search maps to the documented w and wf parameters", async () => {
  const result = await fixture().run(["value", "list", "--with", "West", "--with-filter", "category_name,value"], [{ body: page("values", [value]) }]);
  expect(result.code).toBe(0);
  expect(new URL(result.requests[0]!.url).searchParams.get("w")).toBe("West");
  expect(new URL(result.requests[0]!.url).searchParams.get("wf")).toBe("category_name,value");
});

test.each([
  ["category", category, { id, name: "Location", reserved: false }],
  ["value", value, { id, category: "Location", value: "West", type: "static" }],
] as const)("%s show decodes detail and rejects wrong-resource success", async (noun, row, expected) => {
  const f = fixture();
  const result = await f.run([noun, "show", "--id", id], [{ body: { ...row, beta: true } }]);
  expect(result.code).toBe(0);
  expect(result.data.tag).toEqual(expected);
  const wrong = await f.run([noun, "show", "--id", id], [{ body: { ...row, uuid: other } }]);
  expect(wrong.data.error.code).toBe("RESPONSE_INVALID");
});

test("assignment list keeps unreturned rows in a redacted cursor without extra HTTP", async () => {
  const f = fixture();
  const first = await f.run(["assignment", "list", "--asset-id", other, "--limit", "1"], [{ body: { tags: [assigned, { ...assigned, value_uuid: third, value: syntheticKeys.secretKey }] } }]);
  expect(first.code).toBe(0);
  expect(first.data).toMatchObject({ tags: [{ assetId: other, tagId: id, value: "West" }], complete: false, total: null });
  expect(new URL(first.requests[0]!.url).search).toBe("");
  const next = await f.run(["assignment", "list", "--asset-id", other, "--limit", "1", "--cursor", first.data.cursor]);
  expect(next.code).toBe(0);
  expect(next.data).toMatchObject({ tags: [{ tagId: third, value: "***redacted***" }], complete: true });
  expect(next.requests).toHaveLength(0);
  expect(Buffer.from(first.data.cursor, "base64url").toString()).not.toContain(syntheticKeys.secretKey);
});

test("exclusions preserve tag and target selectors during paging", async () => {
  const result = await fixture().run(["exclusion", "list", "--tag-id", id, "--target-type", "assets"], [{ body: page("excluded_targets", [{ asset_uuid: other, value_uuid: id }]) }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ excluded_targets: [{ targetId: other, targetType: "assets" }], total: 1, complete: true });
  const url = new URL(result.requests[0]!.url);
  expect(url.pathname).toBe(`/tags/values/${id}/exclusions`);
  expect(url.searchParams.get("target_type")).toBe("assets");
});

test("asset-filter list exposes operators and the documented omitted resource-tag filters", async () => {
  const result = await fixture().run(["asset-filter", "list"], [{ body: { filters: [{ name: "ipv4", operators: ["eq", "neq"], control: { type: "entry" }, beta: true }] } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ filters: [{ property: "ipv4", operators: ["eq", "neq"] }], complete: true, help: [expect.stringContaining("cloud.common.resource_tags.key")] });
  expect(new URL(result.requests[0]!.url).search).toBe("");
});

test.each([
  ["category", ["list"], page("categories", [])], ["value", ["list"], page("values", [])],
  ["assignment", ["list", "--asset-id", other], { tags: [] }], ["exclusion", ["list", "--tag-id", id], page("excluded_targets", [])],
  ["asset-filter", ["list"], { filters: [] }],
] as const)("empty %s collection is definitive success", async (noun, args, body) => {
  const result = await fixture().run([noun, ...args], [{ body }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ count: 0, complete: true, message: expect.stringContaining("0 tag") });
});

test.each([
  [{ text: "" }, "RESPONSE_INVALID"], [{ text: "not-json" }, "RESPONSE_INVALID"], [{ body: {} }, "RESPONSE_INVALID"],
  [{ body: page("categories", [{ uuid: id, name: "Location" }]) }, "RESPONSE_INVALID"],
  [{ body: page("categories", [], 2) }, "RESPONSE_INVALID"],
  [{ status: 403, body: { message: "Denied" } }, "PERMISSION_DENIED"],
] as const)("invalid category responses never become an empty collection: %j", async (reply, code) => {
  const result = await fixture().run(["category", "list"], [reply]);
  expect(result.code).toBe(1);
  expect(result.data.error.code).toBe(code);
  expect(result.data).not.toHaveProperty("categories");
});

test("partial collection failures retain valid rows and a resumable offset", async () => {
  const result = await fixture().run(["category", "list", "--all"], [{ body: page("categories", [category], 2, 1000) }, { body: {} }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ categories: [{ id }], count: 1, complete: false, reason: "READ_FAILED", error: { code: "RESPONSE_INVALID" }, cursor: expect.any(String) });
});

test("selected-field failure resumes at the failed page without skipping it", async () => {
  const f = fixture();
  const first = await f.run(["category", "list", "--all"], [{ body: page("categories", [category], 2, 1000) },
    { body: page("categories", [{ uuid: other, name: "Region" }], 2, 1000, 1) }]);
  expect(first.code).toBe(1);
  expect(first.data).toMatchObject({ count: 1, complete: false, error: { code: "RESPONSE_INVALID" } });
  const resumed = await f.run(["category", "list", "--all", "--cursor", first.data.cursor],
    [{ body: page("categories", [{ ...category, uuid: other, name: "Region" }], 2, 1000, 1) }]);
  expect(resumed.code).toBe(0);
  expect(resumed.data).toMatchObject({ categories: [{ id: other }], complete: true });
  expect(new URL(resumed.requests[0]!.url).searchParams.get("offset")).toBe("1");
});

test("repeated pages across invocations cannot duplicate collection rows", async () => {
  const f = fixture();
  const first = await f.run(["category", "list", "--limit", "1"], [{ body: page("categories", [category], 2, 1) }]);
  const repeated = await f.run(["category", "list", "--limit", "1", "--cursor", first.data.cursor], [{ body: page("categories", [category], 2, 1, 1) }]);
  expect(repeated.code).toBe(1);
  expect(repeated.data.error.code).toBe("RESPONSE_INVALID");
});

test.each([
  ["category", "create", "tags-create-tag-category", "POST", "/tags/categories"],
  ["category", "update", "tags-edit-tag-category", "PUT", `/tags/categories/${id}`],
  ["category", "delete", "tags-delete-tag-category", "DELETE", `/tags/categories/${id}`],
  ["value", "create", "tags-create-tag-value", "POST", "/tags/values"],
  ["value", "update", "tags-update-tag-value", "PUT", `/tags/values/${id}`],
  ["value", "delete", "tags-delete-tag-value", "DELETE", `/tags/values/${id}`],
] as const)("%s %s previews then sends once through the journal", async (noun, verb, operation, method, path) => {
  const f = fixture();
  const args: string[] = [noun, verb, ...(verb === "create" ? [] : ["--id", id])];
  if (verb !== "delete") args.push(...(noun === "category" ? ["--name", "Region"] : ["--body-file", f.file("tag.json", { value: "East", ...(verb === "create" ? { category_uuid: other } : { version: 3 }) })]));
  const current = { body: verb === "create" ? page(noun === "category" ? "categories" : "values", []) : noun === "category" ? category : value };
  const preview = await f.run(args, [current]);
  expect(preview.code).toBe(0);
  expect(preview.data).toMatchObject({ kind: "dry-run", preview: { operation, noop: false } });
  expect(preview.requests.every((request) => request.init.method === "GET")).toBe(true);
  const wrong = await f.run([...args, "--execute", "--confirm", "wrong"], [current]);
  expect(wrong.data.error.code).toBe("CONFIRM_MISMATCH");
  expect(wrong.requests).toHaveLength(1);
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [current, current,
    { body: verb === "delete" ? {} : noun === "category" ? { ...category, name: "Region" } : { ...value, value: "East" } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ kind: "success", auditId: expect.any(String) });
  expect(result.requests).toHaveLength(3);
  expect(result.requests[2]!.init.method).toBe(method);
  expect(new URL(result.requests[2]!.url).pathname).toBe(path);
  const journal = readFileSync(join(f.home, "state/tenable-axi/writes.log"), "utf8");
  expect(journal).toContain('"result":"SUCCESS"');
  expect(journal).not.toContain("East");
  expect(journal).not.toContain(syntheticKeys.secretKey);
});

test.each([
  [{ allowWrites: false, operations: [] }, undefined, "WRITES_DISABLED"],
  [{ allowWrites: true, operations: [] }, undefined, "OPERATION_NOT_WRITABLE"],
  [{ allowWrites: true, operations: ["tags-create-tag-category"] }, "true", "WRITES_DISABLED"],
] as const)("tag mutations refuse HTTP outside configured policy: %j", async (writes, forced, code) => {
  const f = fixture();
  f.config({ example: { writes } });
  if (forced) f.env.TENABLE_AXI_READ_ONLY = forced;
  const result = await f.run(["category", "create", "--name", "Location", "--execute", "--confirm", "anything"]);
  expect(result.data.error.code).toBe(code);
  expect(result.requests).toHaveLength(0);
});

test("dynamic tag rules preserve string arrays and version without enabling ACL changes", async () => {
  const f = fixture();
  const filters = { asset: { and: [{ property: "ipv4", operator: "eq", value: ["192.0.2.1", "192.0.2.2"] }], or: [{ property: "cloud.common.resource_tags.key", operator: "exists", value: "region" }] } };
  const body = f.file("tag.json", { filters, version: 3 });
  const args = ["value", "update", "--id", id, "--body-file", body];
  const preview = await f.run(args, [{ body: value }]);
  expect(preview.code).toBe(0);
  expect(preview.data.preview.proposed.body).toEqual({ filters, version: 3 });
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [{ body: value }, { body: value }, { body: { ...value, filters: { asset: JSON.stringify(filters.asset) } } }]);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.requests[2]!.init.body as string)).toEqual({ filters, version: 3 });
});

test("dynamic value creation supports a new named category at the rule and value boundaries", async () => {
  const f = fixture();
  const body = { category_name: "Region", category_description: "Synthetic region", value: "West", filters: { asset: {
    and: [{ property: "ipv4", operator: "eq", value: Array(1024).fill("192.0.2.1").join(",") },
      ...Array.from({ length: 39 }, () => ({ property: "cloud.common.resource_tags.key", operator: "exists", value: "region" }))],
  } } };
  const args = ["value", "create", "--body-file", f.file("tag.json", body), "--fields", "id,description"];
  const current = { body: page("values", []) };
  const preview = await f.run(args, [current]);
  expect(preview.code).toBe(0);
  expect(preview.data.preview.proposed.body.filters.asset.and).toHaveLength(40);
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [current, current, { body: value }]);
  expect(result.code).toBe(0);
  expect(result.data.tag).toEqual({ id, description: value.description });
  expect(JSON.parse(result.requests[2]!.init.body as string)).toEqual(body);
});

test("long detail text truncates with a scoped full-text escape hatch", async () => {
  const f = fixture();
  const description = "x".repeat(1100);
  const args = ["value", "show", "--id", id, "--fields", "id,description"];
  const compact = await f.run(args, [{ body: { ...value, description } }]);
  expect(compact.code).toBe(0);
  expect(compact.data.tag.description).toContain("1100 chars total");
  expect(compact.data.help[0]).toContain("--profile 'example' --full");
  const full = await f.run([...args, "--full"], [{ body: { ...value, description } }]);
  expect(full.data.tag.description).toBe(description);
  expect(full.data).not.toHaveProperty("help");
});

test.each([
  { value: "East", access_control: {} },
  { filters: { asset: { and: [{ property: "ipv4", operator: "eq", value: "192.0.2.1", access_control: {} }] } } },
  { filters: { asset: { permissions: [] } } },
  { filters: { asset: { and: Array.from({ length: 41 }, () => ({ property: "ipv4", operator: "eq", value: "192.0.2.1" })) } } },
  { filters: { asset: { or: [{ property: "ipv4", operator: "eq", value: Array(1025).fill("192.0.2.1") }] } } },
])("unsafe or excessive dynamic tag payload fails before credentials: %j", async (body) => {
  const f = fixture();
  delete f.env.TENABLE_AXI_SECRET_KEY;
  const result = await f.run(["value", "update", "--id", id, "--body-file", f.file("tag.json", body)]);
  expect(result.code).toBe(2);
  expect(result.requests).toHaveLength(0);
});

test("identical category update is a verified no-op", async () => {
  const result = await fixture().run(["category", "update", "--id", id, "--name", category.name, "--execute"], [{ body: category }]);
  expect(result.code).toBe(0);
  expect(result.data.kind).toBe("noop");
  expect(result.requests).toHaveLength(1);
});

test("category update can clear its description with an explicit empty value", async () => {
  const f = fixture();
  const args = ["category", "update", "--id", id, "--name", category.name, "--description", ""];
  const preview = await f.run(args, [{ body: category }]);
  expect(preview.code).toBe(0);
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm],
    [{ body: category }, { body: category }, { body: { ...category, description: "" } }]);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.requests[2]!.init.body as string)).toEqual({ name: category.name, description: "" });
});

test("malformed create lookup cannot become a no-op or a config error", async () => {
  const result = await fixture().run(["category", "create", "--name", category.name], [{ body: page("categories", [{ name: category.name }]) }]);
  expect(result.code).toBe(1);
  expect(result.data.error.code).toBe("RESPONSE_INVALID");
  expect(result.requests).toHaveLength(1);
});

test("identical dynamic value update compares the documented JSON-string response rules", async () => {
  const f = fixture();
  const asset = { and: [{ property: "ipv4", operator: "eq", value: "192.0.2.1" }] };
  const result = await f.run(["value", "update", "--id", id, "--body-file", f.file("tag.json", { filters: { asset }, version: 3 }), "--execute"],
    [{ body: { ...value, type: "dynamic", filters: { asset: JSON.stringify(asset) } } }]);
  expect(result.code).toBe(0);
  expect(result.data.kind).toBe("noop");
  expect(result.requests).toHaveLength(1);
});

test.each([
  ["create", "and", true], ["create", "or", true], ["update", "and", true], ["update", "or", true],
  ["create", "and", false], ["create", "or", false], ["update", "and", false], ["update", "or", false],
] as const)("identical dynamic value %s with %s response fields is a no-op (serialized: %s)", async (verb, direction, serialized) => {
  const f = fixture();
  const asset = { [direction]: [{ field: "operating_system", operator: "match", value: "FreeBSD" }] };
  const current = { ...value, type: "dynamic", filters: { asset: serialized ? JSON.stringify(asset) : asset } };
  const body = { filters: { asset: { [direction]: [{ property: "operating_system", operator: "match", value: "FreeBSD" }] } },
    ...(verb === "create" ? { category_uuid: other, value: "West" } : { version: 3 }) };
  const result = await f.run(["value", verb, ...(verb === "update" ? ["--id", id] : []), "--body-file", f.file("tag.json", body), "--execute"],
    [...(verb === "create" ? [{ body: page("values", [current]) }] : []), { body: current }]);
  expect(result.code).toBe(0);
  expect(result.data.kind).toBe("noop");
  expect(result.requests.every((request) => request.init.method === "GET")).toBe(true);
});

test("existing create is a no-op only when the exact category and state match", async () => {
  const f = fixture();
  const args = ["value", "create", "--body-file", f.file("tag.json", { category_uuid: other, value: "West" }), "--execute"];
  const same = await f.run(args, [{ body: page("values", [value]) }, { body: value }]);
  expect(same.code).toBe(0);
  expect(same.data.kind).toBe("noop");
  const different = await f.run(args, [{ body: page("values", [value]) }, { body: { ...value, type: "dynamic" } }]);
  expect(different.data.error.code).toBe("CONFIRM_REQUIRED");
  expect(different.requests).toHaveLength(2);
});

test("stale value versions rejected by the server are recorded without replay", async () => {
  const f = fixture();
  const args = ["value", "update", "--id", id, "--body-file", f.file("tag.json", { value: "East", version: 2 })];
  const preview = await f.run(args, [{ body: value }]);
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [{ body: value }, { body: value }, { status: 409, body: { statusCode: 409, error: "Conflict", message: "Stale version" } }]);
  expect(result.code).toBe(1);
  expect(result.data.error).toMatchObject({ status: 409, auditId: expect.any(String) });
  expect(result.requests).toHaveLength(3);
  expect(readFileSync(join(f.home, "state/tenable-axi/writes.log"), "utf8")).toContain('"result":"FAILED"');
});

test("changed state between execution preview and send blocks a mutation", async () => {
  const f = fixture();
  const args = ["category", "delete", "--id", id];
  const preview = await f.run(args, [{ body: category }]);
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [{ body: category }, { body: { ...category, name: "Changed" } }]);
  expect(result.data.error.code).toBe("PREVIEW_CHANGED");
  expect(result.requests).toHaveLength(2);
});

test("unverified missing delete remains an error", async () => {
  const result = await fixture().run(["value", "delete", "--id", id, "--execute"], [{ status: 404, body: { message: "Unknown tag" } }]);
  expect(result.data.error.code).toBe("NOT_FOUND");
  expect(result.requests).toHaveLength(1);
});

test("bulk deletion confirms the entire sorted UUID set", async () => {
  const f = fixture();
  const args = ["value", "bulk-delete", "--ids-file", f.file("ids.json", [other, id, id])];
  const reads = [{ body: value }, { body: { ...value, uuid: other } }];
  const preview = await f.run(args, reads);
  expect(preview.code).toBe(0);
  expect(preview.data.preview.target.ids).toEqual([id, other]);
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [...reads, ...reads, { body: {} }]);
  expect(result.code).toBe(0);
  expect(result.requests).toHaveLength(5);
  expect(new URL(result.requests[4]!.url).pathname).toBe("/tags/values/delete-requests");
  expect(JSON.parse(result.requests[4]!.init.body as string)).toEqual({ values: [id, other] });
  const changed = await f.run(["value", "bulk-delete", "--ids-file", f.file("changed.json", [id, third]), "--execute", "--confirm", preview.data.preview.confirm], [{ body: value }, { body: { ...value, uuid: third } }]);
  expect(changed.data.error.code).toBe("CONFIRM_MISMATCH");
});

test.each(["delete", "bulk-delete"])("value %s accepts an unconstrained JSON success reply", async (verb) => {
  const f = fixture();
  const args = ["value", verb, ...(verb === "delete" ? ["--id", id] : ["--ids-file", f.file("ids.json", [id])])];
  const current = { body: value };
  const preview = await f.run(args, [current]);
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [current, current, { body: null }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ kind: "success", status: 200, auditId: expect.any(String) });
  expect(result.requests.map(({ init }) => init.method)).toEqual(["GET", "GET", verb === "delete" ? "DELETE" : "POST"]);
  const journal = readFileSync(join(f.home, "state/tenable-axi/writes.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
  expect(journal[1]).toMatchObject({ result: "SUCCESS", status: 200 });
});

test("a tag write with invalid JSON reports success and requires read-back", async () => {
  const f = fixture();
  const args = ["value", "delete", "--id", id];
  const current = { body: value };
  const preview = await f.run(args, [current]);
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [current, current, { text: "not JSON" }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ kind: "success", status: 200, warning: expect.stringContaining("succeeded"), help: [expect.stringContaining("read back")] });
  expect(result.requests).toHaveLength(3);
  const journal = readFileSync(join(f.home, "state/tenable-axi/writes.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
  expect(journal[1]).toMatchObject({ result: "SUCCESS", status: 200 });
});

test.each(["add", "remove"])("assignment %s confirms both complete sets and returns the asynchronous job once", async (action) => {
  const f = fixture();
  const args = ["assignment", action, "--asset-ids-file", f.file("assets.json", [other]), "--tag-ids-file", f.file("tags.json", [id])];
  const state = { body: { tags: action === "add" ? [] : [assigned] } };
  const preview = await f.run(args, [state]);
  expect(preview.code).toBe(0);
  const changed = await f.run(["assignment", action, "--asset-ids-file", f.file("changed-assets.json", [third]), "--tag-ids-file", f.file("tags.json", [id]), "--execute", "--confirm", preview.data.preview.confirm],
    [{ body: { tags: action === "add" ? [] : [{ ...assigned, asset_uuid: third }] } }]);
  expect(changed.data.error.code).toBe("CONFIRM_MISMATCH");
  const jobId = "62210d02a7056d0297f50a8ddfbd549eaef1d0bc94e1ea3fad09";
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [state, state, { status: 202, body: { job_uuid: jobId } }]);
  expect(result.code).toBe(0);
  expect(result.data.job).toEqual({ id: jobId, state: "ACCEPTED" });
  expect(result.requests).toHaveLength(3);
  expect(new URL(result.requests[2]!.url).pathname).toBe("/tags/assets/assignments");
  expect(JSON.parse(result.requests[2]!.init.body as string)).toEqual({ action, assets: [other], tags: [id] });
});

test.each(["add", "remove"])("already desired assignment %s is a no-op", async (action) => {
  const f = fixture();
  const result = await f.run(["assignment", action, "--asset-ids-file", f.file("assets.json", [other]), "--tag-ids-file", f.file("tags.json", [id]), "--execute"],
    [{ body: { tags: action === "add" ? [assigned] : [] } }]);
  expect(result.code).toBe(0);
  expect(result.data.kind).toBe("noop");
  expect(result.requests).toHaveLength(1);
});

test("assignment disconnect is an unknown outcome with no automatic replay", async () => {
  const f = fixture();
  const args = ["assignment", "add", "--asset-ids-file", f.file("assets.json", [other]), "--tag-ids-file", f.file("tags.json", [id])];
  const state = { body: { tags: [] } };
  const preview = await f.run(args, [state]);
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [state, state, "disconnect"]);
  expect(result.data.error).toMatchObject({ code: "OUTCOME_UNKNOWN", auditId: expect.any(String) });
  expect(result.requests).toHaveLength(3);
  expect(result.stdout).not.toContain(syntheticKeys.secretKey);
});

test.each([
  ["category", "create", "--name", "bad:name"], ["value", "show", "--id", "../tag"],
  ["category", "list", "--filter", "permissions:eq:ALL"], ["value", "list", "--with", "West"],
  ["assignment", "add", "--asset-ids-file", "-", "--tag-ids-file", "-"],
  ["exclusion", "list", "--tag-id", id, "--target-type", "users"],
  ["category", "list", "--all", "--limit", "2"], ["value", "list", "--limit", "1", "--limit", "2"],
])("invalid tag invocation fails before credentials or HTTP: %j", async (...args) => {
  const f = fixture();
  delete f.env.TENABLE_AXI_SECRET_KEY;
  const result = await f.run(args);
  expect(result.code).toBe(2);
  expect(result.requests).toHaveLength(0);
});
