import { gzipSync } from "node:zlib";
import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { createTransport, TENABLE_ORIGIN, TransportError, type OperationBinding } from "../src/transport.js";
import { constructTransport } from "../src/transport-core.js";
import { fakeHttpsTenable, fakeTransport, syntheticKeys } from "./support/fake-tenable.js";

const search: OperationBinding = {
  method: "POST", path: "/api/v1/t1/inventory/assets/search", effect: "read",
  query: ["offset", "limit", "filter"], paging: ["offset", "limit"],
  decoder: z.object({ data: z.array(z.object({ id: z.string(), name: z.string() })) }),
  permissionHelp: "Inventory requires EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ",
  validationHelp: "Check the asset filters with tenable-axi asset properties",
};
const detail: OperationBinding = { ...search, method: "GET", path: "/api/v1/t1/exposure-view/cards/{card_id}" };
const write: OperationBinding = { ...search, effect: "write", path: "/api/v1/t1/inventory/export/assets" };
const bindings = { search, detail, write };
const page = { data: [{ id: "synthetic-asset", name: "Example asset" }] };
afterEach(() => vi.useRealTimers());

test("HTTPS search POSTs decode the selected view and send keys only in the sink header", async () => {
  const fake = await fakeHttpsTenable([{ body: { ...page, beta: "extra" } }]);
  try {
    const result = await fake.transport(bindings).request("search", { body: { query: { text: "example" } }, query: { limit: 1 } });
    expect(result).toEqual({ status: 200, body: page });
    expect(fake.requests).toMatchObject([{ method: "POST", url: `${search.path}?limit=1`,
      headers: { "x-apikeys": `accessKey=${syntheticKeys.accessKey}; secretKey=${syntheticKeys.secretKey}` },
      body: '{"query":{"text":"example"}}' }]);
  } finally { await fake.close(); }
});

test("the fetch boundary refuses automatic redirects before credentials are attached", async () => {
  const fake = fakeTransport([{ body: page }], bindings);
  await fake.transport.request("search");
  expect(fake.requests[0]!.init.redirect).toBe("error");
});

test.each(["https://cloud.tenable.com/", "https://cloud.tenable.com:443", "https://cloud.tenable.com:8443",
  "https://user@cloud.tenable.com", "https://cloud.tenable.com?x=1", "https://cloud.tenable.com#x",
  "http://cloud.tenable.com", "https://other.invalid", "https://CLOUD.tenable.com"])(
  "rejects noncanonical origin %s before any network call", (origin) => {
    expect(() => createTransport({ keys: syntheticKeys, origin })).toThrowError(expect.objectContaining({ error: { code: "CONFIG_INVALID", message: expect.any(String), operation: "transport" } }));
  },
);

test.each(["", "key; injected=value", "key=value", "key\r\nother", "key\u0000", "key,other"])(
  "rejects unsafe key material without echoing it: %j", (secretKey) => {
    expect(() => createTransport({ keys: { ...syntheticKeys, secretKey } })).toThrow("API keys must be nonempty");
  },
);

test("inventory evidence cannot execute an unbound operation", async () => {
  await expect(createTransport({ keys: syntheticKeys }).request("inventory-assets-search"))
    .rejects.toMatchObject({ error: { code: "OPERATION_BLOCKED" } });
});

test.each(["..", ".", "../users", "%2e%2e", "a\\b", "a/b", "a\n"])(
  "refuses traversal identifier %j before sending keys", async (card_id) => {
    const fake = fakeTransport([], bindings);
    await expect(fake.transport.request("detail", { pathParams: { card_id } })).rejects.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(fake.requests).toHaveLength(0);
  },
);

test.each([
  ["statusCode", { statusCode: 400, error: "Bad Request", message: "invalid filter" }, "invalid filter"],
  ["message/status", { message: "invalid format", status: 400 }, "invalid format"],
  ["error/message", { error: "Invalid export", message: "invalid export scope" }, "invalid export scope"],
  ["connector validation", { detail: { loc: ["query", "end_date"], msg: "invalid end date", type: "date" } }, "invalid end date"],
  ["connector rejection", { detail: { display_message: "invalid date range", technical_message: "internal detail" } }, "invalid date range"],
  ["exposure view", { status: 404, message: "Not Found", error: [{ code: "MISSING", message: "card absent" }] }, "card absent"],
  ["exposure view errors", { status: 404, errors: [{ message: "view absent" }] }, "view absent"],
  ["platform error", { error: "invalid category" }, "invalid category"],
  ["connector string", { detail: "invalid connector" }, "invalid connector"],
])("translates the %s error contract without losing actionable context", async (_, body, message) => {
  const fake = fakeTransport([{ status: 400, body }], bindings);
  await expect(fake.transport.request("search")).rejects.toMatchObject({
    error: { code: "VALIDATION_ERROR", message: expect.stringContaining(message), operation: "search", status: 400 },
    help: [search.validationHelp],
  });
});

test.each([[401, "AUTH_REQUIRED"], [403, "PERMISSION_DENIED"], [404, "NOT_FOUND"], [409, "VALIDATION_ERROR"], [422, "VALIDATION_ERROR"], [500, "REQUEST_FAILED"]])(
  "maps HTTP %i independently of the upstream body status", async (status, code) => {
    const fake = fakeTransport([{ status, body: { status: 200, message: "upstream rejected request" } }], bindings);
    await expect(fake.transport.request("search")).rejects.toMatchObject({ error: { code, status, operation: "search" } });
  },
);

test("permission denial gives advice for the bound operation", async () => {
  const fake = fakeTransport([{ status: 403, body: {} }], bindings);
  await expect(fake.transport.request("search")).rejects.toMatchObject({ help: [search.permissionHelp] });
});

test.each(["", "{broken", "<html>private server trace</html>", '{"unexpected":"private server trace"}'])(
  "discards schema-less or non-JSON error text %j", async (text) => {
    const fake = fakeTransport([{ status: 500, text }], bindings);
    await expect(fake.transport.request("search")).rejects.toMatchObject({ error: { message: "Tenable returned HTTP 500" } });
  },
);

test.each(["", "not JSON", '{"data":null}', '{"data":[{"id":"asset"}]}'])(
  "reports malformed successful data instead of plausible empty data: %j", async (text) => {
    const fake = fakeTransport([{ text }], bindings);
    await expect(fake.transport.request("search")).rejects.toMatchObject({ error: { code: "RESPONSE_INVALID", status: 200 } });
  },
);

test.each([301, 302, 303, 307, 308])("HTTPS redirect %i never forwards keys to its destination", async (status) => {
  const fake = await fakeHttpsTenable([{ status, headers: { location: "https://collector.invalid/keys" }, text: "" }]);
  try {
    await expect(fake.transport(bindings).request("search")).rejects.toMatchObject({ error: { code: "DESTINATION_DENIED", status } });
    expect(fake.requests).toHaveLength(1);
  } finally { await fake.close(); }
});

test.each(["https://collector.invalid/next", "http://cloud.tenable.com/next", "//collector.invalid/next",
  `${TENABLE_ORIGIN}:443${search.path}?offset=1`, `https://user@cloud.tenable.com${search.path}?offset=1`,
  `/api/v1/t1/inventory/assets/../assets/search?offset=1`, `${search.path}?offset=1#fragment`,
  `${search.path}?filter=other&offset=1`, `${search.path}?offset=1&offset=2`,
  "/users", "/api/v1/t1/inventory/%2e%2e/users", `${search.path}?unknown=1`])(
  "refuses foreign or scope-changing continuation %s before a send", async (continuation) => {
    const fake = fakeTransport([], bindings);
    await expect(fake.transport.request("search", { continuation, query: { filter: "selected" } }))
      .rejects.toMatchObject({ error: { code: "DESTINATION_DENIED" } });
    expect(fake.requests).toHaveLength(0);
  },
);

test("continuations retain filters and reject a repeated page before resending", async () => {
  const fake = fakeTransport([{ body: page }, { body: { data: [] } }], bindings);
  const query = { filter: "selected" };
  await fake.transport.request("search", { query });
  const continuation = `${search.path}?filter=selected&offset=1`;
  expect(await fake.transport.request("search", { query, continuation })).toMatchObject({ body: { data: [] } });
  await expect(fake.transport.request("search", { query, continuation: `${search.path}?offset=1&filter=selected` }))
    .rejects.toMatchObject({ error: { code: "CONTINUATION_REPEATED" } });
  expect(fake.requests).toHaveLength(2);
});

test("HTML 429 exhausts two bounded retries and preserves the last delay", async () => {
  vi.useFakeTimers();
  const fake = fakeTransport(Array.from({ length: 3 }, () => ({ status: 429, text: "<html>server trace</html>", headers: { "retry-after": "1" } })), bindings);
  const result = expect(fake.transport.request("search")).rejects.toMatchObject({
    error: { code: "RATE_LIMITED", status: 429, retryAfter: 1000, message: "Tenable returned HTTP 429" },
  });
  await vi.advanceTimersByTimeAsync(2000);
  await result;
  expect(fake.requests).toHaveLength(3);
});

test.each([502, 503, 504])("retries reviewed transient HTTP %i for search POSTs", async (status) => {
  vi.useFakeTimers();
  const fake = fakeTransport([{ status, body: {} }, { body: page }], bindings);
  const result = fake.transport.request("search");
  await vi.advanceTimersByTimeAsync(250);
  expect(await result).toMatchObject({ body: page });
  expect(fake.requests).toHaveLength(2);
});

test.each(["bad", "-1", "1.5", "2026-10-22", "Infinity", "99999999999999999999"])(
  "uses bounded backoff for malformed retry-after %s", async (retryAfter) => {
    vi.useFakeTimers();
    const fake = fakeTransport([{ status: 429, headers: { "retry-after": retryAfter } }, { status: 429 }, { body: page }], bindings);
    const result = fake.transport.request("search");
    await vi.advanceTimersByTimeAsync(249);
    expect(fake.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(499);
    expect(fake.requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ body: page });
  },
);

test.each(["Thu, 22 Oct 2026 00:00:02 GMT", "Thursday, 22-Oct-26 00:00:02 GMT", "Thu Oct 22 00:00:02 2026"])(
  "honors retry-after HTTP date %s before fallback backoff", async (retryAfter) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T00:00:00Z"));
  const fake = fakeTransport([{ status: 429, headers: { "retry-after": retryAfter } }, { body: page }], bindings);
  const result = fake.transport.request("search");
  await vi.advanceTimersByTimeAsync(1999);
  expect(fake.requests).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toMatchObject({ body: page });
});

test("a rate limit beyond the remaining deadline returns immediately without a retry", async () => {
  vi.useFakeTimers();
  const fake = fakeTransport([{ status: 429, headers: { "retry-after": "21" } }], bindings);
  await expect(fake.transport.request("search")).rejects.toMatchObject({ error: { code: "RATE_LIMITED", retryAfter: 21000 } });
  expect(fake.requests).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

test("pages and retries consume the same twenty-request budget", async () => {
  vi.useFakeTimers();
  const fake = fakeTransport([...Array.from({ length: 19 }, () => ({ body: page })), { status: 503 }, { body: page }], bindings);
  for (let offset = 0; offset < 19; offset++) await fake.transport.request("search", { query: { offset } });
  await expect(fake.transport.request("search", { query: { offset: 19 } })).rejects.toMatchObject({ error: { code: "REQUEST_FAILED", status: 503 } });
  await expect(fake.transport.request("search", { query: { offset: 20 } })).rejects.toMatchObject({ error: { code: "REQUEST_BUDGET_EXCEEDED" } });
  expect(fake.requests).toHaveLength(20);
});

test("a retry is cancellable with only the invocation deadline remaining", async () => {
  vi.useFakeTimers();
  const fake = fakeTransport([{ status: 503, headers: { "retry-after": "19" } }, "hang"], bindings);
  const result = expect(fake.transport.request("search")).rejects.toMatchObject({ error: { code: "DEADLINE_EXCEEDED" } });
  await vi.advanceTimersByTimeAsync(20_000);
  await result;
  expect(fake.requests).toHaveLength(2);
  expect(fake.requests[1]!.init.signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

test("cancelling retry backoff prevents another request", async () => {
  vi.useFakeTimers();
  const signal = new AbortController();
  const fake = fakeTransport([{ status: 503 }], bindings);
  const result = expect(fake.transport.request("search", { signal: signal.signal })).rejects.toMatchObject({ error: { code: "REQUEST_CANCELLED" } });
  await vi.advanceTimersByTimeAsync(100);
  signal.abort();
  await result;
  expect(fake.requests).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

test.each([429, 502, 503, 504])("authorized writes returning HTTP %i are never replayed", async (status) => {
  const fake = fakeTransport([{ status, headers: { "retry-after": "1" } }], bindings, { allowWrites: true });
  await expect(fake.transport.request("write")).rejects.toMatchObject({ error: { code: status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED", status } });
  expect(fake.requests).toHaveLength(1);
});

test("writes without coordinator authorization fail before the sink", async () => {
  const fake = fakeTransport([], bindings);
  await expect(fake.transport.request("write")).rejects.toMatchObject({ error: { code: "OPERATION_BLOCKED" } });
  expect(fake.requests).toHaveLength(0);
});

test("an interrupted write reports an unknown outcome without dependency or secret text", async () => {
  const fake = fakeTransport(["disconnect"], bindings, { allowWrites: true });
  await expect(fake.transport.request("write")).rejects.toMatchObject({ error: { code: "OUTCOME_UNKNOWN", message: "Mutation outcome is unknown; read back before retrying" } });
  expect(fake.requests).toHaveLength(1);
});

test("response bytes accumulate across pages", async () => {
  const large = JSON.stringify({ data: [], padding: "x".repeat(11 * 1024 * 1024) });
  const fake = fakeTransport([{ text: large }, { text: large }], bindings);
  await fake.transport.request("search");
  await expect(fake.transport.request("search", { query: { offset: 1 } })).rejects.toMatchObject({ error: { code: "BYTE_BUDGET_EXCEEDED" } });
});

test("failed response bodies consume the same byte budget as retries", async () => {
  vi.useFakeTimers();
  const large = JSON.stringify({ padding: "x".repeat(11 * 1024 * 1024) });
  const fake = fakeTransport([{ status: 503, text: large }, { text: large }], bindings);
  const result = expect(fake.transport.request("search")).rejects.toMatchObject({ error: { code: "BYTE_BUDGET_EXCEEDED" } });
  await vi.advanceTimersByTimeAsync(250);
  await result;
  expect(fake.requests).toHaveLength(2);
});

test("compressed HTTPS responses obey the decoded byte ceiling", async () => {
  const bytes = gzipSync(JSON.stringify({ data: [], padding: "x".repeat(20 * 1024 * 1024) }));
  const fake = await fakeHttpsTenable([{ bytes, headers: { "content-encoding": "gzip" } }]);
  try {
    await expect(fake.transport(bindings).request("search")).rejects.toMatchObject({ error: { code: "BYTE_BUDGET_EXCEEDED" } });
  } finally { await fake.close(); }
});

test("upstream error text is bounded and redacts exact, escaped, encoded and named secrets", async () => {
  const keys = { accessKey: 'synthetic-"access', secretKey: "synthetic/secret" };
  const header = `accessKey=${keys.accessKey}; secretKey=${keys.secretKey}`;
  const message = [keys.accessKey, keys.secretKey, header, JSON.stringify(header).slice(1, -1), encodeURIComponent(header),
    'token=synthetic-other', '{"secretKey":"synthetic-named-secret"}', "x".repeat(2000)].join(" ");
  const fake = fakeTransport([{ status: 400, body: { message } }], bindings, { keys });
  const error = await fake.transport.request("search").catch((error: unknown) => error) as TransportError;
  const output = JSON.stringify(error);
  for (const sentinel of [keys.accessKey, keys.secretKey, header, encodeURIComponent(header), "synthetic-other", "synthetic-named-secret"]) expect(output).not.toContain(sentinel);
  expect(error.error.message.length).toBeLessThanOrEqual(1000);
});

test("binding changes after construction cannot retarget an authenticated request", async () => {
  const mutable = { ...detail };
  const fake = fakeTransport([{ body: page }], { detail: mutable });
  mutable.path = "/users/{card_id}";
  await fake.transport.request("detail", { pathParams: { card_id: "example#id" } });
  expect(fake.requests[0]!.url).toBe(`${TENABLE_ORIGIN}/api/v1/t1/exposure-view/cards/example%23id`);
});

test("transport failures discard raw dependency errors without retry", async () => {
  const fake = fakeTransport(["disconnect"], bindings);
  await expect(fake.transport.request("search")).rejects.toMatchObject({ error: { code: "TRANSPORT_FAILED", message: "Tenable request could not complete" } });
  expect(fake.requests).toHaveLength(1);
});

test("body streaming is covered by the request deadline", async () => {
  vi.useFakeTimers();
  const transport = constructTransport({ keys: syntheticKeys }, { bindings,
    fetch: async (_, init) => new Response(new ReadableStream({ start(controller) {
      init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")), { once: true });
    } })),
  });
  const result = expect(transport.request("search")).rejects.toMatchObject({ error: { code: "DEADLINE_EXCEEDED" } });
  await vi.advanceTimersByTimeAsync(20_000);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});
