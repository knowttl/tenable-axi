import { decode } from "@toon-format/toon";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { main } from "../src/cli.js";
import { constructWriteCoordinator } from "../src/writes-core.js";
import { fakeTransport, syntheticKeys, type Reply } from "./support/fake-tenable.js";
import { localFixture } from "./support/local-cli.js";

const fixtures: ReturnType<typeof localFixture>[] = [];
function fixture(writes?: unknown) {
  const local = localFixture();
  fixtures.push(local);
  Object.assign(local.env, { TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey, TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey });
  local.config({ example: writes === undefined ? {} : { writes } });
  const credentials = { home: local.home, env: local.env };
  async function run(args: string[], replies: Reply[] = []) {
    const upstream = fakeTransport(replies.map((reply) => reply.body !== undefined
      ? { ...reply, headers: { "content-type": "application/json", ...reply.headers } } : reply), {});
    let stdout = "";
    let stderr = "";
    const chunks: Uint8Array[] = [];
    const previous = process.exitCode;
    process.exitCode = 0;
    try {
      await main(["raw", ...args, "--profile", "example"], { credentials, stdout: { write: (chunk) => { stdout += chunk; } },
        stderr: { write: (chunk) => { stderr += chunk; } }, rawOutput: (chunk) => { chunks.push(chunk); },
        transportFactory: () => upstream.transport,
        writeCoordinatorFactory: (options) => constructWriteCoordinator(options, { credentials, operations: {}, bindings: {}, fetch: upstream.fetch }),
      });
      return { code: process.exitCode, data: stdout ? decode(stdout) as Record<string, any> : {}, bytes: Buffer.concat(chunks), stderr, requests: upstream.requests };
    } finally { process.exitCode = previous; }
  }
  const journal = join(local.home, "state/tenable-axi/writes.log");
  const body = join(local.home, "body.json");
  writeFileSync(body, JSON.stringify({ name: "Example" }));
  return { ...local, run, journal, body };
}
afterEach(() => { for (const local of fixtures.splice(0)) local.cleanup(); });

const writable = { allowWrites: true, operations: ["raw-write"] };
const patch = (f: ReturnType<typeof fixture>) => ["--method", "PATCH", "--path", "/api/v1/example", "--body-file", f.body];

test("raw get returns the upstream body for an arbitrary read route with its query", async () => {
  const f = fixture();
  const result = await f.run(["get", "--path", "/api/v1/t1/tags/properties", "--query", "limit=5&tag=a&tag=b"],
    [{ body: { items: [{ id: "a" }] } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ status: 200, body: { items: [{ id: "a" }] } });
  const url = new URL(result.requests[0]!.url);
  expect(url.pathname).toBe("/api/v1/t1/tags/properties");
  expect(url.searchParams.getAll("tag")).toEqual(["a", "b"]);
  expect(url.searchParams.get("limit")).toBe("5");
  expect(result.requests[0]!.init.method).toBe("GET");
});

test.each([
  "api/v1/t1/tags",
  "/api/v1/t1/tags?limit=1",
  "/api/v1/../t1/tags",
  "/api/v1//tags",
  "/api/v1/t1/%2e%2e/tags",
  "/users",
  "/api/v3/access-control/permissions",
  "/access-control/v1/roles",
  "/access-groups",
  "/v2/access-groups/example",
  "/credentials",
  "/filters/credentials",
  "/sensors/ot/linking-key",
  "/scanners/example/key",
  "/api-keys",
])("raw get refuses %s before any request", async (path) => {
  const f = fixture();
  const result = await f.run(["get", "--path", path]);
  expect(result.data.error.code).toBe("VALIDATION_ERROR");
  expect(result.requests).toHaveLength(0);
});

test.each(["POST", "PUT", "PATCH", "DELETE"])("raw write refuses access groups with %s before preview", async (method) => {
  const f = fixture(writable);
  const result = await f.run(["write", "--method", method, "--path", "/v2/access-groups/example", "--execute", "--confirm", "any"]);
  expect(result.data.error.code).toBe("VALIDATION_ERROR");
  expect(result.requests).toHaveLength(0);
  expect(existsSync(f.journal)).toBe(false);
});

test.each([
  ["POST", "/sensors/ot/linking-key"], ["PUT", "/credentials/example"],
  ["PATCH", "/credentials/example"], ["DELETE", "/credentials/example"], ["POST", "/scanners/example/key"],
])("raw write refuses %s %s before preview", async (method, path) => {
  const f = fixture(writable);
  const result = await f.run(["write", "--method", method, "--path", path, "--execute", "--confirm", "any"]);
  expect(result.data.error.code).toBe("VALIDATION_ERROR");
  expect(result.requests).toHaveLength(0);
  expect(existsSync(f.journal)).toBe(false);
});

test("raw get streams non-JSON bytes with their content type", async () => {
  const f = fixture();
  const bytes = Buffer.from([0x1f, 0x8b, 0xff, 0x00]);
  const result = await f.run(["get", "--path", "/api/v1/export/example/download"],
    [{ bytes, headers: { "content-type": "application/gzip" } }]);
  expect(result.code).toBe(0);
  expect(result.bytes).toEqual(bytes);
  expect(result.stderr).toBe("Content-Type: application/gzip\n");
});

test("raw get saves downloaded bytes to a new output file", async () => {
  const f = fixture();
  const out = join(f.home, "chunk.gz");
  const bytes = Buffer.from([0x1f, 0x8b, 0xff, 0x00]);
  const result = await f.run(["get", "--path", "/api/v1/t1/inventory/export/example/download/1", "--out", out],
    [{ bytes, headers: { "content-type": "application/gzip" } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ status: 200, contentType: "application/gzip", output: out });
  expect(readFileSync(out)).toEqual(bytes);
});

test("raw get refuses to overwrite an output file", async () => {
  const f = fixture();
  const out = join(f.home, "existing");
  writeFileSync(out, "original");
  const result = await f.run(["get", "--path", "/api/v1/export/example/download", "--out", out],
    [{ bytes: Buffer.from("replacement"), headers: { "content-type": "text/csv" } }]);
  expect(result.code).toBe(1);
  expect(readFileSync(out, "utf8")).toBe("original");
});

test("raw get passes through non-JSON bytes labelled as JSON", async () => {
  const f = fixture();
  const bytes = Buffer.from([0xff, 0x00]);
  const result = await f.run(["get", "--path", "/api/v1/example"], [{ bytes, headers: { "content-type": "application/json" } }]);
  expect(result.code).toBe(0);
  expect(result.bytes).toEqual(bytes);
});

test("raw write passes through a non-JSON response after journaling", async () => {
  const f = fixture(writable);
  const preview = await f.run(["write", ...patch(f)]);
  const bytes = Buffer.from([0xff, 0x00]);
  const result = await f.run(["write", ...patch(f), "--execute", "--confirm", preview.data.preview.confirm],
    [{ bytes, headers: { "content-type": "application/octet-stream" } }]);
  expect(result.code).toBe(0);
  expect(result.bytes).toEqual(bytes);
  expect(result.stderr).toBe("Content-Type: application/octet-stream\n");
  const records = readFileSync(f.journal, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(records.map((record) => [record.kind, record.result ?? null])).toEqual([["intent", null], ["outcome", "SUCCESS"]]);
});

test("raw get reports an upstream permission denial as a permission error", async () => {
  const f = fixture();
  const result = await f.run(["get", "--path", "/api/v1/t1/tags/properties"], [{ status: 403, body: { message: "Denied" } }]);
  expect(result.code).toBe(1);
  expect(result.data.error.code).toBe("PERMISSION_DENIED");
});

test("raw get still answers when forced read-only blocks writes", async () => {
  const f = fixture(writable);
  f.env.TENABLE_AXI_READ_ONLY = "true";
  const result = await f.run(["get", "--path", "/api/v1/t1/tags/properties"], [{ body: { items: [] } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ status: 200 });
});

test("raw write is refused before any request when the profile does not enable writes", async () => {
  const f = fixture();
  const result = await f.run(["write", ...patch(f)]);
  expect(result.data.error.code).toBe("WRITES_DISABLED");
  expect(result.requests).toHaveLength(0);
  expect(existsSync(f.journal)).toBe(false);
});

test("raw write is refused when raw-write is absent from the operation list", async () => {
  const f = fixture({ allowWrites: true, operations: [] });
  const result = await f.run(["write", ...patch(f)]);
  expect(result.data.error.code).toBe("OPERATION_NOT_WRITABLE");
  expect(result.requests).toHaveLength(0);
});

test("forced read-only blocks raw writes even with execution flags", async () => {
  const f = fixture(writable);
  f.env.TENABLE_AXI_READ_ONLY = "true";
  const result = await f.run(["write", ...patch(f), "--execute", "--confirm", "any"]);
  expect(result.data.error.code).toBe("WRITES_DISABLED");
  expect(result.requests).toHaveLength(0);
});

test("raw write previews the exact method and path without sending", async () => {
  const f = fixture(writable);
  const result = await f.run(["write", ...patch(f)]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ kind: "dry-run", preview: { operation: "raw-write", target: { kind: "PATCH /api/v1/example" } } });
  expect(result.requests).toHaveLength(0);
  expect(existsSync(f.journal)).toBe(false);
});

test("raw write refuses access-control fields in the body before any request", async () => {
  const f = fixture(writable);
  writeFileSync(f.body, JSON.stringify({ name: "Example", permissions: ["admin"] }));
  const result = await f.run(["write", ...patch(f)]);
  expect(result.data.error.code).toBe("VALIDATION_ERROR");
  expect(result.requests).toHaveLength(0);
});

test("raw write rejects a confirmation that does not match the preview", async () => {
  const f = fixture(writable);
  const result = await f.run(["write", ...patch(f), "--execute", "--confirm", "wrong"]);
  expect(result.data.error.code).toBe("CONFIRM_MISMATCH");
  expect(result.requests).toHaveLength(0);
  expect(existsSync(f.journal)).toBe(false);
});

test("raw write sends the confirmed method, path and body once and journals the outcome", async () => {
  const f = fixture(writable);
  const preview = await f.run(["write", ...patch(f)]);
  const created = await f.run(["write", ...patch(f), "--execute", "--confirm", preview.data.preview.confirm, "--intent-id", "synthetic-raw"],
    [{ status: 200, body: { id: "example" } }]);
  expect(created.code).toBe(0);
  expect(created.data).toMatchObject({ status: 200, auditId: expect.any(String), response: { id: "example" } });
  expect(created.requests).toHaveLength(1);
  const sent = created.requests[0]!;
  expect(sent.init.method).toBe("PATCH");
  expect(new URL(sent.url).pathname).toBe("/api/v1/example");
  expect(JSON.parse(String(sent.init.body))).toEqual({ name: "Example" });
  const records = readFileSync(f.journal, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(records.map((record) => [record.kind, record.result ?? null])).toEqual([["intent", null], ["outcome", "SUCCESS"]]);
});
