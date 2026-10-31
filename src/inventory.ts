import { AxiError } from "axi-sdk-js";
import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";
import { z } from "zod";
import { aliases, assetClasses, extraFields, filterExamples, filterSchema, findingCountValues, inventoryCatalogue, inventoryKinds, inventoryPage, propertyFields, sortAliases, sortableFields, wireFields, type InventoryKind } from "./inventory-catalogue.js";
import { credentialStore } from "./profiles.js";
import { createTransport, TransportError, type Transport, type TransportOptions } from "./transport.js";

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const cursorSchema = z.strictObject({ version: z.literal(1), scope: z.string(), offset: integer,
  skip: integer, pageLimit: integer.min(1).max(1000), total: integer.nullable() });

// Bound input before parsing, including stdin, without reading a whole oversized file.
function filterFile(path: string): unknown {
  const fd = path === "-" ? 0 : openSync(path, "r");
  try {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for (;;) {
      const chunk = Buffer.alloc(8192);
      const size = readSync(fd, chunk, 0, chunk.length, null);
      if (!size) break;
      bytes += size;
      if (bytes > 1024 * 1024) throw new Error("Input too large");
      chunks.push(chunk.subarray(0, size));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { if (path !== "-") closeSync(fd); }
}

export async function inventoryCommand(argv: string[], store: ReturnType<typeof credentialStore>,
  transportFactory: (options: TransportOptions) => Transport = createTransport): Promise<Record<string, unknown>> {
  const name = argv.slice(0, 2).join(" ");
  const entry = inventoryCatalogue[name];
  const usage = (message: string): never => { throw new AxiError(message, "VALIDATION_ERROR", [
    entry ? `Valid flags for ${name}: ${Object.keys(entry.flags).map((flag) => `--${flag}`).join(", ")}`
      : "Valid commands: asset list/show/properties/investigate, finding list/show/properties/summary, software list/properties",
  ]); };
  if (!entry) usage("Unknown inventory command");
  const verb = argv[1]!;
  const kind = (verb === "investigate" ? "finding" : argv[0]) as InventoryKind;
  const flags = new Map<string, string[]>();
  for (let index = 2; index < argv.length; index++) {
    const flag = argv[index]!;
    if (!flag.startsWith("--") || !Object.hasOwn(entry!.flags, flag.slice(2)) || (flags.has(flag) && flag !== "--filter")) {
      usage(`Unknown argument, flag, or duplicate flag: ${flag}`);
    }
    const value = ["--help", "--full", "--all"].includes(flag) ? "true" : argv[++index];
    if (value === undefined || value.startsWith("--") || !value.length) usage(`Missing value for ${flag}`);
    flags.set(flag, [...(flags.get(flag) ?? []), value!]);
  }
  const get = (flag: string) => flags.get(`--${flag}`)?.[0];
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  const command = (exclude: string[] = []) => ["tenable-axi", name, ...[...flags].flatMap(([flag, values]) =>
    exclude.includes(flag) ? [] : values.flatMap((value) => [flag, ...(["--all", "--full", "--help"].includes(flag) ? [] : [quote(value)])]))].join(" ");
  if (get("help")) return { command: name, description: entry!.description, flags: entry!.flags,
    defaultFields: entry!.defaultFields, examples: entry!.examples };
  if (verb === "investigate" && !get("query")) usage("--query is required to select an asset");
  if (get("all") && get("limit")) usage("--all and --limit are mutually exclusive");
  if (get("cursor") && get("offset")) usage("--cursor and --offset are mutually exclusive");
  if (get("filter-file") && get("filter")) usage("--filter-file and --filter are mutually exclusive");
  const number = (flag: string, fallback: number, min: number, max: number) => {
    const raw = get(flag);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) usage(`--${flag} must be an integer from ${min} to ${max}`);
    return value;
  };
  const rowLimit = get("all") ? 10000 : number("limit", 100, 1, 10000);
  let offset = number("offset", 0, 0, Number.MAX_SAFE_INTEGER);
  const names = (raw: string) => {
    const values = raw.split(",");
    if (values.some((value) => !/^[A-Za-z0-9_]+$/.test(value)) || new Set(values).size !== values.length) usage("Properties must be unique comma-separated names");
    return values;
  };
  const fields = get("fields") ? names(get("fields")!) : entry!.defaultFields;
  if (verb === "properties" && fields.some((field) => !Object.hasOwn(propertyFields, field))) usage("Unknown properties output field");
  if (kind === "software" && fields.includes("id")) usage("The pinned software API exposes no stable ID; use name,version,publisher");
  const extras = new Set(get("extra-properties") ? names(get("extra-properties")!) : []);
  if (verb !== "properties") for (const field of fields) {
    const wire = aliases[kind][field] ?? field;
    if (!Object.hasOwn(wireFields[kind], wire)) extras.add(wire);
  }
  // Project requested extras even without a matching --fields entry, instead of fetching then silently dropping them.
  const projection: [string, string][] = fields.map((field) => [field, verb === "properties" ? field : aliases[kind][field] ?? field]);
  if (verb !== "properties") for (const extra of extras) {
    if (!fields.includes(extra) && !projection.some(([, wire]) => wire === extra)) projection.push([extra, extra]);
  }
  let sort = get("sort");
  if (sort !== undefined && !/^[A-Za-z0-9_]+:(asc|desc)$/.test(sort)) usage("--sort must be property:asc or property:desc");
  if (sort !== undefined) {
    const [field, direction] = sort.split(":");
    const wire = sortAliases[kind][field!] ?? field!;
    if (!sortableFields[kind].includes(wire)) usage(`Sortable properties: ${[...Object.keys(sortAliases[kind]), ...sortableFields[kind]].join(", ")}`);
    sort = `${wire}:${direction}`;
  }
  const classes = get("asset-classes") ? names(get("asset-classes")!) : get("class") ? [get("class")!] : [];
  if (classes.some((value) => !(assetClasses as readonly string[]).includes(value))) usage(`Asset classes: ${assetClasses.join(", ")}`);
  const filters: z.infer<typeof filterSchema>[] = [];
  const invalidFilterFile = () => usage("Filters must be a flat array of {property, operator, value: string[]}; nested boolean expressions are unsupported; use a documented operator");
  const invalidFilter = () => usage(`--filter must be '<property> <operator> <JSON string array>' with a documented operator, e.g. --filter '${filterExamples[kind]}'; run tenable-axi ${kind} properties to discover properties and operators, or use --filter-file for a JSON array of {property, operator, value: string[]}`);
  if (get("filter-file")) {
    let value: unknown;
    try { value = filterFile(get("filter-file")!); } catch { usage("Cannot read --filter-file as JSON within the 1 MiB input limit"); }
    const parsed = z.array(filterSchema).safeParse(value);
    if (!parsed.success) invalidFilterFile();
    filters.push(...parsed.data!);
  }
  for (const text of flags.get("--filter") ?? []) {
    const match = /^(\S+)\s+(.+?)\s+(\[.*\])$/s.exec(text);
    if (!match) invalidFilter();
    let value: unknown;
    try { value = JSON.parse(match![3]!); } catch { invalidFilter(); }
    const parsed = filterSchema.safeParse({ property: match![1], operator: match![2], value });
    if (!parsed.success) invalidFilter();
    filters.push(parsed.data!);
  }
  if (get("class")) filters.push({ property: "asset_class", operator: "=", value: classes });
  if (verb === "show") {
    if (!get("id") || !/^[A-Za-z0-9_-]+$/.test(get("id")!)) usage("--id is required and must be an exact inventory identifier");
    filters.push({ property: kind === "asset" ? "asset_id" : "finding_id", operator: "=", value: [get("id")!] });
  }
  const body = { ...(get("query") === undefined ? {} : { query: { mode: "simple", text: get("query")! } }),
    ...(filters.length ? { filters } : {}) };
  const query: Record<string, string | number | readonly string[]> = { ...(sort ? { sort } : {}),
    ...(extras.size ? { extra_properties: [...extras].sort().join(",") } : {}),
    ...(get("asset-classes") ? { asset_classes: classes } : {}) };
  const operation = entry!.operationId;
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (get("cursor")) {
    try {
      if (get("cursor")!.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(get("cursor")!)) throw new Error();
      cursor = cursorSchema.parse(JSON.parse(Buffer.from(get("cursor")!, "base64url").toString("utf8")));
    } catch { usage("Invalid resume cursor; use the cursor exactly as returned with its original filters"); }
  }
  store.readOnly();
  const loaded = store.load(get("config"));
  const profile = store.select(loaded.config, get("profile"));
  const scope = createHash("sha256").update(JSON.stringify([profile.origin, profile.name, profile.accessKey, profile.secretKey,
    loaded.path, operation, body, query, projection])).digest("hex");
  if (cursor && cursor.scope !== scope) usage("Cursor belongs to a different profile, operation, filters, sort, or fields");
  const transport = transportFactory({ origin: profile.origin, keys: store.credentials(profile) });
  if (verb === "investigate") {
    const selectors = ["config", "profile", "full"].flatMap((flag) => get(flag) === undefined ? []
      : flag === "full" ? ["--full"] : [`--${flag}`, get(flag)!]);
    const lookup = await inventoryCommand(["asset", "list", ...selectors, "--query", get("query")!, "--limit", "2"], store, () => transport);
    const assets = lookup.assets as Record<string, unknown>[];
    if (assets.length > 1) return { lookup, complete: false,
      error: { code: "ASSET_AMBIGUOUS", message: "Multiple assets matched; select an exact asset ID from the candidates" },
      help: [`Run tenable-axi finding list --filter 'asset_id = ["<asset-id>"]' ${selectors.map(quote).join(" ")}`.trim()] };
    if (!lookup.complete) return { lookup, complete: false, reason: lookup.reason,
      ...(lookup.error ? { error: lookup.error } : {}) };
    if (!assets.length) return { lookup, complete: false,
      error: { code: "NOT_FOUND", message: "No asset matched the selected query" } };
    const asset = assets[0]!;
    if (typeof asset.id !== "string" || !asset.id.length) throw new TransportError({ code: "RESPONSE_INVALID",
      message: "Asset lookup is missing the pivot identifier", operation: "inventory-assets-search" });
    const findingFlags = ["fields", "extra-properties", "limit", "all"].flatMap((flag) => get(flag) === undefined ? []
      : flag === "all" ? ["--all"] : [`--${flag}`, get(flag)!]);
    try {
      const findings = await inventoryCommand(["finding", "list", ...selectors, ...findingFlags,
        "--filter", `asset_id = ${JSON.stringify([asset.id])}`], store, () => transport);
      return { asset, lookup, ...findings };
    } catch (error) {
      if (!(error instanceof TransportError)) throw error;
      return { asset, lookup, findings: [], count: 0, total: null, complete: false, reason: "READ_FAILED", ...error.toJSON() };
    }
  }
  if (verb === "summary") {
    const counts: Record<string, { value: string; total: number }[]> = { severity: [], sensor_type: [] };
    try {
      for (const [property, values] of Object.entries(findingCountValues)) for (const value of values) {
        const response = await transport.request(operation, { query: { offset: 0, limit: 1 }, retry: false,
          body: { filters: [{ property, operator: "=", value: [value] }] } });
        const page = inventoryPage.parse(response.body);
        if (page.pagination?.total === undefined) throw new TransportError({ code: "RESPONSE_INVALID", message: "Finding count response is missing pagination.total", operation });
        counts[property]!.push({ value, total: page.pagination.total });
      }
    } catch (error) {
      if (!(error instanceof TransportError)) throw error;
      return { ...counts, complete: false, ...error.toJSON() };
    }
    return { ...counts, complete: true };
  }
  offset = cursor?.offset ?? offset;
  let skip = cursor?.skip ?? 0;
  let total: number | null = cursor?.total ?? null;
  let pageLimit = cursor?.pageLimit ?? Math.min(1000, verb === "show" ? 2 : rowLimit);
  const rows: Record<string, unknown>[] = [];
  let complete = false;
  let reason: string | undefined;
  let failure: TransportError | undefined;
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
  const invalid = (message: string): never => { throw new TransportError({ code: "RESPONSE_INVALID", message, operation }); };
  const project = (row: Record<string, unknown>) => {
    const extra = z.record(z.string(), z.unknown()).safeParse(row.extra_properties);
    return Object.fromEntries(projection.map(([field, wire]) => {
      const native = verb === "properties" || Object.hasOwn(wireFields[kind], wire);
      if (!native && row.extra_properties !== undefined && !extra.success) invalid("Malformed extra_properties container");
      const value = native ? row[wire] : extra.success ? extra.data[wire] : undefined;
      const schema = verb === "properties" ? propertyFields[field]! : wireFields[kind][wire] ?? extraFields[kind][wire] ??
        (field === "version" || field === "description" ? z.string() : z.json());
      if (value === undefined) return [field, null];
      if (!schema.safeParse(value).success) invalid(`Malformed selected property: ${field}`);
      return [field, preview(store.redactor.payload(value))];
    }));
  };
  const seen = new Set<number>();
  try {
    while (rows.length < (verb === "show" ? 2 : rowLimit)) {
      if (seen.has(offset)) invalid("The server repeated a page");
      seen.add(offset);
      const response = await transport.request(operation, { query: verb === "properties" ? query : { ...query, offset, limit: pageLimit },
        ...(verb === "properties" ? {} : { body }) });
      let data: Record<string, unknown>[];
      let exhausted: boolean;
      if (verb === "properties") {
        data = (response.body as { data: Record<string, unknown>[] }).data;
        exhausted = true;
      } else {
        const page = inventoryPage.parse(response.body);
        data = page.data;
        if (page.pagination) {
          if (page.pagination.offset !== offset) invalid("The server returned a different or repeated offset");
          total = page.pagination.total ?? total;
        }
        exhausted = total !== null ? offset + data.length >= total : data.length < pageLimit;
        if (!data.length && total !== null && offset < total) invalid("The server returned an empty page before the reported total");
      }
      if (skip > data.length) invalid("The resumed page no longer contains the saved position");
      const take = Math.min(data.length - skip, (verb === "show" ? 2 : rowLimit) - rows.length);
      for (const row of data.slice(skip, skip + take)) {
        if (verb === "show" && row.id !== get("id")) invalid("Exact ID search returned a different resource");
        rows.push(project(row));
        skip++;
      }
      if (skip < data.length) break;
      if (exhausted) { complete = true; break; }
      offset += data.length;
      if (!Number.isSafeInteger(offset)) invalid("The server returned an unrepresentable offset");
      skip = 0;
      pageLimit = Math.min(1000, rowLimit - rows.length || rowLimit);
    }
  } catch (error) {
    if (!(error instanceof TransportError)) throw error;
    if (["REQUEST_BUDGET_EXCEEDED", "BYTE_BUDGET_EXCEEDED", "DEADLINE_EXCEEDED"].includes(error.error.code)) reason = error.error.code;
    else {
      if (!rows.length) throw error;
      failure = error;
    }
  }
  if (verb === "show") {
    if (failure) throw failure;
    if (!complete || reason) throw new TransportError({ code: reason ?? "RESPONSE_INVALID", message: "Exact ID search did not complete uniquely", operation });
    if (!rows.length) throw new TransportError({ code: "NOT_FOUND", message: `No ${kind} matched the exact ID`, operation });
    if (rows.length !== 1) invalid("Exact ID search returned multiple resources");
    return { [kind]: rows[0], ...(truncated ? { help: [`Run ${command(["--full"])} --full to read complete text`] } : {}) };
  }
  const help: string[] = [];
  const selectors = [get("config") ? `--config ${quote(get("config")!)}` : "", get("profile") ? `--profile ${quote(get("profile")!)}` : ""].filter(Boolean).join(" ");
  if (verb === "list") help.push(`Run tenable-axi ${kind} properties ${selectors}`.trim());
  if (verb === "list" && kind !== "software") help.push(`Run tenable-axi ${kind} show --id <id> ${selectors}`.trim());
  if (kind === "software" && verb === "list") help.push("The pinned API exposes no stable software ID");
  if (truncated) help.push(`Run ${command(["--full"])} --full to read complete text`);
  if (!complete) help.push(`Run ${command(["--cursor", "--offset"])} --cursor <cursor> to resume; offset paging does not provide snapshot isolation`);
  return { [verb === "properties" ? "properties" : inventoryKinds[kind]]: rows, count: rows.length, total, complete,
    ...(!rows.length && complete ? { message: `0 ${verb === "properties" ? `${kind} properties` : inventoryKinds[kind]} matched the selected filters` } : {}),
    ...(!complete ? { reason: reason ?? (failure ? "READ_FAILED" : get("all") ? "ROW_BUDGET_EXCEEDED" : "LIMIT"),
      cursor: Buffer.from(JSON.stringify({ version: 1, scope, offset, skip, pageLimit, total })).toString("base64url") } : {}),
    ...(failure ? failure.toJSON() : {}), ...(help.length ? { help: [...help, ...(failure?.help ?? [])] } : {}) };
}
