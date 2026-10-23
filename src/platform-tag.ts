import { AxiError } from "axi-sdk-js";
import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";
import { z } from "zod";
import { platformTagCatalogue, platformTagInputs, tagPagination } from "./platform-tag-catalogue.js";
import type { credentialStore } from "./profiles.js";
import { createTransport, TransportError, type RequestOptions } from "./transport.js";
import type { TransportFactory } from "./exposure.js";
import type { WriteCoordinatorFactory } from "./inventory-export.js";
import { createWriteCoordinator } from "./writes.js";

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const cursorSchema = z.strictObject({ version: z.literal(1), scope: z.string(), offset: integer,
  pending: z.array(z.record(z.string(), z.unknown())), exhausted: z.boolean(), total: integer.nullable(), lastPage: z.string().nullable() });
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const uuid = z.string().uuid();
const fieldTypes: Record<string, z.ZodType> = { id: uuid, name: z.string(), reserved: z.boolean(), category: z.string(), value: z.string().nullable(),
  type: z.string().nullable(), assetId: uuid, tagId: uuid, targetId: uuid, targetType: z.literal("assets"), property: z.string(), operators: z.array(z.string()),
  description: z.string(), category_uuid: uuid, category_description: z.string(), created_at: z.string(), updated_at: z.string(),
  created_by: z.string(), updated_by: z.string(), version: z.number().int(), filters: z.object({ asset: z.string() }),
  access_control: z.record(z.string(), z.unknown()), control: z.record(z.string(), z.unknown()), readable_name: z.string(),
  ipv4: z.array(z.string()), sources: z.array(z.string()), product: z.string(), source: z.string(), container_uuid: uuid };

function inputFile(path: string): unknown {
  const fd = path === "-" ? 0 : openSync(path, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024 + 1);
    let size = 0;
    while (size < buffer.length) {
      const count = readSync(fd, buffer, size, buffer.length - size, null);
      if (!count) break;
      size += count;
    }
    if (size > 1024 * 1024) throw new Error("Input exceeds 1 MiB");
    return JSON.parse(buffer.subarray(0, size).toString("utf8")) as unknown;
  } finally { if (path !== "-") closeSync(fd); }
}

export async function platformTagCommand(argv: string[], store: ReturnType<typeof credentialStore>, factory: TransportFactory = createTransport,
  writeFactory: WriteCoordinatorFactory = createWriteCoordinator): Promise<Record<string, unknown>> {
  const name = argv.slice(0, 3).join(" ");
  const entry = platformTagCatalogue[name];
  const usage = (message: string): never => { throw new AxiError(message, "VALIDATION_ERROR", [entry
    ? `Valid flags for ${name}: ${Object.keys(entry.flags).map((flag) => `--${flag}`).join(", ")}`
    : `Valid commands: ${Object.keys(platformTagCatalogue).join(", ")}`]); };
  if (!entry) usage("Unknown platform tag command");
  const flags = new Map<string, string[]>();
  const booleans = ["--help", "--full", "--all", "--execute", "--dry-run"];
  for (let index = 3; index < argv.length; index++) {
    const flag = argv[index]!;
    if (!flag.startsWith("--") || !Object.hasOwn(entry!.flags, flag.slice(2)) || flags.has(flag) && flag !== "--filter") usage(`Unknown argument, flag, or duplicate flag: ${flag}`);
    const value = booleans.includes(flag) ? "true" : argv[++index];
    if (value === undefined || value.startsWith("--") || !value && flag !== "--description") usage(`Missing value for ${flag}`);
    flags.set(flag, [...flags.get(flag) ?? [], value!]);
  }
  const get = (key: string) => flags.get(`--${key}`)?.[0];
  if (get("help")) return { command: name, ...entry };
  const operation = entry!.operationId, noun = argv[1]!, verb = argv[2]!;
  const invalid = (message: string): never => { throw new TransportError({ code: "RESPONSE_INVALID", message, operation }); };
  const category = noun === "category", value = noun === "value", assignment = noun === "assignment", exclusion = noun === "exclusion";
  const mutating = Object.hasOwn(platformTagInputs, operation);
  const available = mutating && ["delete", "bulk-delete"].includes(verb) ? ["kind", "auditId", "status"]
    : mutating && assignment ? ["id", "state"]
      : category ? ["id", "name", "reserved", "description", "created_at", "created_by", "updated_at", "updated_by"]
    : value ? ["id", "category", "value", "type", "description", "category_uuid", "category_description", "created_at", "created_by", "updated_at", "updated_by", "filters", "access_control", "version"]
      : assignment ? ["assetId", "tagId", "value", "category", "category_uuid", "created_at", "created_by", "product", "source", "container_uuid"]
        : exclusion ? ["targetId", "targetType", "tagId", "name", "ipv4", "sources", "container_uuid"] : ["property", "operators", "readable_name", "control"];
  const fields = get("fields")?.split(",") ?? entry!.defaultFields;
  if (fields.some((field) => !available.includes(field)) || new Set(fields).size !== fields.length) usage(`Output fields: ${available.join(",")}`);
  if (get("execute") && get("dry-run")) usage("--execute and --dry-run are mutually exclusive");
  if (get("intent-id") !== undefined && !get("intent-id")!.trim()) usage("--intent-id must not be blank");
  if (get("all") && get("limit") || get("cursor") && get("offset")) usage("Incompatible paging flags");
  const number = (flag: string, fallback: number, min: number, max: number) => {
    const raw = get(flag), result = raw === undefined ? fallback : Number(raw);
    if (raw !== undefined && !/^\d+$/.test(raw) || !Number.isSafeInteger(result) || result < min || result > max) usage(`Invalid --${flag}`);
    return result;
  };
  const limit = number("limit", get("all") ? 10000 : 100, 1, 10000);
  let offset = number("offset", 0, 0, Number.MAX_SAFE_INTEGER);
  for (const flag of ["id", "asset-id", "tag-id"]) {
    if (Object.hasOwn(entry!.flags, flag) && !uuid.safeParse(get(flag)).success) usage(`--${flag} requires an exact UUID`);
  }
  const command = (excluded: string[] = []) => ["tenable-axi", name, ...[...flags].flatMap(([flag, values]) => excluded.includes(flag) ? []
    : values.flatMap((value) => [flag, ...(booleans.includes(flag) ? [] : [`'${value.replaceAll("'", "'\"'\"'")}'`])]))].join(" ");
  let truncated = false;
  function preview(input: unknown, key?: string): unknown {
    if (typeof input === "string" && key !== "confirm" && input.length > 1000 && !get("full")) { truncated = true; return `${input.slice(0, 1000)}... (truncated, ${input.length} chars total)`; }
    if (Array.isArray(input)) return input.map((child) => preview(child));
    if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).map(([key, child]) => [key, preview(child, key)]));
    return input;
  }
  if (mutating) {
    const fileFlags = ["body-file", "ids-file", "asset-ids-file", "tag-ids-file"].filter((flag) => Object.hasOwn(entry!.flags, flag));
    if (fileFlags.filter((flag) => get(flag) === "-").length > 1) usage("Only one input file may consume stdin");
    const files: Record<string, unknown> = {};
    for (const flag of fileFlags) {
      if (!get(flag)) usage(`--${flag} is required`);
      try { files[flag] = inputFile(get(flag)!); } catch { usage(`Cannot read --${flag} as JSON within the 1 MiB limit`); }
    }
    const body = verb === "delete" ? undefined : verb === "bulk-delete" ? { values: files["ids-file"] }
      : assignment ? { action: verb, assets: files["asset-ids-file"], tags: files["tag-ids-file"] }
        : category ? { name: get("name"), ...(get("description") === undefined ? {} : { description: get("description") }) } : files["body-file"];
    const input = platformTagInputs[operation as keyof typeof platformTagInputs].safeParse({ ...(get("id") ? { id: get("id") } : {}), ...(body === undefined ? {} : { body }) });
    if (!input.success) usage("Invalid tag input; use documented fields and UUID arrays, at most 40 dynamic rules and 1024 values per rule; security fields are forbidden");
    const readBack = "The write succeeded; read back the target before retrying";
    const result = await writeFactory({ config: get("config"), profile: get("profile") }).run(operation, input.data,
      { execute: !!get("execute"), dryRun: !!get("dry-run"), confirm: get("confirm"), intentId: get("intent-id") }).catch((error: unknown) => {
        if (!(error instanceof TransportError) || error.error.code !== "RESPONSE_INVALID" || !error.error.auditId
          || error.error.status === undefined || error.error.status < 200 || error.error.status >= 300) throw error;
        return { kind: "success" as const, auditId: error.error.auditId, status: error.error.status,
          warning: "Write succeeded, but its response could not be decoded", help: [readBack] };
      });
    if ("warning" in result) return result;
    if (result.kind !== "success") {
      const output = preview(result) as Record<string, unknown>;
      return { ...output, ...(truncated ? { help: [`Run ${command(["--full"])} --full to read complete text`] } : {}) };
    }
    const response = result.response as Record<string, unknown>;
    const metadata = { kind: "success", auditId: result.auditId, status: result.status };
    let selected: Record<string, unknown>;
    try {
      if (assignment) {
        const job = { id: response.job_uuid, state: "ACCEPTED" };
        selected = { ...metadata, job: Object.fromEntries(fields.map((field) => [field, job[field as keyof typeof job]])) };
      } else if (["delete", "bulk-delete"].includes(verb)) selected = Object.fromEntries(fields.map((field) => [field, metadata[field as keyof typeof metadata]]));
      else {
        if (get("id") && response.uuid !== get("id")) invalid("Mutation response returned another identifier");
        selected = { ...metadata, tag: preview(project(response)) };
      }
    } catch (error) {
      if (!(error instanceof TransportError)) throw error;
      return { ...metadata, warning: "Write succeeded, but its response could not be displayed", help: [readBack] };
    }
    return { ...selected, help: [`Run tenable-axi tag ${assignment ? "assignment list --asset-id <id>" : ["delete", "bulk-delete"].includes(verb) ? `${noun} list` : `${noun} show --id ${response.uuid}`}${get("config") ? ` --config '${get("config")!.replaceAll("'", "'\"'\"'")}'` : ""} --profile ${result.preview.profile}`,
      ...(truncated ? [`Run ${command(["--full"])} --full to read complete text`] : [])] };
  }
  const query: NonNullable<RequestOptions["query"]> = {};
  const mutableQuery: Record<string, string | string[]> = {};
  const filters = flags.get("--filter") ?? [];
  for (const filter of filters) {
    const match = /^([^:]+):([^:]+):(.+)$/s.exec(filter);
    if (!match) usage("--filter requires field:operator:value");
    const [, field, operator, content] = match!;
    const dates = category ? ["created_at", "updated_at"] : ["updated_at"];
    const valid = dates.includes(field!) ? ["date-eq", "date-gt", "date-lt"].includes(operator!) && /^\d+$/.test(content!)
      : field === "updated_by" ? operator === "eq" && uuid.safeParse(content).success
        : (category ? ["name", "description"] : ["value", "category_name", "description"]).includes(field!) && ["eq", "match"].includes(operator!);
    if (!valid) usage("Unsupported platform tag filter; use documented fields and operators");
  }
  if (filters.length) mutableQuery.f = filters;
  if (get("filter-type")) { if (!["and", "or"].includes(get("filter-type")!)) usage("--filter-type requires and or or"); mutableQuery.ft = get("filter-type")!; }
  if (get("sort")) { if (!/^[A-Za-z_]+:(asc|desc)(,[A-Za-z_]+:(asc|desc))*$/.test(get("sort")!)) usage("--sort requires comma-separated field:asc|desc"); mutableQuery.sort = get("sort")!; }
  if (!!get("with") !== !!get("with-filter")) usage("--with and --with-filter must be supplied together");
  if (get("with-filter")) {
    if (get("with-filter")!.split(",").some((field) => !["category_name", "value", "description"].includes(field))) usage("--with-filter fields: category_name,value,description");
    mutableQuery.w = get("with")!; mutableQuery.wf = get("with-filter")!;
  }
  if (get("target-type") && get("target-type") !== "assets") usage("--target-type must be assets");
  if (exclusion) mutableQuery.target_type = get("target-type") ?? "assets";
  Object.assign(query, mutableQuery);
  const pathParams: RequestOptions["pathParams"] = get("id") ? { [category ? "tag_category_uuid" : "tag_value_uuid"]: get("id")! }
    : assignment ? { asset_uuid: get("asset-id")! } : exclusion ? { tag_value_uuid: get("tag-id")! } : undefined;
  let saved: z.infer<typeof cursorSchema> | undefined;
  if (get("cursor")) {
    try {
      const raw = get("cursor")!;
      if (raw.length > 28 * 1024 * 1024 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
      saved = cursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    } catch { usage("Invalid resume cursor; retain the original scope and cursor"); }
  }
  store.readOnly();
  const profile = store.select(store.load(get("config")).config, get("profile"));
  const scope = hash([profile.origin, profile.name, store.configPath(get("config")), operation, pathParams, query, fields, !!get("full")]);
  if (saved && saved.scope !== scope) usage("Cursor belongs to a different profile, operation, selector, fields or filters");
  const transport = factory({ keys: store.credentials(profile), origin: profile.origin });
  function project(row: Record<string, unknown>) {
    const mapped = { ...row, ...(category ? { id: row.uuid } : value ? { id: row.uuid ?? (row.value === undefined && row.type === undefined ? row.category_uuid : undefined), category: row.category_name,
      value: row.value === undefined && row.type === undefined ? null : row.value, type: row.value === undefined && row.type === undefined ? null : row.type,
      version: row.version ?? (row.access_control as { version?: unknown } | undefined)?.version }
      : assignment ? { assetId: row.asset_uuid, tagId: row.value_uuid, category: row.category_name }
        : exclusion ? { targetId: row.asset_uuid, targetType: "assets", tagId: row.value_uuid } : { property: row.name }) } as Record<string, unknown>;
    if (assignment && mapped.assetId !== get("asset-id")) invalid("Assignment read returned another asset");
    if (exclusion && row.value_uuid !== undefined && row.value_uuid !== get("tag-id")) invalid("Exclusion read returned another tag");
    const selected = Object.fromEntries(fields.map((field) => {
      if (!fieldTypes[field]!.safeParse(mapped[field]).success) invalid(`Missing or malformed selected field: ${field}`);
      return [field, mapped[field]];
    }));
    return store.redactor.payload(selected) as Record<string, unknown>;
  }
  if (verb === "show") {
    const row = (await transport.request(operation, { pathParams })).body as Record<string, unknown>;
    if (row.uuid !== get("id")) invalid("Tag read returned another identifier");
    const tag = preview(project(row));
    return { tag, ...(truncated ? { help: [`Run ${command(["--full"])} --full to read complete text`] } : {}) };
  }
  const paged = category || value || exclusion;
  const key = category ? "categories" : value ? "values" : assignment ? "tags" : exclusion ? "excluded_targets" : "filters";
  const rows: Record<string, unknown>[] = [];
  let pending = saved?.pending ?? [], exhausted = saved?.exhausted ?? false, total = saved?.total ?? null, lastPage = saved?.lastPage ?? null;
  offset = saved?.offset ?? offset;
  let failure: TransportError | undefined, reason: string | undefined;
  try {
    for (let page = 0; rows.length < limit; page++) {
      while (pending.length && rows.length < limit) {
        const row = pending[0]!;
        if (fields.some((field) => !fieldTypes[field]!.safeParse(row[field]).success)) invalid("Malformed pending tag fields in cursor");
        rows.push(row);
        pending.shift();
      }
      if (rows.length >= limit || exhausted) break;
      if (page >= 20) { reason = "REQUEST_BUDGET_EXCEEDED"; break; }
      const window = Math.min(1000, limit - rows.length);
      const response = (await transport.request(operation, { pathParams, query: { ...query, ...(paged ? { offset, limit: window } : {}) } })).body as Record<string, unknown>;
      const data = response[key] as Record<string, unknown>[];
      let nextTotal = total, nextExhausted = true;
      if (paged) {
        const pagination = tagPagination.parse(response.pagination);
        if (pagination.offset !== offset || data.length > window || pagination.limit !== window || offset + data.length > pagination.total
          || !data.length && offset < pagination.total) invalid("Malformed or non-advancing tag pagination");
        nextTotal = pagination.total;
        nextExhausted = offset + data.length >= nextTotal;
      }
      const identity = hash(data);
      if (data.length && identity === lastPage) invalid("Tenable repeated the previous tag page");
      const projected = data.map(project);
      if (!Number.isSafeInteger(offset + data.length)) invalid("Unrepresentable tag offset");
      pending = projected;
      offset += data.length;
      lastPage = identity;
      total = nextTotal;
      exhausted = nextExhausted;
    }
  } catch (error) {
    if (!(error instanceof TransportError)) throw error;
    if (["REQUEST_BUDGET_EXCEEDED", "DEADLINE_EXCEEDED", "BYTE_BUDGET_EXCEEDED"].includes(error.error.code)) reason = error.error.code;
    else { if (!rows.length) throw error; failure = error; }
  }
  const complete = exhausted && !pending.length && !failure && !reason;
  const cursor = complete ? undefined : Buffer.from(JSON.stringify({ version: 1, scope, offset, pending, exhausted, total, lastPage })).toString("base64url");
  if (cursor && cursor.length > 28 * 1024 * 1024) invalid("Tag continuation exceeds its byte bound; narrow fields or filters");
  if (failure) process.exitCode = 1;
  const output = preview(rows);
  const help = [...(cursor ? [`Run ${command(["--cursor", "--offset"])} --cursor <cursor> to resume; offset paging does not provide snapshot isolation`] : []),
    ...(truncated ? [`Run ${command(["--full"])} --full to read complete text`] : []), ...(failure?.help ?? []),
    ...(noun === "asset-filter" ? ["Resource tag filters cloud.common.resource_tags.key and cloud.common.resource_tags.value also support wc,nwc,exists,nexists; upstream omits them from this list"] : [])];
  return { [key]: output, count: rows.length, total, complete, ...(!rows.length && complete ? { message: `0 tag ${noun} records matched the selected filters` } : {}),
    ...(!complete ? { reason: reason ?? (failure ? "READ_FAILED" : get("all") ? "ROW_BUDGET_EXCEEDED" : "LIMIT"), cursor } : {}),
    ...(failure ? failure.toJSON() : {}), ...(help.length ? { help } : {}) };
}
