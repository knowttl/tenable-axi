import { AxiError } from "axi-sdk-js";
import { closeSync, openSync, readSync } from "node:fs";
import { z } from "zod";
import { exportFields, exportInput, exportState, inventoryExportCatalogue } from "./inventory-export-catalogue.js";
import { exportOutputPath, saveExport } from "./export-file.js";
import { exportStatus } from "./export-wait.js";
import type { credentialStore } from "./profiles.js";
import { createTransport, TransportError } from "./transport.js";
import type { TransportFactory } from "./exposure.js";
import { createWriteCoordinator, type WriteCoordinatorOptions } from "./writes.js";

export type WriteCoordinatorFactory = (options: WriteCoordinatorOptions) => ReturnType<typeof createWriteCoordinator>;

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

export async function inventoryExportCommand(argv: string[], store: ReturnType<typeof credentialStore>,
  factory: TransportFactory = createTransport, writeFactory: WriteCoordinatorFactory = createWriteCoordinator): Promise<Record<string, unknown>> {
  const name = argv.slice(0, 3).join(" ");
  const entry = inventoryExportCatalogue[name];
  const usage = (message: string): never => { throw new AxiError(message, "VALIDATION_ERROR", [entry
    ? `Valid flags for ${name}: ${Object.keys(entry.flags).map((flag) => `--${flag}`).join(", ")}`
    : `Valid commands: ${Object.keys(inventoryExportCatalogue).join(", ")}`]); };
  if (!entry) usage("Unknown inventory export command");
  const flags = new Map<string, string>();
  for (let index = 3; index < argv.length; index++) {
    const flag = argv[index]!;
    if (!flag.startsWith("--") || !Object.hasOwn(entry!.flags, flag.slice(2)) || flags.has(flag)) usage(`Unknown argument, flag, or duplicate flag: ${flag}`);
    const value = ["--help", "--full", "--execute", "--dry-run", "--wait"].includes(flag) ? "true" : argv[++index];
    if (!value || value.startsWith("--")) usage(`Missing value for ${flag}`);
    flags.set(flag, value!);
  }
  const get = (key: string) => flags.get(`--${key}`);
  const selectors = (profile: string) => `${get("config") ? ` --config ${JSON.stringify(get("config"))}` : ""} --profile ${profile}`;
  if (get("help")) return { command: name, ...entry };
  const verb = argv[2];
  const operation = entry!.operationId;
  const fields = get("fields")?.split(",") ?? entry!.defaultFields;
  const allowed = verb === "start" ? ["id", "state"] : verb === "jobs" ? ["id", "state", "createdAt", "export_type", "last_refreshed_at"]
    : verb === "status" ? ["id", "state", "availableChunks", "createdAt", "last_refreshed_at"] : entry!.defaultFields;
  if (fields.some((field) => !allowed.includes(field)) || new Set(fields).size !== fields.length) usage(`Output fields: ${allowed.join(",")}`);
  const project = (row: Record<string, unknown>) => Object.fromEntries(fields.map((field) => {
    if (row[field] === undefined || (exportFields[field] && !exportFields[field]!.safeParse(row[field]).success)) {
      throw new TransportError({ code: "RESPONSE_INVALID", message: `Missing or malformed selected field: ${field}`, operation });
    }
    return [field, row[field]];
  }));
  const decodeStatus = (body: unknown, id: string) => {
    const parsed = z.object({ export_id: z.literal(id), status: exportState }).safeParse(body);
    if (!parsed.success) throw new TransportError({ code: "RESPONSE_INVALID", message: "Malformed or mismatched inventory export status", operation: "inventory-export-status" });
    const value = body as Record<string, unknown>;
    const row = { ...value, id, state: parsed.data.status, createdAt: value.submitted_at, availableChunks: value.chunks_available };
    project(row);
    return row;
  };
  if (get("execute") && get("dry-run")) usage("--execute and --dry-run are mutually exclusive");
  if (verb === "start") {
    let body: unknown;
    if (get("body-file")) {
      try { body = bodyFile(get("body-file")!); } catch { usage("Cannot read --body-file as JSON within the 1 MiB limit"); }
    }
    const query = Object.fromEntries(["properties", "use-readable-name", "max-chunk-file-size", "sort", "file-format", "compress"].flatMap((key) => {
      const raw = get(key);
      if (raw === undefined) return [];
      let value: string | number | boolean = raw;
      if (["use-readable-name", "compress"].includes(key)) {
        if (!["true", "false"].includes(raw)) usage(`--${key} must be true or false`);
        value = raw === "true";
      }
      if (key === "max-chunk-file-size") { if (!/^\d+$/.test(raw)) usage("Invalid chunk size"); value = Number(raw); }
      if (key === "properties") value = raw.split(",").map((property) => property === "id" ? `${argv[1]}_id` : property).join(",");
      return [[key.replaceAll("-", "_"), value]];
    }));
    const input = exportInput.safeParse({ ...(body === undefined ? {} : { body }), query });
    if (!input.success) usage("Invalid export scope/options; body accepts only documented query and flat property filters");
    const coordinator = writeFactory({ config: get("config"), profile: get("profile") });
    const result = await coordinator.run(operation, input.data,
      { execute: get("execute") === "true", dryRun: get("dry-run") === "true", confirm: get("confirm"), intentId: get("intent-id") });
    if (result.kind !== "success") {
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
      const output = preview(result) as Record<string, unknown>;
      return { ...output, ...(truncated ? { help: ["Repeat the same export command with --full to read the complete preview"] } : {}) };
    }
    const parsed = z.object({ export_id: z.string().uuid() }).parse(result.response);
    if (get("wait")) {
      const status = await exportStatus(coordinator.reader, "inventory-export-status", parsed.export_id,
        (body) => decodeStatus(body, parsed.export_id), true, { id: parsed.export_id, state: "QUEUED" });
      return { ...status, job: project(status.job), auditId: result.auditId,
        help: [`Run tenable-axi export inventory status --id ${parsed.export_id}${selectors(result.preview.profile)}`] };
    }
    return { job: project({ id: parsed.export_id, state: "QUEUED" }), auditId: result.auditId,
      help: [`Run tenable-axi export inventory status --id ${parsed.export_id}${selectors(result.preview.profile)}`] };
  }
  let output: string | undefined;
  if (["status", "download"].includes(verb!)) {
    if (!z.string().uuid().safeParse(get("id")).success) usage("--id requires the exact export UUID");
    if (verb === "download") {
      if (!get("chunk") || !/^\d+$/.test(get("chunk")!) || !Number.isSafeInteger(Number(get("chunk")))) usage("--chunk requires a nonnegative chunk number");
      if (!get("output")) usage("--output requires a new file path");
      output = exportOutputPath(get("output")!, operation);
    }
  }
  const limit = Number(get("limit") ?? 100);
  if (get("limit") && (!/^\d+$/.test(get("limit")!) || limit < 1 || limit > 1000)) usage("--limit must be 1-1000");
  if (get("status") && !exportState.safeParse(get("status")).success) usage("--status must be QUEUED, PROCESSING, FINISHED or ERROR");
  store.readOnly();
  const profile = store.select(store.load(get("config")).config, get("profile"));
  const transport = factory({ keys: store.credentials(profile), origin: profile.origin });
  if (verb === "status") {
    const status = await exportStatus(transport, operation, get("id")!, (body) => decodeStatus(body, get("id")!), !!get("wait"));
    return { ...status, job: project(status.job) };
  }
  const response = await transport.request(operation, verb === "jobs" ? { query: { limit, ...(get("status") ? { status: get("status")! } : {}) } }
    : { pathParams: { export_id: get("id")!, ...(verb === "download" ? { chunk_id: get("chunk")! } : {}) } });
  if (verb === "download") return { file: project({ id: get("id"), chunk: Number(get("chunk")), ...saveExport(response.body, output!, store.redactor, operation) }) };
  const decode = (row: unknown) => {
    const parsed = z.record(z.string(), z.unknown()).safeParse(row);
    if (!parsed.success) throw new TransportError({ code: "RESPONSE_INVALID", message: "Malformed inventory export job", operation });
    const value = parsed.data;
    return project({ ...value, id: value.export_id, state: value.status, createdAt: value.submitted_at, availableChunks: value.chunks_available });
  };
  const rows = (response.body as { exports: unknown[] }).exports;
  if (rows.length > limit) throw new TransportError({ code: "RESPONSE_INVALID", message: "Job list exceeded the requested limit", operation });
  return { jobs: rows.map(decode), count: rows.length, total: null, complete: false,
    reason: "SERVER_HISTORY_LIMIT", ...(!rows.length ? { message: "0 export jobs matched the selected filters in the last three days" } : {}),
    help: ["Only jobs submitted in the last three days are available; the API has no continuation",
      `Run tenable-axi export inventory status --id <id>${selectors(profile.name)}`] };
}
