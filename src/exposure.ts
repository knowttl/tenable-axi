import { AxiError } from "axi-sdk-js";
import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { z } from "zod";
import { catalogue, DESCRIPTION, SETUP_GUIDANCE, transportBindings } from "./catalogue.js";
import { cardDetails, cardRecord, properties, tagRecord } from "./exposure-contracts.js";
import { credentialStore } from "./profiles.js";
import { createTransport, TransportError, type Transport, type TransportOptions } from "./transport.js";

export type TransportFactory = (options: TransportOptions) => Transport;
export function homeIdentity() {
  const executable = resolve(process.argv[1]!);
  const home = homedir();
  const prefix = home.endsWith(sep) ? home : `${home}${sep}`;
  return { bin: executable.startsWith(prefix) ? `~${sep}${executable.slice(prefix.length)}` : executable, description: DESCRIPTION };
}
const operators = ["=", "!=", "<=", "between", "match", ">=", "<", ">", "contains", "not contains", "exists", "not exists", "older than", "newer than", "within last"] as const;
const filterSchema = z.array(z.strictObject({ property: z.string().min(1), operator: z.enum(operators), value: z.array(z.string()) }));
const cardFields = ["id", "name", "score", "card_type", "is_global_card", "tag_count", "created_at", "updated_at", "sla_percentage", "ces_trend", "exposure_class", "last_data_update_date", "sources"];
const detailFields = [...cardFields.filter((field) => !["sla_percentage", "exposure_class"].includes(field)), "ces_scores", "exposures", "exposure_classes_details"];
const tagFields = ["id", "category", "value", "name", "product", "asset_count", "weakness_severity_counts", "total_weakness_count", "type", "extra_properties"];
const propertyFields = ["property", "operators", "readable_name", "control", "sortable", "filterable", "description"];
const cursorSchema = z.strictObject({ scope: z.string(), offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  pending: z.array(cardRecord).max(24).optional(), total: z.number().int().nonnegative().optional() });
const cursorMaxLength = 64 * 1024;
const fieldTypes: Record<string, z.ZodType> = {
  id: z.string(), name: z.string(), value: z.string(), category: z.string(), score: z.number(),
  product: z.string(), type: z.string(), card_type: z.string(), is_global_card: z.boolean(),
  asset_count: z.number().int(), tag_count: z.number().int(), total_weakness_count: z.number().int(),
  sla_percentage: z.number(), created_at: z.string(), updated_at: z.string(), last_data_update_date: z.string(),
  ces_trend: z.array(z.object({ date: z.string(), ces_score: z.number() }).passthrough()),
  sources: z.array(z.string()), exposures: z.array(z.string()), exposure_class: z.array(z.string()),
  ces_scores: z.object({ total: z.object({ score: z.number() }).passthrough() }).passthrough(),
  exposure_classes_details: z.record(z.string(), z.record(z.string(), z.unknown())),
  extra_properties: z.record(z.string(), z.unknown()), weakness_severity_counts: z.record(z.string(), z.number()),
};

export async function exposureCommand(argv: string[], store: ReturnType<typeof credentialStore>, factory: TransportFactory = createTransport): Promise<Record<string, unknown>> {
  const name = !argv.length || argv[0]?.startsWith("-") ? "home"
    : ["card", "tag"].includes(argv[0]!) ? argv.slice(0, 2).join(" ") : argv[0]!;
  const entry = catalogue[name as keyof typeof catalogue];
  const usage = (message = "Unknown command, argument, duplicate or invalid flag"): never => {
    throw new AxiError(message, "VALIDATION_ERROR", [entry
      ? `Valid flags for ${name}: ${Object.keys(entry.flags).map((flag) => `--${flag}`).join(", ")}`
      : "Valid commands: home, card list, card show, tag list, tag properties, doctor, hook; run tenable-axi --help"]);
  };
  if (!entry) usage();
  const flags = new Map<string, string>();
  const filters: string[] = [];
  const start = !argv.length || argv[0]?.startsWith("-") ? 0 : name.includes(" ") ? 2 : 1;
  for (let index = start; index < argv.length; index++) {
    const arg = argv[index]!;
    const flag = arg.slice(2);
    if (!arg.startsWith("--") || !Object.hasOwn(entry!.flags, flag) || (flags.has(flag) && flag !== "filter")) usage(`Unknown argument, flag, or duplicate flag: ${arg}`);
    if (["help", "full", "all"].includes(flag)) flags.set(flag, "true");
    else {
      const value = argv[++index];
      if (!value || value.startsWith("--")) usage();
      flags.set(flag, value!);
      if (flag === "filter") filters.push(value!);
    }
  }
  if (flags.has("help")) return { command: name, ...entry };
  const quote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;
  const displayArgs = argv.map((arg, index) => name === "home" && argv[index - 1] === "--config" ? "<config>" : arg);
  const fullCommand = `tenable-axi ${displayArgs.map(quote).join(" ")} --full`;
  const defaults = name === "tag list" ? ["id", "category", "value"] : name === "tag properties" ? ["property", "operators"]
    : name === "doctor" ? ["profile", "origin", "readOnly", "status", "checks"]
      : name === "hook" ? ["profile", "origin", "readOnly"] : name === "card show" ? ["id", "name", "score", "ces_scores", "ces_trend", "exposure_classes_details"] : ["id", "name", "score"];
  const available = name === "tag list" ? tagFields : name === "tag properties" ? propertyFields : name === "card show" ? detailFields
    : ["doctor", "hook"].includes(name) ? defaults : cardFields;
  const fields = [...(flags.get("fields")?.split(",") ?? defaults)];
  if (fields.some((field) => !available.includes(field) && !(name === "tag list" && /^[a-zA-Z0-9_]+$/.test(field))) || new Set(fields).size !== fields.length) usage("Unknown or duplicate output field");
  const integer = (flag: string, fallback: number, minimum: number, maximum: number): number => {
    const text = flags.get(flag);
    const value = text === undefined ? fallback : Number(text);
    if (text !== undefined && !/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < minimum || value > maximum) usage(`Invalid --${flag}`);
    return value;
  };
  if (flags.has("all") && flags.has("limit") || flags.has("cursor") && flags.has("offset")) usage("Incompatible paging flags");
  const limit = integer("limit", flags.has("all") ? 10_000 : name === "home" ? 5 : 100, 1, 10_000);
  let offset = integer("offset", 0, 0, Number.MAX_SAFE_INTEGER);
  const query: Record<string, string | number | boolean> = {};
  for (const [flag, wire] of [["global", "is_global_card"], ["include-trend-events", "include_trend_events"]]) {
    const value = flags.get(flag!);
    if (value !== undefined) { if (!["true", "false"].includes(value)) usage(`--${flag} requires true or false`); query[wire!] = value === "true"; }
  }
  if (flags.has("sorting-order")) {
    if (!["asc", "desc"].includes(flags.get("sorting-order")!)) usage("Invalid --sorting-order");
    query.sorting_order = flags.get("sorting-order")!;
  }
  for (const flag of ["trend-start-date", "trend-end-date", "sla-efficiency-start-date", "sla-efficiency-end-date"]) {
    const value = flags.get(flag);
    if (value !== undefined) {
      if (!z.iso.datetime().safeParse(value).success) usage(`--${flag} requires a UTC ISO timestamp`);
      query[flag.replaceAll("-", "_")] = value;
    }
  }
  for (const prefix of ["trend", "sla-efficiency"]) {
    const start = flags.get(`${prefix}-start-date`), end = flags.get(`${prefix}-end-date`);
    if ((start === undefined) !== (end === undefined) || start && end && Date.parse(start) > Date.parse(end)) usage(`Provide an ordered pair of --${prefix}-start-date and --${prefix}-end-date`);
  }
  if (flags.has("sla-breakdown-filter")) {
    const value = flags.get("sla-breakdown-filter")!;
    if (!["ANY", "REMEDIATED", "NON_REMEDIATED"].includes(value)) usage("Invalid --sla-breakdown-filter");
    query.sla_breakdown_filter = value;
  }
  if (name === "card show" && (!flags.get("id") || /[\s/%\\]/.test(flags.get("id")!) || [".", ".."].includes(flags.get("id")!))) usage("--id is required and must be a single card identifier");
  if (flags.has("sort")) {
    if (!/^[a-zA-Z0-9_]+:(asc|desc)$/.test(flags.get("sort")!)) usage("--sort requires property:asc or property:desc");
    query.sort = flags.get("sort")!;
  }
  let body: Record<string, unknown> | undefined;
  if (name === "tag list") {
    body = {};
    if (flags.has("query")) body.query = { mode: "simple", text: flags.get("query") };
    if (flags.has("filter-file") && filters.length) usage("--filter-file and --filter are mutually exclusive");
    let input: unknown = [];
    try {
      if (flags.has("filter-file")) {
        const fd = flags.get("filter-file") === "-" ? 0 : openSync(flags.get("filter-file")!, "r");
        try {
          const bytes = Buffer.alloc(1024 * 1024 + 1);
          let length = 0, count: number;
          while (length < bytes.length && (count = readSync(fd, bytes, length, bytes.length - length, null)) > 0) length += count;
          if (length > 1024 * 1024) usage("Filter input exceeds 1 MiB");
          input = JSON.parse(bytes.subarray(0, length).toString("utf8"));
        } finally { if (fd !== 0) closeSync(fd); }
      } else input = filters.map((text) => {
        const match = text.match(/^(\S+)\s+(.+?)\s+(\[.*\])$/s);
        if (!match) return usage("--filter requires property operator JSON-array-of-strings");
        return { property: match[1], operator: match[2], value: JSON.parse(match[3]!) as unknown };
      });
    } catch (error) {
      if (error instanceof AxiError) throw error;
      usage("Cannot read filters as JSON; use the documented tag filter array");
    }
    const parsed = filterSchema.safeParse(input);
    if (!parsed.success) usage("Invalid tag filter array; run tenable-axi tag properties");
    if (parsed.data!.length) body.filters = parsed.data;
    const extras = flags.get("extra-properties")?.split(",") ?? [];
    if (extras.some((property) => !/^[a-zA-Z0-9_]+$/.test(property))) usage("Invalid --extra-properties");
    for (const extra of extras) {
      const field = extra === "tag_category_name" ? "category" : extra;
      if (!fields.includes(field)) fields.push(field);
    }
    if (fields.includes("category")) extras.push("tag_category_name");
    extras.push(...fields.filter((field) => !tagFields.includes(field)));
    if (extras.length) query.extra_properties = [...new Set(extras)].join(",");
  } else if (flags.has("query")) query.text_query = flags.get("query")!;

  let parsedCursor: z.infer<typeof cursorSchema> | undefined;
  if (flags.has("cursor")) {
    try {
      const text = flags.get("cursor")!;
      if (text.length > cursorMaxLength) usage("Invalid cursor");
      parsedCursor = cursorSchema.parse(JSON.parse(Buffer.from(text, "base64url").toString("utf8")));
      if (parsedCursor.pending && (name !== "card list" && name !== "home" || parsedCursor.pending.length > parsedCursor.offset)) usage("Invalid cursor");
    } catch { usage("Cursor does not match this profile, operation, fields or filters"); }
  }
  const config = flags.get("config"), selected = flags.get("profile");
  const identity = name === "home" ? homeIdentity() : {};
  let profile;
  try { store.readOnly(); profile = store.select(store.load(config, name === "doctor").config, selected); }
  catch (error) {
    if (["home", "hook"].includes(name) && error instanceof AxiError && error.code === "PROFILE_REQUIRED") {
      return { ...(name === "home" ? identity : {}), status: "not configured", help: [SETUP_GUIDANCE] };
    }
    throw error;
  }
  const context = { profile: profile.name, origin: profile.origin, readOnly: store.readOnly() || !profile.writes.allowWrites || !profile.writes.operations.length };
  const select = (record: Record<string, unknown>) => Object.fromEntries(fields.map((field) => [field, record[field] ?? null]));
  if (name === "hook") return select(context);
  const operation = name === "tag list" ? "inventory-tag-search" : "exposure-view-cards-search";
  const scope = createHash("sha256").update(JSON.stringify([profile.origin, profile.name, store.configPath(config), operation, query, body, fields])).digest("hex");
  if (parsedCursor) {
    if (parsedCursor.scope !== scope) usage("Cursor does not match this profile, operation, fields or filters");
    offset = parsedCursor.offset;
  }
  const keys = store.credentials(profile, name === "doctor");
  const transport = factory({ keys, origin: profile.origin });
  if (name === "doctor") {
    const probes: { module: string; operation: string; query?: Record<string, string | number | boolean>; body?: unknown }[] = [
      { module: "assets", operation: "inventory-assets-search", query: { offset: 0, limit: 1 }, body: {} },
      { module: "findings", operation: "inventory-findings-search", query: { offset: 0, limit: 1 }, body: {} },
      { module: "software", operation: "inventory-software-search", query: { offset: 0, limit: 1 }, body: {} },
      { module: "attack-paths", operation: "apa-attack-paths-search", query: { offset: 0, limit: 100, exclude_resolved: true, run_ai_summarization: "false" } },
      { module: "attack-techniques", operation: "apa-attack-techniques-search", query: { offset: 0, limit: 100, exclude_resolved: true } },
      { module: "initiatives", operation: "initiatives-list" },
      { module: "export-jobs", operation: "inventory-export-assets-jobs", query: { limit: 1 } },
      { module: "connector-logs", operation: "connectors-logs" },
    ];
    const checks: Record<string, unknown>[] = [];
    for (const probe of probes) {
      const check = { module: probe.module, operation: probe.operation, privilege: transportBindings[probe.operation]!.permissionHelp };
      try {
        await transport.request(probe.operation, { ...(probe.query ? { query: probe.query } : {}),
          ...("body" in probe ? { body: probe.body } : {}), retry: false });
        checks.push({ ...check, status: "ok" });
      } catch (error) {
        if (!(error instanceof TransportError)) throw error;
        checks.push({ ...check, status: error.error.status === 403 ? "permission-denied" : "error", error: error.error });
      }
    }
    const ok = checks.every((check) => check.status === "ok");
    if (!ok) process.exitCode = 1;
    return select({ ...context, status: ok ? "ok" : "error", checks });
  }
  const truncated: string[] = [];
  function preview(value: unknown, path: string): unknown {
    if (typeof value === "string" && value.length > 1000 && !flags.has("full")) { truncated.push(path); return { text: value.slice(0, 1000), length: value.length }; }
    if (Array.isArray(value)) return value.map((item, index) => preview(item, `${path}.${index}`));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, preview(item, `${path}.${key}`)]));
    return value;
  }
  function project(record: Record<string, unknown>, detail = false) {
    const mapped: Record<string, unknown> = { ...record };
    if (name === "tag list") {
      for (const field of fields.filter((field) => !tagFields.includes(field))) mapped[field] = (record.extra_properties as Record<string, unknown> | undefined)?.[field];
      mapped.value = record.name; mapped.category = (record.extra_properties as Record<string, unknown> | undefined)?.tag_category_name ?? null;
    }
    else mapped.score = detail ? (record.ces_scores as { total?: { score: number } } | undefined)?.total?.score : (record.ces_score as { score: number } | undefined)?.score;
    if (fields.includes("score") && mapped.score === undefined) throw new TransportError({ code: "RESPONSE_INVALID", message: "Card response is missing the selected score", operation: detail ? "exposure-view-card-details" : "exposure-view-cards-search" });
    for (const field of fields) {
      if (mapped[field] != null && fieldTypes[field] && !fieldTypes[field]!.safeParse(mapped[field]).success) {
        throw new TransportError({ code: "RESPONSE_INVALID", message: `Response has an invalid ${field} field`, operation: detail ? "exposure-view-card-details" : operation });
      }
    }
    return preview(store.redactor.payload(select(mapped)), "data") as Record<string, unknown>;
  }
  if (name === "card show") {
    const response = await transport.request("exposure-view-card-details", { pathParams: { card_id: flags.get("id")! }, query });
    const card = project(cardDetails.parse(response.body), true);
    return { card, ...(truncated.length ? { help: [`Run ${fullCommand} to see full text`] } : {}) };
  }
  if (name === "tag properties") {
    const response = properties.parse((await transport.request("inventory-tag-properties-list")).body);
    const rows = response.data.map((record) => preview(store.redactor.payload(select({ ...record, property: record.key })), "properties"));
    return { properties: rows, count: rows.length, complete: true, ...(rows.length ? {} : { message: "0 tag properties available" }), ...(truncated.length ? { help: [`Run ${fullCommand} to see full text`] } : {}) };
  }
  const rows: Record<string, unknown>[] = [];
  const pages = new Set<string>();
  let pending = parsedCursor?.pending ?? [];
  let total = parsedCursor?.total, complete = false, reason = "limit", failure: TransportError | undefined;
  const buffered = pending.map((record) => project(record));
  rows.push(...buffered.slice(0, limit));
  pending = pending.slice(rows.length);
  complete = !pending.length && total !== undefined && offset >= total;
  for (let page = 0; page < 20 && !complete && rows.length < limit; page++) {
    const window = Math.min(name === "tag list" ? 1000 : 25, limit - rows.length);
    try {
      const response = (await transport.request(operation, { query: { ...query, limit: window, offset }, ...(body ? { body } : {}) })).body as { data: unknown[]; pagination?: { total?: number; total_record_count?: number } };
      if (response.data.length > (name === "tag list" ? window : 25)) throw new TransportError({ code: "RESPONSE_INVALID", message: "Tenable returned more rows than the page bound", operation });
      const records = response.data.map((record) => project(name === "tag list" ? tagRecord.parse(record) : cardRecord.parse(record)));
      const pageIdentity = JSON.stringify(response.data.map((record) => (record as { id: string }).id));
      if (records.length && pages.has(pageIdentity)) throw new TransportError({ code: "CONTINUATION_REPEATED", message: "Tenable repeated a result page; resume after checking the collection", operation });
      pages.add(pageIdentity);
      const remainder = response.data.slice(window) as z.infer<typeof cardRecord>[];
      // Redact before encoding: base64 cursors must not bypass output redaction.
      const nextPending = store.redactor.payload(remainder) as z.infer<typeof cardRecord>[];
      const nextTotal = response.pagination?.total_record_count ?? response.pagination?.total ?? total;
      const nextCursor = Buffer.from(JSON.stringify({ scope, offset: offset + records.length, pending: nextPending, total: nextTotal })).toString("base64url");
      if (nextCursor.length > cursorMaxLength) throw new TransportError({ code: "RESPONSE_INVALID", message: "Card continuation exceeds the cursor byte bound", operation });
      pending = nextPending;
      rows.push(...records.slice(0, window));
      offset += records.length;
      total = nextTotal;
      complete = !pending.length && (records.length === 0 || total !== undefined && offset >= total);
      if (complete || rows.length >= limit || name === "home") break;
      reason = "request budget";
    } catch (error) {
      if (!(error instanceof TransportError) || !rows.length) throw error;
      reason = error.error.code;
      if (!["REQUEST_BUDGET_EXCEEDED", "DEADLINE_EXCEEDED", "BYTE_BUDGET_EXCEEDED"].includes(reason)) failure = error;
      break;
    }
  }
  if (failure) process.exitCode = 1;
  const noun = name === "tag list" ? "tags" : "cards";
  const suffix = [config ? `--config ${quote(name === "home" ? "<config>" : config)}` : "", selected ? `--profile ${quote(selected)}` : ""].filter(Boolean).join(" ");
  const resumeArgs = displayArgs.slice(start).filter((arg, index, args) => !["--cursor", "--offset"].includes(arg) && !["--cursor", "--offset"].includes(args[index - 1] ?? ""));
  const cursor = Buffer.from(JSON.stringify({ scope, offset, ...(pending.length ? { pending } : {}), ...(total === undefined ? {} : { total }) })).toString("base64url");
  return { ...(name === "home" ? { ...identity, ...context } : {}), [noun]: rows, count: rows.length, ...(total === undefined ? {} : { total }), complete,
    ...(!rows.length ? { message: `0 ${noun} matched the selected filters` } : {}),
    ...(!complete ? { reason, cursor } : {}),
    ...(failure ? failure.toJSON() : {}),
    help: [`Run tenable-axi ${noun === "cards" ? "card show --id <id>" : "tag properties"} ${suffix}`.trim(), ...(!complete ? [`Run tenable-axi ${noun === "cards" ? "card list" : "tag list"} ${resumeArgs.map(quote).join(" ")} --cursor ${quote(cursor)}`] : []), ...(truncated.length ? [`Run ${fullCommand} to see full text`] : [])] };
}
