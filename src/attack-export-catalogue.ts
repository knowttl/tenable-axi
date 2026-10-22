import { z } from "zod";
import { attackProperties, techniqueProperties } from "./attack-catalogue.js";
import type { OperationBinding } from "./transport-core.js";
import type { MutationOperation } from "./writes-core.js";

function filters(technique: boolean) {
  const single = z.strictObject({ property: z.enum(technique ? techniqueProperties : attackProperties).optional(),
    operator: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "contains", "not_contains", "in", "not_in"]).optional(),
    value: z.union([z.string(), z.array(z.string()), z.number().int(), z.array(z.number().int()), z.boolean()]).optional() });
  const operator = technique ? z.enum(["and", "or"]) : z.enum(["and", "or"]).default("and");
  const nested = z.strictObject({ operator: technique ? operator.optional() : operator, value: z.array(single) });
  return z.union([single, z.strictObject({ operator, value: z.array(z.union([single, nested])) })]);
}
const common = { file_format: z.enum(["CSV", "JSON"]), file_name: z.string().max(100).optional() };
const sort = z.strictObject({ property: z.string(), direction: z.enum(["asc", "desc"]) }).optional();
export const attackExportInputs: Record<string, z.ZodType> = {
  "apa-export-attack-path": z.strictObject({ ...common, filters: filters(false).optional(), vector_ids: z.array(z.string()).optional(),
    columns: z.array(z.enum(["path_name", "priority", "source_nes", "target_acr", "sequence_chain", "enabler_list", "asset_ids"])).optional(), sort }),
  "apa-export-attack-technique": z.strictObject({ ...common, filters: filters(true).optional(), attack_technique_ids: z.array(z.string()).optional(),
    columns: z.array(z.enum(["mitre_id", "technique_name", "priority", "status", "state", "through", "source_names", "source_classes", "source_ids", "target_names", "target_classes", "target_ids", "tactics", "data_sources", "top_attack_path_count", "critical_assets_count"])).optional(), sort }),
  "apa-export-mitre-heatmap": z.strictObject({ ...common,
    filter: z.strictObject({ matrix: z.enum(["enterprise", "ics"]).optional(), platform: z.string().optional(), query: z.string().optional(),
      show_all_techniques: z.boolean().optional(), severities: z.array(z.enum(["info", "low", "medium", "high", "critical"])).optional() }).optional(),
    columns: z.array(z.enum(["technique_id", "tactic", "technique_name", "max_priority", "critical_assets_count", "top_attack_technique_count", "top_attack_path_count", "link"])).optional() }),
};
export const attackExportCreated = z.object({ export_id: z.string().uuid() });
export const attackExportStatus = z.object({ export_id: z.string().uuid(), status: z.enum(["QUEUED", "PROCESSING", "FINISHED", "ERROR", "CANCELLED"]),
  submitted_at: z.string().optional(), last_refreshed_at: z.string().optional() });
const permissionHelp = "Attack exports require EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE; check the selected user's access and export entitlement";
const validationHelp = "Run tenable-axi export attack-path start --help; use the documented operation-specific JSON body";
export const attackExportBindings: Readonly<Record<string, OperationBinding>> = Object.freeze({
  ...Object.fromEntries(Object.keys(attackExportInputs).map((operation) => [operation, { method: "POST", path: `/api/v1/export/${operation.slice(11)}`,
    effect: "write", query: [], decoder: attackExportCreated, permissionHelp, validationHelp } satisfies OperationBinding])),
  "apa-export-status": { method: "GET", path: "/api/v1/export/{export_id}/status", effect: "read", query: [],
    decoder: attackExportStatus, permissionHelp, validationHelp: "Run tenable-axi export attack status --id <id>" },
  "apa-export-download": { method: "GET", path: "/api/v1/export/{export_id}/download", effect: "read", query: [],
    responseMode: "file", decoder: z.instanceof(Buffer), permissionHelp, validationHelp: "Run tenable-axi export attack download --id <id> --output <new-file>" },
});
export const attackExportMutations: Readonly<Record<string, MutationOperation>> = Object.freeze(Object.fromEntries(
  Object.entries(attackExportInputs).map(([operation, input]) => [operation, { input,
    prepare: (body) => ({ target: { kind: "attack-export", payload: true }, request: { body } }),
    effect: "Create one tenant-side attack export job for the previewed filter and format scope; no server-side dry run or idempotency guarantee",
    readBackHelp: ["Inspect export attack status --id <known-export-id> before any new start; an interrupted create may have succeeded without returning its ID"],
  } satisfies MutationOperation])));

const global = { config: "Config path; default credential precedence", profile: "Profile name; default credential precedence",
  fields: "Comma-separated metadata fields; default compact view", full: "Full metadata text; default false", help: "Show help" };
const write = { "body-file": "Required strict operation-specific JSON file, at most 1 MiB; '-' reads stdin",
  execute: "Create the previewed job once; default false", "dry-run": "Preview only; excludes --execute",
  confirm: "Exact confirmation string from preview; required with --execute" };
export const attackExportCatalogue: Record<string, { description: string; operationId: string; flags: Record<string, string>;
  defaultFields: string[]; examples: string[]; evidence: string }> = {
  ...Object.fromEntries(["attack-path", "attack-technique", "mitre-heatmap"].map((kind) => [`export ${kind} start`, {
    description: `Preview or start one ${kind} export; requires configured write scope and ATTACK_PATH.WRITE`, operationId: `apa-export-${kind}`,
    flags: { ...global, ...write }, defaultFields: ["id", "state"],
    examples: [`tenable-axi export ${kind} start --body-file export.json`, `tenable-axi export ${kind} start --body-file export.json --execute --confirm '<preview-confirmation>'`], evidence: "specs/exposure-management.json",
  }])),
  "export attack status": { description: "Read an attack export job; no polling by default", operationId: "apa-export-status",
    flags: { ...global, id: "Required attack export UUID", wait: "Poll once per second within 20-second/20-request budgets; default false" }, defaultFields: ["id", "state"],
    examples: ["tenable-axi export attack status --id <id>", "tenable-axi export attack status --id <id> --wait"], evidence: "specs/exposure-management.json" },
  "export attack download": { description: "Download an attack export to a new file, redacting JSON/CSV within 128 MiB", operationId: "apa-export-download",
    flags: { ...global, id: "Required attack export UUID", output: "Required new output file; overwrite refused" }, defaultFields: ["id", "output", "bytes", "format"],
    examples: ["tenable-axi export attack download --id <id> --output attack.json", "tenable-axi export attack download --id <id> --output attack.csv"], evidence: "specs/exposure-management.json" },
};
