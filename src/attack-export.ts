import { AxiError } from "axi-sdk-js";
import { closeSync, openSync, readSync } from "node:fs";
import { z } from "zod";
import { attackExportCatalogue, attackExportCreated, attackExportInputs, attackExportStatus } from "./attack-export-catalogue.js";
import { exportOutputPath, saveExport } from "./export-file.js";
import type { credentialStore } from "./profiles.js";
import { createTransport, TransportError, type Transport, type TransportOptions } from "./transport.js";
import { createWriteCoordinator, type WriteCoordinatorOptions } from "./writes.js";

export type WriteCoordinatorFactory = (options: WriteCoordinatorOptions) => ReturnType<typeof createWriteCoordinator>;

export async function attackExportCommand(argv: string[], store: ReturnType<typeof credentialStore>,
  transportFactory: (options: TransportOptions) => Transport = createTransport,
  writeFactory: WriteCoordinatorFactory = createWriteCoordinator): Promise<Record<string, unknown>> {
  const name = argv.slice(0, 3).join(" ");
  const entry = attackExportCatalogue[name];
  const usage = (message: string): never => { throw new AxiError(message, "VALIDATION_ERROR", [entry
    ? `Valid flags for ${name}: ${Object.keys(entry.flags).map((flag) => `--${flag}`).join(", ")}`
    : `Valid commands: ${Object.keys(attackExportCatalogue).join(", ")}`]); };
  if (!entry) usage("Unknown attack export command");
  const flags = new Map<string, string>();
  for (let index = 3; index < argv.length; index++) {
    const flag = argv[index]!;
    if (!flag.startsWith("--") || !Object.hasOwn(entry!.flags, flag.slice(2)) || flags.has(flag)) usage(`Unknown argument, flag, or duplicate flag: ${flag}`);
    const value = ["--execute", "--dry-run", "--help", "--full", "--wait"].includes(flag) ? "true" : argv[++index];
    if (!value || value.startsWith("--")) usage(`Missing value for ${flag}`);
    flags.set(flag, value!);
  }
  const get = (flag: string) => flags.get(`--${flag}`);
  if (get("help")) return { command: name, description: entry!.description, flags: entry!.flags,
    defaultFields: entry!.defaultFields, examples: entry!.examples };
  const start = argv[2] === "start", download = argv[2] === "download";
  const available = start ? ["id", "state"] : download ? ["id", "output", "bytes", "format", "compressed"] : ["id", "state", "submittedAt", "lastRefreshedAt"];
  const fields = get("fields")?.split(",") ?? entry!.defaultFields;
  if (new Set(fields).size !== fields.length || fields.some((field) => !available.includes(field))) usage(`Available fields: ${available.join(", ")}`);
  const project = (value: Record<string, unknown>) => Object.fromEntries(fields.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
  let body: unknown;
  if (start) {
    if (get("execute") && get("dry-run")) usage("--execute and --dry-run are mutually exclusive");
    if (get("confirm") && !get("execute")) usage("--confirm requires --execute");
    if (!get("body-file")) usage("--body-file is required with documented file_format and optional filter/columns/name/sort fields");
    let fd: number | undefined;
    try {
      fd = get("body-file") === "-" ? 0 : openSync(get("body-file")!, "r");
      const buffer = Buffer.alloc(1024 * 1024 + 1);
      let size = 0;
      for (;;) {
        const read = readSync(fd, buffer, size, buffer.length - size, null);
        if (!read) break;
        size += read;
        if (size === buffer.length) throw new Error("Input too large");
      }
      body = JSON.parse(buffer.subarray(0, size).toString("utf8"));
    } catch { usage("Cannot read --body-file as JSON within the 1 MiB input limit"); }
    finally { if (fd !== undefined && fd !== 0) closeSync(fd); }
    const parsed = attackExportInputs[entry!.operationId]!.safeParse(body);
    if (!parsed.success) usage("Invalid export body; use the operation's documented fields and lowercase and/or filter operators; security fields are forbidden");
    body = parsed.data;
  } else if (!z.string().uuid().safeParse(get("id")).success) usage("--id must be an attack export UUID");
  let output: string | undefined;
  if (download) {
    if (!get("output")) usage("--output is required and must name a new file");
    try { output = exportOutputPath(get("output")!, entry!.operationId); } catch { usage("--output must name a new file; overwrite is refused"); }
  }
  const operation = entry!.operationId;
  if (start) {
    const result = await writeFactory({ config: get("config"), profile: get("profile") }).run(operation, body,
      { execute: !!get("execute"), dryRun: !!get("dry-run"), confirm: get("confirm") });
    if (result.kind !== "success") {
      let truncated = false;
      const previewText = (value: unknown): unknown => {
        if (typeof value === "string" && value.length > 1000 && !get("full")) {
          truncated = true;
          return `${value.slice(0, 1000)}... (truncated, ${value.length} chars total)`;
        }
        if (Array.isArray(value)) return value.map(previewText);
        if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, previewText(child)]));
        return value;
      };
      const preview = previewText(result.preview);
      return { kind: result.kind, preview, ...(truncated ? { help: [`Run tenable-axi ${name} --body-file ${JSON.stringify(get("body-file"))} --full${get("config") ? ` --config ${JSON.stringify(get("config"))}` : ""}${get("profile") ? ` --profile ${get("profile")}` : ""} to see full preview text`] } : {}) };
    }
    const created = attackExportCreated.parse(result.response);
    return { job: project({ id: created.export_id, state: "SUBMITTED" }), auditId: result.auditId,
      help: [`tenable-axi export attack status --id ${created.export_id}${get("config") ? ` --config ${JSON.stringify(get("config"))}` : ""}${get("profile") ? ` --profile ${get("profile")}` : ""}`] };
  }
  store.readOnly();
  const profile = store.select(store.load(get("config")).config, get("profile"));
  const transport = transportFactory({ origin: profile.origin, keys: store.credentials(profile) });
  const request = { pathParams: { export_id: get("id")! } };
  if (download) {
    const response = await transport.request(operation, request).catch((error: unknown) => {
      if (error instanceof TransportError && error.error.code === "EXPORT_NOT_READY") {
        throw new TransportError({ code: "JOB_NOT_READY", message: "Attack export is not ready for download", operation }, ["Run tenable-axi export attack status --id <id>"]);
      }
      throw error;
    });
    try { return { file: project({ id: get("id"), ...saveExport(response.body, output!, store.redactor, operation) }) }; }
    catch { throw new TransportError({ code: "EXPORT_FILE_INVALID", message: "Export could not be validated, redacted or saved within 128 MiB to a new file", operation }); }
  }
  const deadline = Date.now() + 19_000;
  let status: z.infer<typeof attackExportStatus> | undefined;
  for (;;) {
    let response;
    try { response = await transport.request(operation, request); }
    catch (error) {
      if (get("wait") && status && error instanceof TransportError && error.error.code === "REQUEST_BUDGET_EXCEEDED") break;
      throw error;
    }
    status = attackExportStatus.parse(response.body);
    if (status.export_id !== get("id")) throw new TransportError({ code: "RESPONSE_INVALID", message: "Status belongs to a different attack export", operation });
    const pending = ["QUEUED", "PROCESSING"].includes(status.status);
    if (!get("wait") || !pending || Date.now() + 1000 >= deadline) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }
  return {
    job: project({ id: status.export_id, state: status.status, submittedAt: status.submitted_at, lastRefreshedAt: status.last_refreshed_at }),
    ...(get("wait") && ["QUEUED", "PROCESSING"].includes(status.status) ? { complete: false, reason: "POLL_BUDGET_EXCEEDED" } : {}),
  };
}
