import { createServer, request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import { gunzipSync } from "node:zlib";
import { constructTransport, type ApiKeys, type OperationBinding } from "../../src/transport-core.js";
import { allowFakeServer } from "./deny-network.mjs";
import { cert, key } from "./test-tls.js";

export const syntheticKeys: ApiKeys = { accessKey: "synthetic-access-sentinel", secretKey: "synthetic-secret-sentinel" };
export type Reply = { status?: number; body?: unknown; text?: string; headers?: Record<string, string>; bytes?: Buffer };
export type RecordedRequest = { method: string; url: string; headers: Record<string, string | string[] | undefined>; body: string };

// Fast domain fixture: scripted upstream responses, with abort-aware hanging sends.
export function fakeTransport(replies: (Reply | "disconnect" | "hang")[], bindings: Record<string, OperationBinding>,
  options: { keys?: ApiKeys; allowWrites?: boolean } = {}) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    const reply = replies.shift();
    if (!reply) throw new Error("Unexpected fake request");
    if (reply === "disconnect") throw new Error(`Dependency error containing ${syntheticKeys.secretKey}`);
    if (reply === "hang") return new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
    return new Response(reply.bytes ?? reply.text ?? JSON.stringify(reply.body), { status: reply.status ?? 200, headers: reply.headers });
  };
  return { requests, transport: constructTransport({ keys: options.keys ?? syntheticKeys }, {
    bindings, fetch, ...(options.allowWrites ? { consumeWriteAuthorization: () => true } : {}),
  }) };
}

export async function fakeHttpsTenable(replies: Reply[]) {
  const requests: RecordedRequest[] = [];
  const server = createServer({ key, cert }, async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push({ method: request.method!, url: request.url!, headers: request.headers, body: Buffer.concat(chunks).toString("utf8") });
    const reply = replies.shift() ?? { status: 500, body: { error: "Unexpected fake request" } };
    response.writeHead(reply.status ?? 200, { "content-type": "application/json", ...reply.headers });
    response.end(reply.bytes ?? reply.text ?? JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const release = allowFakeServer(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fake server is not listening");
  // The seam translates logical URLs only after production destination checks.
  // TLS remains verified with a fixture CA, and no redirects are followed.
  const fetch: typeof globalThis.fetch = (input, init = {}) => new Promise((resolve, reject) => {
    const url = new URL(String(input));
    const pending = httpsRequest({ hostname: "127.0.0.1", port: address.port, ca: cert, rejectUnauthorized: true,
      path: url.pathname + url.search, method: init.method, headers: init.headers as Record<string, string>,
      signal: init.signal ?? undefined, agent: false }, (response) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      if (response.headers["content-encoding"] === "gzip") {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => resolve(new Response(gunzipSync(Buffer.concat(chunks)), { status: response.statusCode!, headers })));
        response.on("error", reject);
      } else {
        resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, { status: response.statusCode!, headers }));
      }
    });
    pending.on("error", reject);
    pending.end(init.body);
  });
  return { requests,
    transport: (bindings: Record<string, OperationBinding>) => constructTransport({ keys: syntheticKeys }, { bindings, fetch }),
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      release();
    },
  };
}
