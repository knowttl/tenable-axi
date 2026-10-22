import { afterEach, expect, test, vi } from "vitest";
import { existsSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { decode } from "@toon-format/toon";
import { main } from "../src/cli.js";
import { mutationOperations, transportBindings } from "../src/catalogue.js";
import { constructWriteCoordinator } from "../src/writes-core.js";
import { fakeHttpsTenable, fakeTransport, syntheticKeys, type Reply } from "./support/fake-tenable.js";
import { localFixture } from "./support/local-cli.js";

const id = "00000000-0000-4000-8000-000000000001";
const operation = "apa-export-attack-path";
const fixtures: ReturnType<typeof localFixture>[] = [];
function fixture(kind = "attack-path", body: unknown = { file_format: "JSON" }) {
  const local = localFixture(); fixtures.push(local);
  Object.assign(local.env, { TENABLE_AXI_ACCESS_KEY: syntheticKeys.accessKey, TENABLE_AXI_SECRET_KEY: syntheticKeys.secretKey });
  local.config({ example: { writes: { allowWrites: true, operations: [`apa-export-${kind}`] } } });
  const bodyFile = join(local.home, "body.json"), output = join(local.home, "export.dat");
  writeFileSync(bodyFile, JSON.stringify(body));
  const start = ["export", kind, "start", "--body-file", bodyFile, "--profile", "example"];
  const status = ["export", "attack", "status", "--id", id];
  const download = ["export", "attack", "download", "--id", id, "--output", output];
  async function run(args: string[], replies: (Reply | "disconnect" | "hang")[] = []) {
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
  async function confirm() {
    const preview = await run(start);
    expect(preview.code).toBe(0);
    expect(preview.requests).toHaveLength(0);
    return (preview.data.preview as { confirm: string }).confirm;
  }
  return { ...local, run, confirm, bodyFile, output, start, status, download,
    journal: () => readFileSync(join(local.home, "state/tenable-axi/writes.log"), "utf8") };
}
afterEach(() => { for (const local of fixtures.splice(0)) local.cleanup(); vi.useRealTimers(); });

test.each(["attack-path", "attack-technique", "mitre-heatmap"])("%s creates one job after exact preview confirmation without polling", async (kind) => {
  const f = fixture(kind);
  const result = await f.run([...f.start, "--execute", "--confirm", await f.confirm()], [{ status: 202, body: { export_id: id, beta: true } }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ job: { id, state: "SUBMITTED" }, auditId: expect.any(String) });
  expect(result.requests).toHaveLength(1);
  expect(result.requests[0]).toMatchObject({ url: `https://cloud.tenable.com/api/v1/export/${kind}`, init: { method: "POST" } });
  const journal = f.journal();
  expect(journal).toContain('"result":"SUCCESS"');
  expect(journal).not.toMatch(/file_format|headers|synthetic|body/);
});

test.each([
  { policy: { allowWrites: false, operations: [operation] }, forced: undefined, execute: false, code: "WRITES_DISABLED" },
  { policy: { allowWrites: true, operations: [] }, forced: undefined, execute: false, code: "OPERATION_NOT_WRITABLE" },
  { policy: { allowWrites: true, operations: [operation] }, forced: "true", execute: false, code: "WRITES_DISABLED" },
  { policy: { allowWrites: true, operations: [operation] }, forced: undefined, execute: true, code: "CONFIRM_MISMATCH" },
])("creation refuses $code before sending", async ({ policy, forced, execute, code }) => {
  const f = fixture();
  f.config({ example: { writes: policy } }); f.env.TENABLE_AXI_READ_ONLY = forced;
  const result = await f.run([...f.start, ...(execute ? ["--execute", "--confirm", "wrong"] : [])]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code } });
  expect(result.requests).toHaveLength(0);
  expect(existsSync(join(f.home, "state/tenable-axi/writes.log"))).toBe(false);
});

test("a denied creation explains the attack-path WRITE privilege", async () => {
  const f = fixture();
  const result = await f.run([...f.start, "--execute", "--confirm", await f.confirm()], [{ status: 403, body: { message: "Denied" } }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "PERMISSION_DENIED", status: 403 } });
  expect(result.stdout).toContain("EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE");
  expect(result.requests).toHaveLength(1);
});

test("an interrupted creation records unknown outcome and never replays", async () => {
  const f = fixture();
  const result = await f.run([...f.start, "--execute", "--confirm", await f.confirm()], ["disconnect"]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "OUTCOME_UNKNOWN", auditId: expect.any(String) } });
  expect(result.stdout).toContain("export attack status");
  expect(result.stdout).not.toContain(syntheticKeys.secretKey);
  expect(result.requests).toHaveLength(1);
  expect(f.journal()).toContain('"result":"OUTCOME_UNKNOWN"');
});

test("a rate-limited creation reports the delay without replay", async () => {
  const f = fixture();
  const result = await f.run([...f.start, "--execute", "--confirm", await f.confirm()], [{ status: 429, text: "<html>busy</html>", headers: { "retry-after": "2" } }]);
  expect(result.data).toMatchObject({ error: { code: "RATE_LIMITED", retryAfter: 2000 } });
  expect(result.requests).toHaveLength(1);
  expect(result.stdout).not.toContain("<html>");
});

test("path export preserves its lowercase nested filter, selected vectors, columns and sort", async () => {
  const body = { file_format: "CSV", filters: { operator: "and", value: [{ operator: "or", value: [{ property: "priority", operator: "eq", value: "critical" }] }] },
    vector_ids: ["synthetic-vector"], columns: ["path_name", "priority"], file_name: "synthetic-export", sort: { property: "priority", direction: "desc" } };
  const f = fixture("attack-path", body);
  const preview = await f.run(f.start);
  expect(preview.data).toMatchObject({ preview: { proposed: { body }, target: { kind: "attack-export", payload: true } } });
  const result = await f.run([...f.start, "--execute", "--confirm", await f.confirm()], [{ status: 202, body: { export_id: id } }]);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.requests[0]!.init.body as string)).toEqual(body);
});

test("large filter text is previewed compactly without changing exact confirmation", async () => {
  const query = "a".repeat(1001);
  const f = fixture("mitre-heatmap", { file_format: "JSON", filter: { query } });
  const compact = await f.run(f.start);
  const full = await f.run([...f.start, "--full"]);
  expect(compact.stdout).toContain("truncated, 1001 chars total");
  expect(compact.stdout).toContain("--full");
  expect(full.data).toMatchObject({ preview: { proposed: { body: { filter: { query } } } } });
  expect((compact.data.preview as { confirm: string }).confirm).toBe((full.data.preview as { confirm: string }).confirm);
});

test.each([
  {}, { file_format: "JSON", access_control: {} },
  { file_format: "JSON", filters: { operator: "AND", value: [] } },
  { file_format: "JSON", filters: { property: "name", operator: "eq", value: "example", permissions: [] } },
  { file_format: "JSON", columns: ["unreviewed"] },
])("invalid export input is rejected before credential resolution: %j", async (body) => {
  const f = fixture("attack-path", body); delete f.env.TENABLE_AXI_SECRET_KEY;
  const result = await f.run(f.start);
  expect(result.code).toBe(2);
  expect(result.requests).toHaveLength(0);
});

test("status uses the attack job namespace and does not poll by default", async () => {
  const f = fixture();
  const fake = await fakeHttpsTenable([{ body: { export_id: id, status: "PROCESSING", beta: true } }]);
  try {
    const result = await f.cli(f.status, {}, () => fake.transport(transportBindings));
    expect(result.code).toBe(0);
    expect(result.data).toMatchObject({ job: { id, state: "PROCESSING" } });
    expect(fake.requests.map(({ url }) => url)).toEqual([`/api/v1/export/${id}/status`]);
  } finally { await fake.close(); }
});

test("explicit wait polls pending jobs with fake time until completion", async () => {
  vi.useFakeTimers();
  const f = fixture();
  const resultPromise = f.run([...f.status, "--wait"], [
    { body: { export_id: id, status: "QUEUED" } }, { body: { export_id: id, status: "PROCESSING" } }, { body: { export_id: id, status: "FINISHED" } },
  ]);
  await vi.advanceTimersByTimeAsync(2000);
  const result = await resultPromise;
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ job: { id, state: "FINISHED" } });
  expect(result.requests).toHaveLength(3);
});

test("explicit wait returns a pending job when its polling budget ends", async () => {
  vi.useFakeTimers();
  const f = fixture();
  const resultPromise = f.run([...f.status, "--wait"], Array.from({ length: 19 }, () => ({ body: { export_id: id, status: "PROCESSING" } })));
  await vi.advanceTimersByTimeAsync(19000);
  const result = await resultPromise;
  expect(result.data).toMatchObject({ job: { state: "PROCESSING" }, complete: false, reason: "POLL_BUDGET_EXCEEDED" });
  expect(result.requests.length).toBeLessThanOrEqual(20);
  expect(vi.getTimerCount()).toBe(0);
});

test.each(["QUEUED", "PROCESSING"])("explicit wait preserves the last %s status when recovered retries exhaust requests", async (status) => {
  vi.useFakeTimers();
  const f = fixture();
  const submittedAt = "2026-01-01T00:00:00Z", lastRefreshedAt = "2026-01-01T00:00:17Z";
  const resultPromise = f.run([...f.status, "--wait", "--fields", "id,state,submittedAt,lastRefreshedAt"], [
    { status: 503 }, { status: 503 },
    ...Array.from({ length: 17 }, () => ({ body: { export_id: id, status: "QUEUED" } })),
    { body: { export_id: id, status, submitted_at: submittedAt, last_refreshed_at: lastRefreshedAt } },
  ]);
  await vi.advanceTimersByTimeAsync(19000);
  const result = await resultPromise;
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ job: { id, state: status, submittedAt, lastRefreshedAt }, complete: false, reason: "POLL_BUDGET_EXCEEDED" });
  expect(result.requests).toHaveLength(20);
  expect(vi.getTimerCount()).toBe(0);
});

test.each(["QUEUED", "PROCESSING"])("explicit wait preserves the last %s status when an in-flight poll reaches the deadline", async (status) => {
  vi.useFakeTimers();
  const f = fixture();
  const submittedAt = "2026-01-01T00:00:00Z", lastRefreshedAt = "2026-01-01T00:00:01Z";
  const resultPromise = f.run([...f.status, "--wait", "--fields", "id,state,submittedAt,lastRefreshedAt"], [
    { body: { export_id: id, status, submitted_at: submittedAt, last_refreshed_at: lastRefreshedAt } }, "hang",
  ]);
  await vi.advanceTimersByTimeAsync(20000);
  const result = await resultPromise;
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ job: { id, state: status, submittedAt, lastRefreshedAt }, complete: false, reason: "POLL_BUDGET_EXCEEDED" });
  expect(result.requests).toHaveLength(2);
  expect(vi.getTimerCount()).toBe(0);
});

test.each([false, true])("status fails on deadline without a validated status with wait=%s", async (wait) => {
  vi.useFakeTimers();
  const f = fixture();
  const resultPromise = f.run([...f.status, ...(wait ? ["--wait"] : [])], ["hang"]);
  await vi.advanceTimersByTimeAsync(20000);
  const result = await resultPromise;
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "DEADLINE_EXCEEDED" } });
  expect(result.data).not.toHaveProperty("job");
  expect(result.requests).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

test.each(["status", "download"])("unknown attack job on %s is an error rather than empty success", async (verb) => {
  const f = fixture();
  const result = await f.run(verb === "status" ? f.status : f.download, [{ status: 404, body: { message: "Request not found", status: 404 } }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "NOT_FOUND", status: 404 } });
  expect(existsSync(f.output)).toBe(false);
});

test.each([{}, { export_id: id }, { export_id: "00000000-0000-4000-8000-000000000002", status: "FINISHED" }, "not-json"])("malformed or mismatched status cannot imply completion: %j", async (body) => {
  const f = fixture();
  const result = await f.run(f.status, [typeof body === "string" ? { text: body } : { body }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "RESPONSE_INVALID" } });
});

test("JSON downloads redact nested key names, exact credentials and encoded sentinels before publishing metadata", async () => {
  const f = fixture();
  const body = [{ path_name: "Synthetic", password: "hidden-password", nested: { token: "hidden-token", name: syntheticKeys.secretKey },
    note: encodeURIComponent(`accessKey=${syntheticKeys.accessKey}; secretKey=${syntheticKeys.secretKey}`), beta: 1 }];
  const result = await f.run(f.download, [{ body }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ file: { id, output: f.output, format: "JSON", bytes: expect.any(Number) } });
  expect(JSON.parse(readFileSync(f.output, "utf8"))).toMatchObject([{ password: "***redacted***", nested: { token: "***redacted***", name: "***redacted***" }, beta: 1 }]);
  expect(readFileSync(f.output, "utf8")).not.toMatch(/hidden-password|hidden-token|synthetic-secret-sentinel|synthetic-access-sentinel/);
  expect(result.stdout).not.toContain("Synthetic");
  expect(readdirSync(f.home).some((name) => name.endsWith(".tmp"))).toBe(false);
});

test.each([false, true])("Navigator layer downloads preserve structure and redact secrets (gzip=%s)", async (compressed) => {
  const f = fixture("mitre-heatmap");
  const raw = Buffer.from(JSON.stringify({ name: "Synthetic heatmap", versions: { attack: "14", navigator: "4.9.5", layer: "4.5" },
    domain: "enterprise-attack", description: syntheticKeys.secretKey, password: "hidden-password",
    techniques: [{ techniqueID: "T1078", score: 10, comment: encodeURIComponent(syntheticKeys.accessKey), extra: { token: "hidden-token" } }] }));
  const result = await f.run(f.download, [{ bytes: compressed ? gzipSync(raw) : raw }]);
  expect(result.code).toBe(0);
  const contents = readFileSync(f.output);
  const text = (compressed ? gunzipSync(contents) : contents).toString("utf8");
  expect(JSON.parse(text)).toEqual({ name: "Synthetic heatmap", versions: { attack: "14", navigator: "4.9.5", layer: "4.5" },
    domain: "enterprise-attack", description: "***redacted***", password: "***redacted***",
    techniques: [{ techniqueID: "T1078", score: 10, comment: "***redacted***", extra: { token: "***redacted***" } }] });
  expect(result.data).toMatchObject({ file: { id, output: f.output, format: "JSON", bytes: contents.length } });
  expect(result.stdout).not.toContain("Synthetic heatmap");
  expect(text).not.toMatch(/hidden-password|hidden-token|synthetic-secret-sentinel|synthetic-access-sentinel/);
  expect(readdirSync(f.home).some((name) => name.endsWith(".tmp"))).toBe(false);
});

test("CSV downloads scan secret columns and quoted multiline cells without corrupting CSV", async () => {
  const f = fixture();
  const text = `path_name,password,note\r\n"Synthetic, path",hidden-password,"line 1\n${syntheticKeys.secretKey} and ""quoted"""\r\n`;
  const result = await f.run(f.download, [{ text }]);
  expect(result.code).toBe(0);
  expect(result.data).toMatchObject({ file: { format: "CSV" } });
  expect(readFileSync(f.output, "utf8")).toBe('"path_name","password","note"\n"Synthetic, path","***redacted***","line 1\n***redacted*** and ""quoted"""');
});

test.each(["[]", "path_name,priority\n"])("empty valid exports retain an explicit empty dataset: %s", async (text) => {
  const f = fixture();
  const result = await f.run(f.download, [{ text }]);
  expect(result.code).toBe(0);
  expect(existsSync(f.output)).toBe(true);
});

test.each(["", "[broken", 'path_name,note\n"unclosed', "a,b\n1", "<html>error</html>"])("malformed downloads never publish a file: %j", async (text) => {
  const f = fixture();
  const result = await f.run(f.download, [{ text }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "EXPORT_FILE_INVALID" } });
  expect(existsSync(f.output)).toBe(false);
  expect(readdirSync(f.home).some((name) => name.endsWith(".tmp"))).toBe(false);
});

test("not-ready download returns a status hint and leaves no file", async () => {
  const f = fixture();
  const result = await f.run(f.download, [{ status: 204 }]);
  expect(result.data).toMatchObject({ error: { code: "JOB_NOT_READY" } });
  expect(existsSync(f.output)).toBe(false);
});

test.each([false, true])("download refuses an existing destination including symlink=%s before HTTP", async (symlink) => {
  const f = fixture();
  if (symlink) symlinkSync(f.bodyFile, f.output); else writeFileSync(f.output, "existing");
  const result = await f.run(f.download);
  expect(result.code).toBe(2);
  expect(result.requests).toHaveLength(0);
  expect(readFileSync(f.output, "utf8")).toBe(symlink ? '{"file_format":"JSON"}' : "existing");
});

test("compressed JSON is redacted and re-encoded before publication", async () => {
  const f = fixture();
  const result = await f.run(f.download, [{ bytes: gzipSync(JSON.stringify([{ path_name: syntheticKeys.secretKey }])) }]);
  expect(result.code).toBe(0);
  expect(gunzipSync(readFileSync(f.output)).toString("utf8")).toBe('[{"path_name":"***redacted***"}]');
});

test("a destination created during the download is never overwritten", async () => {
  const f = fixture();
  const fake = await fakeHttpsTenable([{ text: "[]" }]);
  try {
    const result = await f.cli(f.download, {}, () => {
      writeFileSync(f.output, "concurrent file");
      return fake.transport(transportBindings);
    });
    expect(result.code).toBe(1);
    expect(readFileSync(f.output, "utf8")).toBe("concurrent file");
    expect(readdirSync(f.home).some((name) => name.endsWith(".tmp"))).toBe(false);
  } finally { await fake.close(); }
});

test("a file exceeding 128 MiB without content-length is stopped by the streaming byte budget", async () => {
  const f = fixture();
  const result = await f.run(f.download, [{ bytes: Buffer.alloc(128 * 1024 * 1024 + 1, 32) }]);
  expect(result.data).toMatchObject({ error: { code: "BYTE_BUDGET_EXCEEDED" } });
  expect(existsSync(f.output)).toBe(false);
});

test("an encoded file larger than 128 MiB is rejected before publication", async () => {
  const f = fixture();
  const result = await f.run(f.download, [{ text: "[]", headers: { "content-length": String(128 * 1024 * 1024 + 1) } }]);
  expect(result.data).toMatchObject({ error: { code: "BYTE_BUDGET_EXCEEDED" } });
  expect(existsSync(f.output)).toBe(false);
});

test("gzip expansion beyond 128 MiB is rejected without a partial file", async () => {
  const f = fixture();
  const result = await f.run(f.download, [{ bytes: gzipSync(Buffer.alloc(128 * 1024 * 1024 + 1, 32)) }]);
  expect(result.code).toBe(1);
  expect(result.data).toMatchObject({ error: { code: "EXPORT_FILE_INVALID" } });
  expect(existsSync(f.output)).toBe(false);
});
