import type { z } from "zod";

export const TENABLE_ORIGIN = "https://cloud.tenable.com";
export type ApiKeys = Readonly<{ accessKey: string; secretKey: string }>;
export type OperationBinding = Readonly<{
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  effect: "read" | "write";
  query: readonly string[];
  paging?: readonly string[];
  decoder: z.ZodType;
  permissionHelp: string;
  validationHelp: string;
}>;
export type RequestOptions = {
  pathParams?: Readonly<Record<string, string>>;
  query?: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  body?: unknown;
  continuation?: string;
  signal?: AbortSignal;
  authorization?: unknown;
  retry?: false;
};
export type Transport = {
  prepare(operation: string, options?: RequestOptions): PreparedRequest;
  request(operation: string, options?: RequestOptions): Promise<{ status: number; body: unknown }>;
};
export type PreparedRequest = Readonly<{ operation: string; method: string; url: string; body?: string; effect: "read" | "write" }>;
export type TransportOptions = { keys: ApiKeys; origin?: string };

export class TransportError extends Error {
  constructor(readonly error: {
    code: string; message: string; operation: string; status?: number; retryAfter?: number; auditId?: string;
  }, readonly help: readonly string[] = []) {
    super(error.message);
    this.name = "TransportError";
  }
  toJSON() { return { error: this.error, ...(this.help.length ? { help: this.help } : {}) }; }
}

// Internal construction seam. Production supplies only catalogue bindings and the
// native fetch; test support supplies synthetic bindings and a loopback adapter.
export function constructTransport(options: TransportOptions, dependencies: {
  bindings: Readonly<Record<string, OperationBinding>>;
  fetch: typeof globalThis.fetch;
  now?: () => number;
  consumeWriteAuthorization?: (authorization: unknown, request: {
    operation: string; method: string; url: string; body?: string;
  }) => boolean;
}): Transport {
  const fail = (code: string, message: string, operation = "transport", help: readonly string[] = [],
    details: { status?: number; retryAfter?: number } = {}): never => {
    throw new TransportError({ code, message, operation, ...details }, help);
  };
  if ((options.origin ?? TENABLE_ORIGIN) !== TENABLE_ORIGIN) {
    fail("CONFIG_INVALID", "Origin must be exactly https://cloud.tenable.com");
  }
  const { accessKey, secretKey } = options.keys;
  if ([accessKey, secretKey].some((key) => !key || /[\s\x00-\x1f\x7f;=,]/u.test(key))) {
    fail("CONFIG_INVALID", "API keys must be nonempty and contain no header delimiters or control characters");
  }
  const header = `accessKey=${accessKey}; secretKey=${secretKey}`;
  const secrets = [accessKey, secretKey, header].flatMap((value) =>
    [value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)]).sort((a, b) => b.length - a.length);
  const redact = (text: string): string => {
    for (const secret of secrets) text = text.split(secret).join("[REDACTED]");
    return text.replace(/(?:accessKey|secretKey|api[_-]?key|authorization|password|token)["']?\s*[=:]\s*["']?[^\s,;}"']+/gi,
      "[REDACTED]").replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 1000);
  };
  // Snapshot caller-owned bindings and keys before the first asynchronous send.
  const bindings = Object.fromEntries(Object.entries(dependencies.bindings).map(([id, binding]) =>
    [id, { ...binding, query: [...binding.query], paging: [...(binding.paging ?? [])] }]));
  const now = dependencies.now ?? Date.now;
  const deadline = now() + 20_000;
  let requests = 0;
  let bytes = 0;
  const seen = new Set<string>();

  function destination(operation: string, binding: OperationBinding, input: RequestOptions): URL {
    const params = input.pathParams ?? {};
    const names = [...binding.path.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]!);
    if (Object.keys(params).some((name) => !names.includes(name))) {
      fail("VALIDATION_ERROR", "Unexpected path parameter", operation);
    }
    const path = binding.path.replace(/\{([A-Za-z0-9_]+)\}/g, (_, name: string) => {
      const value = params[name];
      if (!value || /[\s\x00-\x1f\x7f/\\%]/u.test(value) || value === "." || value === "..") {
        fail("VALIDATION_ERROR", "Invalid or missing path parameter", operation);
      }
      return encodeURIComponent(value!);
    });
    if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path)
      || path.split("/").some((part) => part === "." || part === "..")) {
      fail("DESTINATION_DENIED", "Operation has an invalid route binding", operation);
    }
    const initial = new URL(path, TENABLE_ORIGIN);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (!binding.query.includes(key)) fail("VALIDATION_ERROR", "Unsupported query parameter", operation);
      for (const item of Array.isArray(value) ? value : [value]) initial.searchParams.append(key, String(item));
    }
    if (input.continuation === undefined) return initial;
    const next = input.continuation;
    let url: URL;
    try { url = new URL(next, initial); }
    catch { return fail("DESTINATION_DENIED", "Invalid continuation destination", operation); }
    // Reject normalization tricks before URL parsing can hide traversal or ports.
    if (/[\\\x00-\x20\x7f#]/.test(next) || /%2e|%2f|%5c/i.test(next)
      || next.split(/[/?]/).some((part) => part === "." || part === "..")
      || (next.startsWith("https://") && !next.startsWith(`${TENABLE_ORIGIN}/`))
      || url.origin !== TENABLE_ORIGIN || url.username || url.password || url.hash || url.pathname !== path
      || [...url.searchParams.keys()].some((key) => !binding.query.includes(key)
        || url.searchParams.getAll(key).length !== 1)) {
      fail("DESTINATION_DENIED", "Continuation must retain the bound Tenable route", operation);
    }
    for (const key of new Set([...initial.searchParams.keys(), ...url.searchParams.keys()])) {
      if (!binding.paging?.includes(key) && initial.searchParams.get(key) !== url.searchParams.get(key)) {
        fail("DESTINATION_DENIED", "Continuation changed the request scope", operation);
      }
    }
    return url;
  }

  function prepare(operation: string, input: RequestOptions = {}): PreparedRequest {
    const binding = Object.hasOwn(bindings, operation) ? bindings[operation] : undefined;
    if (!binding) fail("OPERATION_BLOCKED", "Operation has no executable catalogue binding");
    const url = destination(operation, binding!, input).href;
    const body = input.body === undefined ? undefined : JSON.stringify(input.body);
    return Object.freeze({ operation, method: binding!.method, url, body, effect: binding!.effect });
  }

  async function request(operation: string, input: RequestOptions = {}): Promise<{ status: number; body: unknown }> {
    const { url, body } = prepare(operation, input);
    const record = bindings[operation]!;
    const canonical = new URL(url);
    canonical.searchParams.sort();
    const identity = JSON.stringify([operation, canonical.href, body]);
    if (input.continuation !== undefined && seen.has(identity)) {
      fail("CONTINUATION_REPEATED", "The server repeated a continuation", operation);
    }
    if (record.effect === "write" && !dependencies.consumeWriteAuthorization?.(input.authorization,
      { operation, method: record.method, url, body })) {
      fail("OPERATION_BLOCKED", "Writes require coordinator authorization", operation);
    }
    seen.add(identity);
    let lastRetryAfter: number | undefined;
    for (let attempt = 0; ; attempt++) {
      if (input.signal?.aborted) fail("REQUEST_CANCELLED", "Request was cancelled", operation);
      const remaining = deadline - now();
      if (remaining <= 0) fail("DEADLINE_EXCEEDED", "Invocation deadline exceeded", operation);
      if (requests >= 20) fail("REQUEST_BUDGET_EXCEEDED", "Invocation request budget exceeded", operation);
      requests++;
      const controller = new AbortController();
      const abort = () => controller.abort();
      input.signal?.addEventListener("abort", abort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, remaining);
      let response: Response;
      let text: string;
      try {
        response = await dependencies.fetch(url, {
          method: record.method, redirect: "error", signal: controller.signal,
          headers: { "X-ApiKeys": header, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
          ...(body === undefined ? {} : { body }),
        });
        if (response.status >= 300 && response.status < 400) {
          await response.body?.cancel();
          fail("DESTINATION_DENIED", "Tenable redirects are refused", operation, [], { status: response.status });
        }
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        try {
          while (reader) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > 20 * 1024 * 1024) {
              controller.abort();
              fail("BYTE_BUDGET_EXCEEDED", "Invocation decoded response byte budget exceeded", operation);
            }
            chunks.push(chunk.value);
          }
        } finally { await reader?.cancel().catch(() => {}); }
        text = Buffer.concat(chunks).toString("utf8");
      } catch (error) {
        if (error instanceof TransportError) throw error;
        const code = record.effect === "write" ? "OUTCOME_UNKNOWN"
          : input.signal?.aborted ? "REQUEST_CANCELLED" : timedOut ? "DEADLINE_EXCEEDED" : "TRANSPORT_FAILED";
        fail(code, record.effect === "write" ? "Mutation outcome is unknown; read back before retrying"
          : "Tenable request could not complete", operation, ["Check connectivity and retry the read when ready"]);
      } finally {
        clearTimeout(timer);
        input.signal?.removeEventListener("abort", abort);
      }
      if (input.signal?.aborted) fail(record.effect === "write" ? "OUTCOME_UNKNOWN" : "REQUEST_CANCELLED",
        "Request was cancelled", operation);
      if (now() >= deadline) fail(record.effect === "write" ? "OUTCOME_UNKNOWN" : "DEADLINE_EXCEEDED",
        "Invocation deadline exceeded", operation);
      if (response!.status >= 200 && response!.status < 300) {
        let decoded: unknown;
        try { decoded = text! ? JSON.parse(text!) : undefined; }
        catch { fail("RESPONSE_INVALID", "Tenable response is not valid JSON", operation, [], { status: response!.status }); }
        const result = record.decoder.safeParse(decoded);
        if (!result.success) fail("RESPONSE_INVALID", "Tenable response does not match the selected view", operation,
          ["Check the operation response contract; no result was inferred"], { status: response!.status });
        return { status: response!.status, body: result.data };
      }
      const status = response!.status;
      const delay = retryAfter(response!.headers.get("retry-after"), now());
      if (delay !== undefined) lastRetryAfter = delay;
      const retryable = input.retry !== false && record.effect === "read" && [429, 502, 503, 504].includes(status);
      const wait = delay ?? (attempt === 0 ? 250 : 500);
      if (retryable && attempt < 2 && requests < 20 && wait < deadline - now()) {
        await new Promise<void>((resolve, reject) => {
          const cancel = () => {
            clearTimeout(pause);
            reject(new TransportError({ code: "REQUEST_CANCELLED", message: "Request was cancelled", operation }));
          };
          const pause = setTimeout(() => { input.signal?.removeEventListener("abort", cancel); resolve(); }, wait);
          input.signal?.addEventListener("abort", cancel, { once: true });
          if (input.signal?.aborted) cancel();
        });
        continue;
      }
      const code = status === 401 ? "AUTH_REQUIRED" : status === 403 ? "PERMISSION_DENIED"
        : status === 404 ? "NOT_FOUND" : status === 429 ? "RATE_LIMITED"
          : [400, 409, 422].includes(status) ? "VALIDATION_ERROR" : "REQUEST_FAILED";
      const hint = status === 401 ? "Check both SecretRefs and run tenable-axi auth status"
        : status === 403 ? record.permissionHelp : status === 404 ? "Check the resource identifier and operation scope"
          : status === 429 ? "Retry after the reported delay; narrow reads to reduce requests" : record.validationHelp;
      const message = errorMessage(text!) ?? `Tenable returned HTTP ${status}`;
      fail(code, redact(message), operation, [hint], { status,
        ...(lastRetryAfter === undefined ? {} : { retryAfter: lastRetryAfter }) });
    }
  }
  return { prepare, request };
}

function retryAfter(value: string | null, now: number): number | undefined {
  if (value === null) return undefined;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isSafeInteger(seconds * 1000) ? seconds * 1000 : undefined;
  }
  // The obsolete asctime HTTP-date has no zone but is defined in GMT.
  const asctimeForm = /^[A-Za-z]{3} [A-Za-z]{3} (?: [1-9]|[12]\d|3[01]) \d{2}:\d{2}:\d{2} \d{4}$/.test(text);
  const date = Date.parse(asctimeForm ? `${text} GMT` : text);
  if (Number.isNaN(date)) return undefined;
  const parsed = new Date(date);
  const standard = parsed.toUTCString();
  const [weekday, day, month, year, time] = standard.split(" ");
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const obsolete = `${weekdays[parsed.getUTCDay()]}, ${day}-${month}-${year!.slice(-2)} ${time} GMT`;
  const asctime = `${weekday!.slice(0, 3)} ${month} ${String(Number(day)).padStart(2, " ")} ${time} ${year}`;
  if (![standard, obsolete, asctime].includes(text)) return undefined;
  return Math.max(0, date - now);
}

function errorMessage(text: string): string | undefined {
  let body: unknown;
  try { body = JSON.parse(text); } catch { return undefined; }
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const detail = record.detail && typeof record.detail === "object" ? record.detail as Record<string, unknown> : {};
  const nested = [record.error, record.errors].flatMap((value) => Array.isArray(value) ? value : [])
    .flatMap((value: unknown) => value && typeof value === "object" && "message" in value ? [value.message] : []);
  const messages = [record.message, detail.display_message, detail.msg, ...nested, record.error, record.detail]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0 && !/[<>]/.test(value));
  return messages.length ? messages.join("; ") : undefined;
}
