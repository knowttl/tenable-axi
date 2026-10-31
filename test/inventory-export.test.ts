import { decode } from "@toon-format/toon";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { afterEach, expect, test, vi } from "vitest";
import { main } from "../src/cli.js";
import { mutationOperations, transportBindings } from "../src/catalogue.js";
import { constructWriteCoordinator } from "../src/writes-core.js";
import { fakeTransport, syntheticKeys, type Reply } from "./support/fake-tenable.js";
import { localFixture } from "./support/local-cli.js";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const job = { export_id: id, status: "PROCESSING", submitted_at: "2026-01-01T00:00:00Z", chunks_available: [1, 3], beta: true };
const fixtures: ReturnType<typeof localFixture>[] = [];
function fixture() {
  const local = localFixture();
  fixtures.push(local);
  Object.assign(local.env, { TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey, TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey });
  local.config({ example: { writes: { allowWrites: true, operations: ["inventory-export-assets", "inventory-export-findings"] } } });
  const credentials = { home: local.home, env: local.env };
  async function run(args: string[], replies: (Reply | "disconnect" | "hang")[] = []) {
    const upstream = fakeTransport(replies, transportBindings);
    let stdout = "";
    const previous = process.exitCode;
    process.exitCode = 0;
    try {
      await main(["export", ...args, "--profile", "example"], { credentials, stdout: { write: (chunk) => { stdout += chunk; } },
        transportFactory: () => upstream.transport,
        writeCoordinatorFactory: (options) => constructWriteCoordinator(options, { credentials,
          operations: mutationOperations, bindings: transportBindings, fetch: upstream.fetch }),
      });
      return { code: process.exitCode, data: decode(stdout) as Record<string, any>, stdout, requests: upstream.requests };
    } finally { process.exitCode = previous; }
  }
  return { ...local, run };
}
afterEach(() => { vi.useRealTimers(); for (const local of fixtures.splice(0)) local.cleanup(); });

test.each(["asset", "finding"])("%s start previews the complete scope then creates once without polling", async (kind) => {
  const f = fixture();
  const body = join(f.home, "scope.json");
  writeFileSync(body, JSON.stringify({ query: { mode: "advanced", text: "Assets HAS aes >= 700" }, filters: [{ property: "name", operator: "match", value: ["example"] }] }));
  const args = [kind, "start", "--body-file", body, "--properties", "id,asset_id", "--file-format", "CSV", "--compress", "true",
    "--use-readable-name", "false", "--max-chunk-file-size", "104857600", "--sort", "name:asc"];
  const preview = await f.run(args);
  expect(preview.code).toBe(0);
  expect(preview.data).toMatchObject({ kind: "dry-run", preview: { proposed: { query: { file_format: "CSV", compress: true, max_chunk_file_size: 104857600 }, body: { filters: [{ property: "name" }] } } } });
  expect(preview.requests).toHaveLength(0);
  const wrong = await f.run([...args, "--execute", "--confirm", "wrong"]);
  expect(wrong.data.error.code).toBe("CONFIRM_MISMATCH");
  expect(wrong.requests).toHaveLength(0);
  const created = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm, "--intent-id", `synthetic-${kind}`], [{ body: { export_id: id } }]);
  expect(created.code).toBe(0);
  expect(created.data).toMatchObject({ job: { id, state: "QUEUED" }, auditId: expect.any(String) });
  expect(created.requests).toHaveLength(1);
  expect(new URL(created.requests[0]!.url).pathname).toBe(`/api/v1/t1/inventory/export/${kind}s`);
  expect(created.requests[0]!.init.method).toBe("POST");
  expect(new URL(created.requests[0]!.url).searchParams.get("properties")).toBe(`${kind}_id,asset_id`);
  const journal = readFileSync(join(f.home, "state/tenable-axi/writes.log"), "utf8");
  expect(journal).toContain('"result":"SUCCESS"');
  expect(journal).not.toContain("Assets HAS");
  expect(journal).not.toContain(syntheticKeys.secretKey);
});

test.each([
  [{ allowWrites: false, operations: [] }, undefined, "WRITES_DISABLED"],
  [{ allowWrites: true, operations: [] }, undefined, "OPERATION_NOT_WRITABLE"],
  [{ allowWrites: true, operations: ["inventory-export-assets"] }, "true", "WRITES_DISABLED"],
])("export creation policy blocks previews and sends: %j", async (writes, forced, code) => {
  const f = fixture();
  f.config({ example: { writes } });
  if (forced) f.env.TENABLE_AXI_READ_ONLY = forced;
  const preview = await f.run(["asset", "start", "--wait"]);
  const execute = await f.run(["asset", "start", "--wait", "--execute", "--confirm", "anything"]);
  expect(preview.data.error.code).toBe(code);
  expect(execute.data.error.code).toBe(code);
  expect([...preview.requests, ...execute.requests]).toHaveLength(0);
});

test("changing export format invalidates the full payload confirmation", async () => {
  const f = fixture();
  const preview = await f.run(["asset", "start", "--file-format", "JSON"]);
  const result = await f.run(["asset", "start", "--file-format", "CSV", "--execute", "--confirm", preview.data.preview.confirm]);
  expect(result.data.error.code).toBe("CONFIRM_MISMATCH");
  expect(result.requests).toHaveLength(0);
});

test.each(["asset", "finding"])("denied %s export explains licensing and the inventory privilege", async (kind) => {
  const f = fixture();
  const args = [kind, "start"];
  const preview = await f.run(args);
  const result = await f.run([...args, "--execute", "--confirm", preview.data.preview.confirm], [{ status: 403, body: { message: "Denied" } }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "PERMISSION_DENIED", status: 403, message: "Not licensed or not permitted for this key" } });
  expect(result.stdout).toContain("EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.EXPORT");
  expect(result.requests).toHaveLength(1);
});

test("long export previews truncate text without changing the confirmation scope", async () => {
  const f = fixture();
  const body = join(f.home, "scope.json");
  const text = "x".repeat(1500);
  writeFileSync(body, JSON.stringify({ query: { mode: "advanced", text } }));
  const compact = await f.run(["asset", "start", "--body-file", body]);
  const full = await f.run(["asset", "start", "--body-file", body, "--full"]);
  expect(compact.code).toBe(0);
  expect(compact.data.preview.proposed.body.query.text).toContain("1500 chars total");
  expect(compact.data.help).toEqual([expect.stringContaining("--full")]);
  expect(full.data.preview.proposed.body.query.text).toBe(text);
  expect(full.data.preview.confirm).toBe(compact.data.preview.confirm);
  expect(full.requests).toHaveLength(0);
});

test.each([
  [{ status: 429, text: "<html>rate limit</html>", headers: { "retry-after": "1" } }, "RATE_LIMITED"],
  ["disconnect", "OUTCOME_UNKNOWN"],
] as const)("export creation never replays an unsuccessful send: %j", async (reply, code) => {
  const f = fixture();
  const preview = await f.run(["finding", "start"]);
  const result = await f.run(["finding", "start", "--wait", "--execute", "--confirm", preview.data.preview.confirm], [reply]);
  expect(result.code).toBe(1);
  expect(result.data.error).toMatchObject({ code, auditId: expect.any(String) });
  expect(result.requests).toHaveLength(1);
  expect(result.stdout).not.toContain("<html>");
});

test.each([
  ["asset", "jobs", "--offset", "1"], ["asset", "jobs", "--limit", "1001"], ["asset", "jobs", "--status", "DONE"],
  ["inventory", "status", "--id", "../bad"], ["inventory", "download", "--id", id, "--chunk", "1"],
  ["asset", "start", "--compress", "yes"], ["asset", "start", "--max-chunk-file-size", "1"],
  ["asset", "start", "--execute", "--dry-run"], ["asset", "start", "--file-format", "XML"],
])("invalid invocation fails before credentials or HTTP: %j", async (...args) => {
  const f = fixture();
  delete f.env.TENABLE_AXI_SECRET_KEY;
  const result = await f.run(args);
  expect(result.code).toBe(2);
  expect(result.data.error.code).toBe("VALIDATION_ERROR");
  expect(result.requests).toHaveLength(0);
});

test.each([{ query: { mode: "simple", text: "example", access_control: {} } }, { filters: [{ property: "name", operator: "=", value: ["x"], permissions: [] }] }])(
  "export body rejects nested unknown fields before credentials", async (body) => {
    const f = fixture();
    delete f.env.TENABLE_AXI_SECRET_KEY;
    const path = join(f.home, "body.json");
    writeFileSync(path, JSON.stringify(body));
    const result = await f.run(["asset", "start", "--body-file", path]);
    expect(result.code).toBe(2);
    expect(result.requests).toHaveLength(0);
  },
);

test.each(["asset", "finding"])("%s jobs bounds history without inventing continuation", async (kind) => {
  const result = await fixture().run([kind, "jobs", "--status", "PROCESSING", "--limit", "2"], [{ body: { exports: [job] } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ jobs: [{ id, state: "PROCESSING", createdAt: job.submitted_at }], count: 1, total: null, complete: false, reason: "SERVER_HISTORY_LIMIT" });
  expect(result.data).not.toHaveProperty("cursor");
  expect(new URL(result.requests[0]!.url).searchParams.toString()).toBe("limit=2&status=PROCESSING");
});

test("empty job history is a definitive bounded success", async () => {
  const result = await fixture().run(["asset", "jobs"], [{ body: { exports: [] } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ jobs: [], count: 0, message: expect.stringContaining("0 export jobs") });
});

test.each([{ unexpected: [] }, { exports: [{ ...job, status: "DONE" }] }])("malformed job history fails rather than reporting zero jobs: %j", async (body) => {
  const result = await fixture().run(["finding", "jobs"], [{ body }]);
  expect(result.code).toBe(1);
  expect(result.data.error.code).toBe("RESPONSE_INVALID");
  expect(result.data).not.toHaveProperty("jobs");
});

test("separate status reads show job progress with no implicit polling", async () => {
  vi.useFakeTimers();
  const f = fixture();
  const first = await f.run(["inventory", "status", "--id", id], [{ body: job }]);
  expect(first.data.job).toEqual({ id, state: "PROCESSING", availableChunks: [1, 3] });
  expect(first.requests).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(first.requests).toHaveLength(1);
  const second = await f.run(["inventory", "status", "--id", id], [{ body: { ...job, status: "FINISHED" } }]);
  expect(second.data.job.state).toBe("FINISHED");
  expect(second.requests).toHaveLength(1);
});

test("inventory wait observes completion even when state is omitted from output fields", async () => {
  vi.useFakeTimers();
  const pending = fixture().run(["inventory", "status", "--id", id, "--wait", "--fields", "id,availableChunks"], [
    { body: job }, { body: { ...job, status: "FINISHED", chunks_available: [1, 3, 4] } },
  ]);
  await vi.advanceTimersByTimeAsync(1000);
  const result = await pending;
  expect(result.code).toBe(0);
  expect(result.data.job).toEqual({ id, availableChunks: [1, 3, 4] });
  expect(result.data).not.toHaveProperty("complete");
  expect(result.requests).toHaveLength(2);
});

test.each(["asset", "finding"])("%s start waits after confirmation without polling its preview", async (kind) => {
  vi.useFakeTimers();
  const f = fixture();
  const preview = await f.run([kind, "start", "--wait"]);
  expect(preview.requests).toHaveLength(0);
  const pending = f.run([kind, "start", "--wait", "--execute", "--confirm", preview.data.preview.confirm], [
    { body: { export_id: id } }, { body: job }, { body: { ...job, status: "FINISHED" } },
  ]);
  await vi.advanceTimersByTimeAsync(1000);
  const result = await pending;
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ job: { id, state: "FINISHED" }, auditId: expect.any(String) });
  expect(result.requests.map(({ init }) => init.method)).toEqual(["POST", "GET", "GET"]);
  expect(result.requests[2]!.url).toBe(`https://cloud.tenable.com/api/v1/t1/inventory/export/${id}/status`);
});

test("inventory wait preserves the last observed job on a mismatched status response", async () => {
  vi.useFakeTimers();
  const pending = fixture().run(["inventory", "status", "--id", id, "--wait"], [
    { body: job }, { body: { ...job, export_id: other, status: "FINISHED" } },
  ]);
  await vi.advanceTimersByTimeAsync(1000);
  const result = await pending;
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ job: { id, state: "PROCESSING", availableChunks: [1, 3] }, complete: false, error: { code: "RESPONSE_INVALID" } });
  expect(result.requests).toHaveLength(2);
});

test("inventory start wait retains the created job if status access is denied", async () => {
  const f = fixture();
  const preview = await f.run(["asset", "start"]);
  const result = await f.run(["asset", "start", "--wait", "--execute", "--confirm", preview.data.preview.confirm], [
    { body: { export_id: id } }, { status: 403 },
  ]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ job: { id, state: "QUEUED" }, auditId: expect.any(String), complete: false, error: { code: "PERMISSION_DENIED" } });
  expect(result.requests.map(({ init }) => init.method)).toEqual(["POST", "GET"]);
});

test("inventory start wait shares the creation deadline without a replacement job", async () => {
  vi.useFakeTimers();
  const f = fixture();
  const preview = await f.run(["asset", "start"]);
  const pending = f.run(["asset", "start", "--wait", "--execute", "--confirm", preview.data.preview.confirm], [
    { body: { export_id: id } }, { body: job }, "hang",
  ]);
  await vi.advanceTimersByTimeAsync(20000);
  const result = await pending;
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ job: { id, state: "PROCESSING" }, auditId: expect.any(String), complete: false, reason: "POLL_BUDGET_EXCEEDED" });
  expect(result.requests.map(({ init }) => init.method)).toEqual(["POST", "GET", "GET"]);
  expect(vi.getTimerCount()).toBe(0);
});

test("inventory wait returns pending state when retries exhaust its request budget", async () => {
  vi.useFakeTimers();
  const pending = fixture().run(["inventory", "status", "--id", id, "--wait"], [
    { status: 503 }, { status: 503 }, ...Array.from({ length: 18 }, () => ({ body: job })),
  ]);
  await vi.advanceTimersByTimeAsync(20000);
  const result = await pending;
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ job: { id, state: "PROCESSING", availableChunks: [1, 3] }, complete: false, reason: "POLL_BUDGET_EXCEEDED" });
  expect(result.requests).toHaveLength(20);
  expect(vi.getTimerCount()).toBe(0);
});

test.each([
  [{ status: 404, body: { status: 404, message: "Unknown export" } }, "NOT_FOUND"],
  [{ status: 403, body: { message: "Denied" } }, "PERMISSION_DENIED"],
  [{ text: "" }, "RESPONSE_INVALID"], [{ text: "not json" }, "RESPONSE_INVALID"],
  [{ body: { ...job, export_id: other } }, "RESPONSE_INVALID"],
  [{ body: { ...job, chunks_available: ["1"] } }, "RESPONSE_INVALID"],
])("status failures cannot become empty or wrong-job success: %j", async (reply, code) => {
  const result = await fixture().run(["inventory", "status", "--id", id], [reply]);
  expect(result.code).toBe(1);
  expect(result.data.error.code).toBe(code);
  expect(result.data).not.toHaveProperty("job");
});

test.each([false, true])("chunk download redacts JSON before publishing (gzip=%s)", async (compressed) => {
  const f = fixture();
  const path = join(f.home, "export.json");
  const raw = Buffer.from(JSON.stringify([{ name: syntheticKeys.secretKey, password: "synthetic-password", "Access Key": "synthetic-readable-key", description: "AccountKey=synthetic-key;", extra: { token: "synthetic-token" } }]));
  const result = await f.run(["inventory", "download", "--id", id, "--chunk", "3", "--output", path], [{ bytes: compressed ? gzipSync(raw) : raw }]);
  expect(result.code).toBe(0);
  expect(result.requests).toHaveLength(1);
  expect(new URL(result.requests[0]!.url).pathname).toBe(`/api/v1/t1/inventory/export/${id}/download/3`);
  const contents = readFileSync(path);
  const text = (compressed ? gunzipSync(contents) : contents).toString("utf8");
  expect(JSON.parse(text)).toEqual([{ name: "***redacted***", password: "***redacted***", "Access Key": "***redacted***", description: "AccountKey=***redacted***;", extra: { token: "***redacted***" } }]);
  expect(result.data.file).toMatchObject({ bytes: contents.length, format: "JSON", compressed });
  expect(result.stdout).not.toContain("synthetic-password");
  expect(readdirSync(f.home).filter((name) => name.endsWith(".tmp"))).toEqual([]);
});

test.each([false, true])("inventory chunk download rejects Navigator objects (gzip=%s)", async (compressed) => {
  const f = fixture();
  const path = join(f.home, "export.json");
  const before = readdirSync(f.home);
  const raw = Buffer.from(JSON.stringify({ name: "Synthetic heatmap", versions: { layer: "4.5" }, domain: "enterprise-attack", techniques: [] }));
  const result = await f.run(["inventory", "download", "--id", id, "--chunk", "1", "--output", path], [{ bytes: compressed ? gzipSync(raw) : raw }]);
  expect(result.code).toBe(1);
  expect(result.data.error.code).toBe("RESPONSE_INVALID");
  expect(readdirSync(f.home)).toEqual(before);
});

test("CSV secret columns and quoted multiline cells survive format-aware redaction", async () => {
  const f = fixture();
  const path = join(f.home, "export.csv");
  const result = await f.run(["inventory", "download", "--id", id, "--chunk", "1", "--output", path], [
    { text: 'Name,Access Key,Description\r\n"unclosed' },
  ]);
  expect(result.code).toBe(1);
  expect(existsSync(path)).toBe(false);
  const valid = await f.run(["inventory", "download", "--id", id, "--chunk", "1", "--output", path], [
    { text: `Name,Access Key,Description\r\n"example, device",synthetic-column-key,"line one\n${syntheticKeys.accessKey} ""quoted"""\r\n` },
  ]);
  expect(valid.code).toBe(0);
  expect(readFileSync(path, "utf8")).toBe('"Name","Access Key","Description"\n"example, device","***redacted***","line one\n***redacted*** ""quoted"""');
});

test.each([false, true])("single-column CSV downloads preserve rows and redaction (gzip=%s)", async (compressed) => {
  const f = fixture();
  const path = join(f.home, "export.csv");
  const raw = Buffer.from(`asset_id\r\nexample-asset\r\n${syntheticKeys.accessKey}\r\n`);
  const result = await f.run(["inventory", "download", "--id", id, "--chunk", "1", "--output", path], [
    { bytes: compressed ? gzipSync(raw) : raw },
  ]);
  expect(result.code).toBe(0);
  const contents = readFileSync(path);
  expect((compressed ? gunzipSync(contents) : contents).toString("utf8")).toBe('"asset_id"\n"example-asset"\n"***redacted***"');
  expect(result.data.file).toMatchObject({ bytes: contents.length, format: "CSV", compressed });
});

test.each([false, true])("single-column CSV downloads allow header-only exports (gzip=%s)", async (compressed) => {
  const f = fixture();
  const path = join(f.home, "export.csv");
  const raw = Buffer.from("asset_id\r\n");
  const result = await f.run(["inventory", "download", "--id", id, "--chunk", "1", "--output", path], [
    { bytes: compressed ? gzipSync(raw) : raw },
  ]);
  expect(result.code).toBe(0);
  const contents = readFileSync(path);
  expect((compressed ? gunzipSync(contents) : contents).toString("utf8")).toBe('"asset_id"');
});

test("download refuses overwrite before sending", async () => {
  const f = fixture();
  const path = join(f.home, "existing.json");
  writeFileSync(path, "keep");
  const result = await f.run(["inventory", "download", "--id", id, "--chunk", "1", "--output", path]);
  expect(result.data.error.code).toBe("OUTPUT_EXISTS");
  expect(result.requests).toHaveLength(0);
  expect(readFileSync(path, "utf8")).toBe("keep");
});

test.each([
  [{ status: 204, bytes: undefined }, "EXPORT_NOT_READY"],
  [{ status: 404, body: { message: "Unknown chunk" } }, "NOT_FOUND"],
  [{ text: "" }, "RESPONSE_INVALID"], [{ text: "<html>error</html>" }, "RESPONSE_INVALID"],
  [{ text: '[{"name":' }, "RESPONSE_INVALID"], [{ text: 'Name,Value\n"unclosed,value' }, "RESPONSE_INVALID"],
])("failed chunk download leaves no published or temporary file: %j", async (reply, code) => {
  const f = fixture();
  const path = join(f.home, "export.json");
  const before = readdirSync(f.home);
  const result = await f.run(["inventory", "download", "--id", id, "--chunk", "1", "--output", path], [reply]);
  expect(result.code).toBe(1);
  expect(result.data.error.code).toBe(code);
  expect(readdirSync(f.home)).toEqual(before);
});

test("gzip expansion above the 128 MiB ceiling aborts without publishing", async () => {
  const f = fixture();
  const path = join(f.home, "export.json.gz");
  const bomb = gzipSync(Buffer.alloc(128 * 1024 * 1024 + 1, 32));
  const result = await f.run(["inventory", "download", "--id", id, "--chunk", "1", "--output", path], [{ bytes: bomb }]);
  expect(result.code).toBe(1);
  expect(result.data.error.code).toBe("RESPONSE_INVALID");
  expect(existsSync(path)).toBe(false);
});

test("file downloads support chunks above the ordinary JSON response budget", async () => {
  const f = fixture();
  const path = join(f.home, "large.json");
  const raw = Buffer.from(JSON.stringify([{ description: "x".repeat(21 * 1024 * 1024) }]));
  const result = await f.run(["inventory", "download", "--id", id, "--chunk", "1", "--output", path], [{ bytes: raw }]);
  expect(result.code).toBe(0);
  expect(statSync(path).size).toBe(raw.length);
  expect(result.data.file.bytes).toBe(raw.length);
});

test("encoded file bytes above the 128 MiB ceiling abort before publishing", async () => {
  const f = fixture();
  const path = join(f.home, "oversize.json");
  const result = await f.run(["inventory", "download", "--id", id, "--chunk", "1", "--output", path], [{ bytes: Buffer.alloc(128 * 1024 * 1024 + 1) }]);
  expect(result.code).toBe(1);
  expect(result.data.error.code).toBe("BYTE_BUDGET_EXCEEDED");
  expect(existsSync(path)).toBe(false);
});
