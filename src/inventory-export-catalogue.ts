import { z } from "zod";
import type { OperationBinding } from "./transport-core.js";
import type { MutationOperation } from "./writes-core.js";

export const exportState = z.enum(["QUEUED", "PROCESSING", "FINISHED", "ERROR"]);
const id = z.string().uuid();
export const exportFields: Record<string, z.ZodType> = { id, state: exportState, createdAt: z.string().datetime({ offset: true }),
  availableChunks: z.array(z.number().int().nonnegative()), export_type: z.enum(["assets", "findings"]),
  last_refreshed_at: z.string().datetime({ offset: true }) };
const filter = z.strictObject({ property: z.string(), operator: z.enum(["", "=", "!=", "<=", "between", "match", ">=", "<", ">", "contains", "not contains", "exists", "not exists", "older than", "newer than", "within last"]), value: z.array(z.string()) });
export const exportBody = z.strictObject({ filters: z.array(filter).nullable().optional(),
  query: z.strictObject({ mode: z.enum(["simple", "advanced"]), text: z.string() }).optional() }).nullable();
export const exportInput = z.strictObject({ body: exportBody.optional(), query: z.strictObject({
  properties: z.string().regex(/^[a-zA-Z0-9_]+(,[a-zA-Z0-9_]+)*$/).optional(),
  use_readable_name: z.boolean().optional(), max_chunk_file_size: z.number().int().min(5242880).max(104857600).optional(),
  sort: z.string().regex(/^[a-zA-Z0-9_]+:(asc|desc)$/).optional(), file_format: z.enum(["CSV", "JSON"]).optional(), compress: z.boolean().optional(),
}) });
const base = "/api/v1/t1/inventory/export";
const permissionHelp = "Requires Basic [16] or EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.EXPORT";
const validationHelp = "Run tenable-axi export inventory status --help; check the export ID and available chunks";
const commonBinding = { permissionHelp, validationHelp };
export const inventoryExportBindings: Readonly<Record<string, OperationBinding>> = {
  ...Object.fromEntries(["assets", "findings"].flatMap((kind) => [
    [`inventory-export-${kind}`, { ...commonBinding, method: "POST", path: `${base}/${kind}`, effect: "write",
      query: Object.keys(exportInput.shape.query.shape), decoder: z.object({ export_id: id }),
      validationHelp: `Run tenable-axi ${kind === "assets" ? "asset" : "finding"} properties; check the documented export filters and options` } satisfies OperationBinding],
    [`inventory-export-${kind}-jobs`, { ...commonBinding, method: "GET", path: `${base}/${kind}/status`, effect: "read",
      query: ["status", "limit"], decoder: z.object({ exports: z.array(z.record(z.string(), z.unknown())) }) } satisfies OperationBinding],
  ])),
  "inventory-export-status": { ...commonBinding, method: "GET", path: `${base}/{export_id}/status`, effect: "read", query: [], decoder: z.record(z.string(), z.unknown()) },
  "inventory-export-download": { ...commonBinding, method: "GET", path: `${base}/{export_id}/download/{chunk_id}`, effect: "read", query: [], decoder: z.unknown(), responseMode: "file" },
};
export const inventoryExportMutations: Readonly<Record<string, MutationOperation>> = Object.fromEntries(["assets", "findings"].map((kind) => [
  `inventory-export-${kind}`, { input: exportInput,
    prepare: (input: unknown) => ({ target: { kind: `inventory-${kind}-export`, payload: true as const }, request: exportInput.parse(input) }),
    effect: "Create one tenant-side inventory export job with the selected filters, properties, format and compression; no server dry run or idempotency guarantee",
    readBackHelp: [`Run tenable-axi export ${kind === "assets" ? "asset" : "finding"} jobs to reconcile creation; never replay an unknown outcome`],
  },
]));
const common = { config: "Config path; default platform path", profile: "Profile name; default credential precedence", fields: "Comma-separated output fields; default compact view", full: "Full output; default false", help: "Show help" };
type Entry = { description: string; operationId: string; flags: Record<string, string>; defaultFields: string[]; examples: string[] };
export const inventoryExportCatalogue: Record<string, Entry> = {};
for (const kind of ["asset", "finding"]) {
  inventoryExportCatalogue[`export ${kind} start`] = { description: `Preview or create an inventory ${kind} export job`, operationId: `inventory-export-${kind}s`,
    flags: { ...common, "body-file": "Optional strict query/filters JSON file, '-' for stdin; maximum 1 MiB", properties: `Comma-separated names from ${kind} properties; id maps to ${kind}_id`, "use-readable-name": "true|false; API default true",
      "max-chunk-file-size": "5242880-104857600 bytes; API default 20971520", sort: "property:asc|desc", "file-format": "JSON|CSV; API default JSON", compress: "true|false; API default false",
      execute: "Create once; default preview", "dry-run": "Explicit preview; excludes --execute", confirm: "Exact confirmation from preview", "intent-id": "Unique execution intent for replay protection" },
    defaultFields: ["id", "state"], examples: [`tenable-axi export ${kind} start --body-file scope.json`, `tenable-axi export ${kind} start --body-file scope.json --execute --confirm <confirmation>`] };
  inventoryExportCatalogue[`export ${kind} jobs`] = { description: `List recent inventory ${kind} export jobs`, operationId: `inventory-export-${kind}s-jobs`, flags: { ...common, status: "QUEUED|PROCESSING|FINISHED|ERROR", limit: "1-1000; default 100; last three days only" }, defaultFields: ["id", "state", "createdAt"], examples: [`tenable-axi export ${kind} jobs`, `tenable-axi export ${kind} jobs --status FINISHED --limit 10`] };
}
inventoryExportCatalogue["export inventory status"] = { description: "Read one inventory export status without polling", operationId: "inventory-export-status", flags: { ...common, id: "Required export UUID" }, defaultFields: ["id", "state", "availableChunks"], examples: ["tenable-axi export inventory status --id <id>", "tenable-axi export inventory status --id <id> --fields id,state,createdAt"] };
inventoryExportCatalogue["export inventory download"] = { description: "Download one inventory chunk to a new redacted file", operationId: "inventory-export-download", flags: { ...common, id: "Required export UUID", chunk: "Required nonnegative chunk number from status", output: "Required new output file; refuses overwrite" }, defaultFields: ["id", "chunk", "output", "bytes", "format", "compressed"], examples: ["tenable-axi export inventory download --id <id> --chunk 1 --output assets.json", "tenable-axi export inventory download --id <id> --chunk 2 --output assets.csv.gz"] };
