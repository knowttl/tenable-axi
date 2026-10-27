import { AxiError } from "axi-sdk-js";
import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";
import { z } from "zod";
import { attackCatalogue, attackFields, attackFilterSchema, attackPage, logFields, logPage, techniqueFields } from "./attack-catalogue.js";
import { credentialStore } from "./profiles.js";
import { createTransport, TransportError, type Transport, type TransportOptions } from "./transport.js";

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const cursorSchema = z.strictObject({ version: z.literal(1), scope: z.string(), offset: integer,
  pending: z.array(z.record(z.string(), z.unknown())), exhausted: z.boolean(), total: integer.nullable(),
  lastPage: z.string().nullable(), upstreamLimited: z.boolean() });
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const maxCursor = 28 * 1024 * 1024;

function readFilter(path: string): unknown {
  const fd = path === "-" ? 0 : openSync(path, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024 + 1);
    let size = 0;
    for (;;) {
      const read = readSync(fd, buffer, size, buffer.length - size, null);
      if (!read) break;
      size += read;
      if (size === buffer.length) throw new Error("Input too large");
    }
    return JSON.parse(buffer.subarray(0, size).toString("utf8"));
  } finally { if (path !== "-") closeSync(fd); }
}

export async function attackCommand(argv: string[], store: ReturnType<typeof credentialStore>,
  transportFactory: (options: TransportOptions) => Transport = createTransport): Promise<Record<string, unknown>> {
  const name = argv.slice(0, 2).join(" ");
  const entry = attackCatalogue[name];
  const usage = (message: string): never => { throw new AxiError(message, "VALIDATION_ERROR", [entry
    ? `Valid flags for ${name}: ${Object.keys(entry.flags).map((flag) => `--${flag}`).join(", ")}`
    : "Valid commands: attack-path list, attack-technique list, connector logs"]); };
  if (!entry) usage("Unknown attack or connector command");
  const logs = name === "connector logs";
  const technique = name === "attack-technique list";
  const flags = new Map<string, string[]>();
  const booleans = ["--help", "--full", "--all", "--include-resolved"];
  for (let index = 2; index < argv.length; index++) {
    const flag = argv[index]!;
    if (!flag.startsWith("--") || !Object.hasOwn(entry!.flags, flag.slice(2)) || (flags.has(flag) && flag !== "--filter")) usage(`Unknown argument, flag, or duplicate flag: ${flag}`);
    const value = booleans.includes(flag) ? "true" : argv[++index];
    if (value === undefined || !value.length || value.startsWith("--")) usage(`Missing value for ${flag}`);
    flags.set(flag, [...(flags.get(flag) ?? []), value!]);
  }
  const get = (flag: string) => flags.get(`--${flag}`)?.[0];
  if (get("help")) return { command: name, description: entry!.description, flags: entry!.flags,
    defaultFields: entry!.defaultFields, examples: entry!.examples };
  if (get("all") && get("limit")) usage("--all and --limit are mutually exclusive");
  if (get("cursor") && get("offset")) usage("--cursor and --offset are mutually exclusive");
  if (get("filter") && get("filter-file")) usage("--filter and --filter-file are mutually exclusive");
  const number = (flag: string, fallback: number, min: number, max: number) => {
    const raw = get(flag);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) usage(`--${flag} must be an integer from ${min} to ${max}`);
    return value;
  };
  const rowLimit = get("all") ? 10000 : number("limit", 100, 1, 10000);
  let offset = number("offset", 0, 0, Number.MAX_SAFE_INTEGER);
  const fields = get("fields")?.split(",") ?? entry!.defaultFields;
  if (fields.some((field) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(field)) || new Set(fields).size !== fields.length) usage("Fields must be unique comma-separated names");
  const schemas = logs ? logFields : technique ? techniqueFields : attackFields;
  const aliases: Record<string, string> = logs ? { connectorId: "connector_id", timestamp: "sync_timestamp", syncUuid: "sync_uuid",
    triggerReason: "trigger_reason", failedStage: "sync_stages_info", error: "sync_logs" }
    : technique ? { id: "serial_id", affectedAssets: "assets_ids" } : { id: "vector_id" };
  const wire = (field: string) => aliases[field] ?? field;
  if (fields.some((field) => !Object.hasOwn(schemas, wire(field)))) usage(`Available fields: ${[...Object.keys(aliases), ...Object.keys(schemas)].join(", ")}`);
  const query: Record<string, string | number | boolean> = {};
  if (!logs) {
    query.exclude_resolved = !get("include-resolved");
    if (!technique) {
      const ai = get("run-ai-summarization") ?? "false";
      if (!["true", "false"].includes(ai)) usage("--run-ai-summarization must be true or false");
      query.run_ai_summarization = ai;
    }
    if (get("sort")) {
      const pattern = technique ? /^[a-zA-Z_]+:(asc|ASC|ascending|ASCENDING|Ascending|desc|DESC|descending|DESCENDING|Descending)$/ : /^[a-zA-Z_]+:(asc|desc)$/;
      if (!pattern.test(get("sort")!)) usage("--sort must use the documented property:direction format");
      query.sort = get("sort")!;
    }
  } else {
    if (get("connector-id")) query.connector_id = number("connector-id", 0, 0, Number.MAX_SAFE_INTEGER);
    if (get("status")) {
      if (!["SUCCEEDED", "FAILED"].includes(get("status")!)) usage("--status must be SUCCEEDED or FAILED");
      query.status = get("status")!;
    }
    if (Boolean(get("start-date")) !== Boolean(get("end-date"))) usage("--start-date and --end-date must be used together");
    for (const flag of ["start-date", "end-date"]) if (get(flag)) {
      const value = get(flag)!;
      if (!z.iso.date().safeParse(value).success) usage(`--${flag} must be a valid YYYY-MM-DD date`);
      query[flag.replaceAll("-", "_")] = value;
    }
    if (get("start-date") && get("start-date")! >= get("end-date")!) usage("--start-date must precede the exclusive --end-date");
  }
  let body: unknown;
  if (get("filter-file")) {
    try { body = readFilter(get("filter-file")!); } catch { usage("Cannot read --filter-file as JSON within the 1 MiB input limit"); }
  } else if (get("filter")) {
    const filters = flags.get("--filter")!.map((text) => {
      const match = /^(\S+)\s+(\S+)\s+(.+)$/s.exec(text);
      if (!match) usage("Use --filter '<property> <operator> <JSON-value>'");
      try { return { property: match![1], operator: match![2], value: JSON.parse(match![3]!) as unknown }; }
      catch { return usage("Filter values must be JSON strings, integers, booleans or homogeneous arrays"); }
    });
    body = filters.length === 1 ? filters[0] : { operator: technique ? "and" : "AND", value: filters };
  }
  if (body !== undefined) {
    const parsed = attackFilterSchema(technique).safeParse(body);
    if (!parsed.success) usage(`Invalid documented filter: check properties/operators, homogeneous values and at most two logical levels; logical operators use ${technique ? "and|or" : "AND|OR"}`);
    body = parsed.data;
  }
  let saved: z.infer<typeof cursorSchema> | undefined;
  if (get("cursor")) {
    try {
      const raw = get("cursor")!;
      if (raw.length > maxCursor || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
      saved = cursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    } catch { usage("Invalid resume cursor; retain the cursor exactly as returned"); }
  }
  store.readOnly();
  const loaded = store.load(get("config"));
  const profile = store.select(loaded.config, get("profile"));
  const operation = entry!.operationId;
  const scope = hash([profile.origin, profile.name, profile.accessKey, profile.secretKey, loaded.path, operation, body, query, fields]);
  if (saved && saved.scope !== scope) usage("Cursor belongs to a different profile, operation, filters, sort, or fields");
  const transport = transportFactory({ origin: profile.origin, keys: store.credentials(profile) });
  offset = saved?.offset ?? offset;
  let pending = saved?.pending ?? [];
  let pendingIndex = 0;
  let exhausted = saved?.exhausted ?? false;
  let total = saved?.total ?? null;
  let lastPage = saved?.lastPage ?? null;
  let upstreamLimited = saved?.upstreamLimited ?? false;
  const rows: Record<string, unknown>[] = [];
  let reason: string | undefined;
  let failure: TransportError | undefined;
  let truncated = false;
  const invalid = (message: string): never => { throw new TransportError({ code: "RESPONSE_INVALID", message, operation }); };
  const preview = (value: unknown): unknown => {
    if (typeof value === "string" && value.length > 1000 && !get("full")) {
      truncated = true;
      return `${value.slice(0, 1000)}... (truncated, ${value.length} chars total)`;
    }
    if (Array.isArray(value)) return value.map(preview);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, preview(child)]));
    return value;
  };
  const project = (row: Record<string, unknown>) => Object.fromEntries(fields.map((field) => {
    let value = row[wire(field)];
    if (logs && ["failedStage", "error"].includes(field) && value === undefined) return [field, null];
    if (value === undefined || !schemas[wire(field)]!.safeParse(value).success) invalid(`Missing or malformed selected field: ${field}`);
    if (logs && field === "timestamp") value = (value as Record<string, unknown>).start;
    if (logs && field === "failedStage") value = (value as Record<string, unknown>[]).find((stage) => stage.status === "FAILED")?.name ?? null;
    if (logs && field === "error") {
      const entry = (value as Record<string, unknown>[]).find((entry) => entry.level === "ERROR");
      value = entry?.summarized_text ?? entry?.text ?? null;
    }
    if (logs && ["failedStage", "error"].includes(field) && value !== null && typeof value !== "string") invalid(`Malformed selected field: ${field}`);
    if (technique && field === "affectedAssets") value = (value as string[]).length;
    return [field, preview(store.redactor.payload(value))];
  }));
  try {
    while (rows.length < rowLimit) {
      if (pendingIndex < pending.length) {
        rows.push(project(pending[pendingIndex]!));
        pendingIndex++;
        continue;
      }
      pending = [];
      pendingIndex = 0;
      if (exhausted) break;
      const limit = Math.max(100, Math.min(1000, rowLimit - rows.length));
      const response = await transport.request(operation, { query: logs ? query : { ...query, offset, limit },
        ...(body === undefined ? {} : { body }) });
      let data: Record<string, unknown>[];
      if (logs) {
        const page = logPage.parse(response.body);
        data = page.items;
        total = page.total_count ?? null;
        if (total !== null && total < data.length) invalid("Connector total is smaller than the returned collection");
        exhausted = true;
        upstreamLimited = total !== null && total > data.length;
      } else {
        const page = attackPage.parse(response.body);
        data = page.data;
        if (data.length > limit) invalid("The server exceeded the requested page limit");
        if (page.pagination) {
          if (page.pagination.offset !== offset) invalid("The server returned a different or repeated offset");
          total = page.pagination.total ?? total;
        }
        if (total !== null && data.length && offset + data.length > total) invalid("The server returned rows beyond its reported total");
        if (!data.length && total !== null && offset < total) invalid("The server returned an empty page before the reported total");
        const identity = hash(data);
        if (data.length && identity === lastPage) invalid("The server repeated the previous page");
        lastPage = identity;
        exhausted = total !== null ? offset + data.length >= total : data.length < limit;
      }
      offset += data.length;
      if (!Number.isSafeInteger(offset)) invalid("The server returned an unrepresentable offset");
      // Keep only selected wire fields, redacted before entering a public cursor.
      pending = store.redactor.payload(data.map((row) => Object.fromEntries(fields.flatMap((field) =>
        row[wire(field)] === undefined ? [] : [[wire(field), row[wire(field)]]])))) as Record<string, unknown>[];
    }
  } catch (error) {
    if (!(error instanceof TransportError)) throw error;
    if (["REQUEST_BUDGET_EXCEEDED", "BYTE_BUDGET_EXCEEDED", "DEADLINE_EXCEEDED"].includes(error.error.code)) reason = error.error.code;
    else { if (!rows.length) throw error; failure = error; }
  }
  pending = pending.slice(pendingIndex);
  const complete = exhausted && !pending.length && !upstreamLimited && !failure && !reason;
  const resume = !complete && (pending.length > 0 || !exhausted);
  const cursor = resume ? Buffer.from(JSON.stringify({ version: 1, scope, offset, pending, exhausted, total, lastPage, upstreamLimited })).toString("base64url") : undefined;
  if (cursor && cursor.length > maxCursor) invalid("Continuation exceeds its byte bound; narrow the selected fields or filters");
  const command = (excluded: string[]) => ["tenable-axi", name, ...[...flags].flatMap(([flag, values]) => excluded.includes(flag) ? []
    : values.flatMap((value) => [flag, ...(booleans.includes(flag) ? [] : [JSON.stringify(value)])]))].join(" ");
  const help: string[] = [];
  if (truncated) help.push(`Run ${command(["--full"])} --full to read complete text`);
  if (resume) help.push(`Run ${command(["--cursor", "--offset"])} --cursor <cursor> to resume; offset paging does not provide snapshot isolation`);
  if (upstreamLimited) help.push("The connector API has no server paging; narrow --connector-id and the paired date range to retrieve missing history");
  const noun = logs ? "logs" : technique ? "attackTechniques" : "attackPaths";
  return { [noun]: rows, count: rows.length, total, complete,
    ...(!rows.length && complete ? { message: `0 ${logs ? "connector logs" : technique ? "attack techniques" : "attack paths"} matched the selected filters` } : {}),
    ...(!complete ? { reason: reason ?? (failure ? "READ_FAILED" : upstreamLimited && !pending.length ? "UPSTREAM_UNPAGED" : get("all") ? "ROW_BUDGET_EXCEEDED" : "LIMIT") } : {}),
    ...(cursor ? { cursor } : {}), ...(failure ? failure.toJSON() : {}),
    ...(help.length || failure?.help.length ? { help: [...help, ...(failure?.help ?? [])] } : {}) };
}
