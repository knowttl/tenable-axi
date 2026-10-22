import { AxiError } from "axi-sdk-js";
import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";
import { z } from "zod";
import { responseBodies, responseCatalogue, type ResponseKind } from "./response-catalogue.js";
import type { credentialStore } from "./profiles.js";
import { createTransport, TransportError } from "./transport.js";
import type { TransportFactory } from "./exposure.js";
import { createWriteCoordinator } from "./writes.js";
import type { WriteCoordinatorFactory } from "./inventory-export.js";

function bodyFile(path: string): unknown {
  const fd = path === "-" ? 0 : openSync(path, "r");
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for (;;) {
      const chunk = Buffer.alloc(8192);
      const length = readSync(fd, chunk, 0, chunk.length, null);
      if (!length) break;
      size += length;
      if (size > 1024 * 1024) throw new Error("Input too large");
      chunks.push(chunk.subarray(0, length));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally { if (path !== "-") closeSync(fd); }
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const cursorSchema = z.strictObject({ version: z.literal(1), scope: z.string(), pending: z.array(z.record(z.string(), z.unknown())) });
const maxCursor = 28 * 1024 * 1024;
const counts = z.object({ last_count: z.number().int(), current_count: z.number().int() }).partial().passthrough();
const statistics = z.object({ total_assets: z.number().int(), total_findings: z.number().int(), findings_remediated: z.number().int(),
  average_vuln_age: z.number(), average_remediated_time: z.number(), total_cves: z.number().int(), total_cves_change: z.number(),
  by_combination: z.array(z.object({ combination_id: z.string().uuid(), asset_count: z.number().int(), findings_count: z.number().int() }).partial().passthrough()),
  by_tag: z.array(z.object({ tag_id: z.string().uuid(), asset_count: z.number().int(), findings_count: z.number().int() }).partial().passthrough()),
}).partial().passthrough();
const trending = z.array(z.object({ date_generated: z.string(), remediated_count: z.number().int(), active_count: z.number().int(), cve_count: z.number().int(),
  average_vuln_age: z.number(), average_remediation_time: z.number(), event: z.object({ active_findings: counts, resurfaced_findings: counts, assets: counts,
    combination_change: z.object({ added: z.number().int(), updated_by_tenable: z.number().int(), updated: z.number().int(), deleted: z.number().int() }).partial().passthrough(),
  }).partial().passthrough(),
}).partial().passthrough());
const fields: Record<string, z.ZodType> = { id: z.string().uuid(), name: z.string(), description: z.string(), owner: z.string().uuid(),
  sla_in_days: z.number().int(), scope: z.array(z.string().uuid()), combination_ids: z.array(z.string().uuid()), tenable_ids: z.array(z.string().uuid()),
  query: z.json(), is_public: z.boolean(), read_only: z.boolean().nullable(), last_updated_at: z.string(), modified_at: z.string(),
  product: z.string(), used_in_initiative: z.boolean(), used_in_non_owned_initiative: z.boolean(), operators: z.array(z.string()),
  type: z.union([z.string(), z.record(z.string(), z.string()), z.null()]), selectMultiValue: z.boolean(), allowedValues: z.array(z.string()), total_assets: z.number(), total_findings: z.number(),
  remediated_findings: z.number(), average_vuln_age: z.number(), average_remediation_time: z.number(), total_cves: z.number(),
  total_cves_change: z.number(), total_assets_change: z.number(), total_findings_change: z.number(), last_computed_at: z.string(),
  total_unassigned_findings: z.number().int(), statistics, trending, tickets_count: z.number().int(), delivery_methods: z.object({}).passthrough() };

export async function responseCommand(argv: string[], store: ReturnType<typeof credentialStore>, factory: TransportFactory = createTransport,
  writeFactory: WriteCoordinatorFactory = createWriteCoordinator): Promise<Record<string, unknown>> {
  const name = argv.slice(0, 2).join(" ");
  const entry = responseCatalogue[name];
  const usage = (message: string): never => { throw new AxiError(message, "VALIDATION_ERROR", [entry
    ? `Valid flags for ${name}: ${Object.keys(entry.flags).map((flag) => `--${flag}`).join(", ")}`
    : `Valid commands: ${Object.keys(responseCatalogue).join(", ")}`]); };
  if (!entry) usage("Unknown exposure response command");
  const flags = new Map<string, string>();
  for (let index = 2; index < argv.length; index++) {
    const flag = argv[index]!;
    if (!flag.startsWith("--") || !Object.hasOwn(entry!.flags, flag.slice(2)) || flags.has(flag)) usage(`Unknown argument, flag, or duplicate flag: ${flag}`);
    const value = ["--help", "--full", "--all", "--execute", "--dry-run"].includes(flag) ? "true" : argv[++index];
    if (!value || value.startsWith("--")) usage(`Missing value for ${flag}`);
    flags.set(flag, value!);
  }
  const get = (key: string) => flags.get(`--${key}`);
  if (get("help")) return { command: name, ...entry };
  const kind = argv[0] as ResponseKind, verb = argv[1]!;
  const operation = entry!.operationId;
  if (["show", "update", "delete"].includes(verb) && !z.string().uuid().safeParse(get("id")).success) usage("--id requires the exact UUID");
  if (get("type") && !["private", "shared", "tenable"].includes(get("type")!)) usage("--type must be private, shared or tenable");
  if (get("all") && get("limit")) usage("--all and --limit are mutually exclusive");
  if (get("execute") && get("dry-run")) usage("--execute and --dry-run are mutually exclusive");
  const limit = get("all") ? 10000 : Number(get("limit") ?? 100);
  if (get("limit") && (!/^\d+$/.test(get("limit")!) || !Number.isSafeInteger(limit) || limit < 1 || limit > 10000)) usage("--limit must be 1-10000");
  const selected = get("fields")?.split(",") ?? entry!.defaultFields;
  const alias: Record<string, string> = { slaInDays: "sla_in_days", ...(verb === "filters" ? { property: "name" } : {}) };
  const allowed = verb === "filters" ? ["name", "operators", "type", "selectMultiValue", "allowedValues"] : ["create", "delete"].includes(verb) ? ["id"]
    : kind === "combination" ? ["id", "name", "description", "owner", "query", "last_updated_at", "is_public", "read_only", "used_in_initiative", "used_in_non_owned_initiative", "product", "type"]
      : ["id", "name", "description", "owner", "sla_in_days", "scope", "combination_ids", "tenable_ids", "product", "last_computed_at", "modified_at", "tickets_count", "delivery_methods",
        ...(verb === "show" ? ["statistics", "trending"] : ["total_assets_change", "total_findings_change"]),
        ...(verb === "list" ? ["total_assets", "total_findings", "remediated_findings", "average_vuln_age", "average_remediation_time", "total_cves", "total_cves_change", "total_unassigned_findings"] : [])];
  if (selected.some((field) => !allowed.includes(alias[field] ?? field)) || new Set(selected).size !== selected.length) usage(`Output fields: ${allowed.join(",")}; fields must be unique`);
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (get("cursor")) {
    try {
      if (get("cursor")!.length > maxCursor || !/^[A-Za-z0-9_-]+$/.test(get("cursor")!)) throw new Error();
      cursor = cursorSchema.parse(JSON.parse(Buffer.from(get("cursor")!, "base64url").toString("utf8")));
    } catch { usage("Invalid cursor; use the returned cursor with its original selectors"); }
  }
  let truncated = false;
  const preview = (value: unknown): unknown => {
    if (typeof value === "string" && value.length > 1000 && !get("full")) {
      truncated = true;
      return `${value.slice(0, 1000)}... (truncated, ${value.length} chars total)`;
    }
    if (Array.isArray(value)) return value.map(preview);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, preview(child)]));
    return value;
  };
  const command = (exclude: string[] = []) => ["tenable-axi", name, ...[...flags].flatMap(([flag, value]) => exclude.includes(flag) ? []
    : [flag, ...(["--help", "--full", "--all", "--execute", "--dry-run"].includes(flag) ? [] : [JSON.stringify(value)])])].join(" ");
  const fullHelp = () => truncated ? [`Run ${command(["--full"])} --full to read complete text`] : [];
  const project = (row: Record<string, unknown>) => Object.fromEntries(selected.flatMap((field) => {
    const wire = alias[field] ?? field;
    if (!get("fields") && field === "description" && row[wire] === undefined) return [];
    const value = field === "type" && kind === "combination" && verb !== "filters"
      ? get("type") ?? (row.is_public === true ? "shared" : row.is_public === false ? "private" : null) : row[wire];
    if (!fields[wire]!.safeParse(value).success) throw new TransportError({ code: "RESPONSE_INVALID", message: `Missing or malformed selected field: ${field}`, operation });
    return [[field, preview(value)]];
  }));
  if (["create", "update", "delete"].includes(verb)) {
    let body: unknown;
    if (verb !== "delete") {
      if (!get("body-file")) usage("--body-file is required");
      try { body = bodyFile(get("body-file")!); } catch { usage("Cannot read --body-file as JSON within the 1 MiB limit"); }
      const parsed = responseBodies[kind].safeParse(body);
      if (!parsed.success) usage("Invalid body; use documented non-security fields, UUIDs, name/description limits, at most ten scope/combinations, and six queries per combination");
      body = parsed.data;
    }
    const result = await writeFactory({ config: get("config"), profile: get("profile") }).run(operation,
      { ...(get("id") ? { id: get("id")! } : {}), ...(body === undefined ? {} : { body }) },
      { execute: get("execute") === "true", dryRun: get("dry-run") === "true", confirm: get("confirm") });
    const output = preview(result.kind === "success" ? { ...result, response: project({ ...(get("id") ? { id: get("id") } : {}),
      ...result.response as Record<string, unknown> }) } : result) as Record<string, unknown>;
    // Confirmation is an exact contract even when long names or other text are truncated.
    output.preview = { ...(output.preview as Record<string, unknown>), confirm: result.preview.confirm };
    return { ...output, ...(truncated ? { help: fullHelp() } : {}) };
  }
  store.readOnly();
  const loaded = store.load(get("config"));
  const profile = store.select(loaded.config, get("profile"));
  const scope = hash([profile.origin, profile.name, profile.accessKey, profile.secretKey, loaded.path, operation, get("type"), selected]);
  if (cursor && cursor.scope !== scope) usage("Cursor belongs to different profile, operation, type or fields");
  const transport = factory({ keys: store.credentials(profile), origin: profile.origin });
  const response = cursor ? undefined : await transport.request(operation, verb === "show" ? { pathParams: { [`${kind}_id`]: get("id")! } }
    : get("type") ? { query: { type: get("type")! } } : {});
  if (verb === "show") {
    const row = response!.body as Record<string, unknown>;
    if (row.id !== get("id")) throw new TransportError({ code: "RESPONSE_INVALID", message: "Details returned a different ID", operation });
    const output = project(row);
    return { [kind]: output, ...(truncated ? { help: fullHelp() } : {}) };
  }
  const key = verb === "filters" ? "filters" : `${kind}s`;
  const rows = cursor?.pending ?? (response!.body as Record<string, Record<string, unknown>[]>)[key]!;
  const data: Record<string, unknown>[] = [];
  let failure: TransportError | undefined;
  for (const row of rows.slice(0, limit)) {
    try { data.push(project(row)); }
    catch (error) {
      if (!(error instanceof TransportError) || !data.length) throw error;
      failure = error;
      break;
    }
  }
  const next = data.length;
  const complete = next === rows.length;
  // Preserve only selected wire fields, before text truncation, with the same bounded cursor contract as connector logs.
  const wireFields = [...new Set([...selected.map((field) => alias[field] ?? field), ...(kind === "combination" && selected.includes("type") && verb !== "filters" ? ["is_public"] : [])])];
  const pending = store.redactor.payload(rows.slice(next).map((row) => Object.fromEntries(wireFields.flatMap((field) =>
    row[field] === undefined ? [] : [[field, row[field]]]))));
  const resume = complete ? undefined : Buffer.from(JSON.stringify({ version: 1, scope, pending })).toString("base64url");
  if (resume && resume.length > maxCursor) throw new TransportError({ code: "RESPONSE_INVALID", message: "Continuation exceeds its byte bound; narrow selected fields", operation });
  const help = [...fullHelp(), ...(verb === "list" ? [`Run tenable-axi ${kind} show --id <id>${get("config") ? ` --config ${JSON.stringify(get("config"))}` : ""} --profile ${profile.name}`] : [])];
  if (!complete) help.push(`Run ${command(["--cursor"])} --cursor <cursor> to resume the saved unpaged collection`);
  return { [key]: data, count: data.length, total: null, complete,
    ...(!data.length ? { message: `0 ${key} matched the selected filters` } : {}),
    ...(!complete ? { reason: failure ? "READ_FAILED" : get("all") ? "ROW_BUDGET_EXCEEDED" : "LIMIT", cursor: resume } : {}),
    ...(failure ? failure.toJSON() : {}),
    ...(help.length ? { help } : {}) };
}
