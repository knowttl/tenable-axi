import { z } from "zod";
import type { OperationBinding } from "./transport-core.js";

const rows = z.array(z.record(z.string(), z.unknown()));
export const attackPage = z.object({ data: rows, pagination: z.object({
  total: z.number().int().nonnegative().optional(), offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
}).optional() });
export const logPage = z.object({ items: rows, total_count: z.number().int().nonnegative().optional() });
const count = z.number().int().nonnegative();
const strings = z.array(z.string());
const objects = z.array(z.record(z.string(), z.json()));
export const attackFields: Record<string, z.ZodType> = {
  vector_id: z.string(), name: z.string(), priority: z.number(), summary: z.string().nullable(),
  is_new: z.boolean(), first_aes: z.number().nullable(), last_acr: z.number(), path_status: z.string(),
  path: z.record(z.string(), z.json()).nullable(), techniques: objects, nodes: objects,
  findings_names: strings, graph_node: z.record(z.string(), z.json()), mitigations: objects,
};
export const techniqueFields: Record<string, z.ZodType> = {
  serial_id: count, name: z.string(), assets_ids: strings, mitre_id: z.string(), priority: z.string(),
  state: z.string(), status: z.string(), created: z.string(), last_updated_at: z.string(), technique_name: z.string(),
  vector_count: count, total_vector_count: count, critical_assets_count: count, total_critical_assets_count: count,
  tactics: strings, tools: strings, malwares: strings, mitigations: strings, groups: strings,
  detection_ids: strings, weaknesses_ids: strings, source_information: objects, related_nodes: z.record(z.string(), z.json()),
};
export const logFields: Record<string, z.ZodType> = {
  connector_id: count, status: z.string(), sync_timestamp: z.object({ start: z.string() }).passthrough(),
  sync_uuid: z.string(), type: z.string(), trigger_reason: z.string(), sync_stages_info: objects, sync_logs: objects,
};
const permissionHelp = "Attack reads require EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.READ; check the selected user's access";
export const attackBindings: Readonly<Record<string, OperationBinding>> = Object.freeze({
  "apa-attack-paths-search": { method: "POST", path: "/api/v1/t1/apa/top-attack-paths/search", effect: "read",
    query: ["limit", "offset", "sort", "exclude_resolved", "run_ai_summarization"], paging: ["limit", "offset"],
    decoder: attackPage, permissionHelp, validationHelp: "Run tenable-axi attack-path list --help; check the documented filter body" },
  "apa-attack-techniques-search": { method: "POST", path: "/api/v1/t1/apa/top-attack-techniques/search", effect: "read",
    query: ["limit", "offset", "sort", "exclude_resolved"], paging: ["limit", "offset"], decoder: attackPage,
    permissionHelp, validationHelp: "Run tenable-axi attack-technique list --help; check the documented filter body" },
  "connectors-logs": { method: "GET", path: "/api/v1/t1/connectors/logs", effect: "read",
    query: ["connector_id", "status", "start_date", "end_date"], decoder: logPage,
    permissionHelp: "Connector logs require Administrator [64] or EXPOSURE_MANAGEMENT.CONNECTOR.CONNECTOR.READ; ordinary inventory reads do not require Administrator",
    validationHelp: "Run tenable-axi connector logs --help; use paired YYYY-MM-DD date boundaries" },
});

export const attackProperties = ["priority", "name", "summary", "steps", "asset_exposure", "blast_radius", "asset_id", "freetext", "finding_id", "technique", "weakness_id", "critical_asset", "data_source", "apa_aes", "acr", "path_status"] as const;
export const techniqueProperties = ["priority", "state", "status", "name", "procedureName", "mitre_id", "tactics", "target", "source", "cause", "last_updated_at", "created", "serial_id"] as const;
export function attackFilterSchema(technique: boolean) {
  const single = z.strictObject({ property: z.enum(technique ? techniqueProperties : attackProperties),
    operator: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "contains", "not_contains", "in", "not_in"]),
    value: z.union([z.string(), z.array(z.string()), z.number().int(), z.array(z.number().int()), z.boolean()]) });
  const operator = technique ? z.enum(["and", "or"]) : z.enum(["AND", "OR"]).default("AND");
  const nested = z.strictObject({ operator, value: z.array(single) });
  return z.union([single, z.strictObject({ operator, value: z.array(z.union([single, nested])) })]);
}

const common = { config: "Config path; default credential precedence", profile: "Profile name; default credential precedence",
  fields: "Comma-separated display or wire fields; default compact view", full: "Show full text; default false", help: "Show help",
  limit: "Maximum emitted rows, 1-10000; default 100", all: "Read up to 10000 rows within invocation budgets; excludes --limit",
  cursor: "Bounded resume cursor; retain original selectors, filters, sort and fields" };
const search = { offset: "Starting record; default 0; excludes --cursor", sort: "Documented wire property:direction",
  filter: "Repeatable: <property> <operator> <JSON-value>; combines with AND (paths) or and (techniques)",
  "filter-file": "Documented single or nested JSON filter, at most two logical levels; '-' reads stdin; excludes --filter",
  "include-resolved": "Include resolved records; default false (exclude_resolved=true)" };
export const attackCatalogue: Record<string, { description: string; operationId: string; flags: Record<string, string>;
  defaultFields: string[]; examples: string[]; evidence: string }> = {
  "attack-path list": { description: "Search top attack paths using the published specification route", operationId: "apa-attack-paths-search",
    flags: { ...common, ...search, "run-ai-summarization": "true|false; default false" }, defaultFields: ["id", "name", "priority"],
    examples: ["tenable-axi attack-path list --limit 20", "tenable-axi attack-path list --filter 'priority gte 8' --include-resolved"], evidence: "specs/exposure-management.json" },
  "attack-technique list": { description: "Search top attack techniques; affectedAssets counts assets_ids", operationId: "apa-attack-techniques-search",
    flags: { ...common, ...search }, defaultFields: ["id", "name", "affectedAssets"],
    examples: ["tenable-axi attack-technique list --limit 20", "tenable-axi attack-technique list --sort priority:desc --include-resolved"], evidence: "specs/exposure-management.json" },
  "connector logs": { description: "Read connector sync logs; the API has no server paging parameters", operationId: "connectors-logs",
    flags: { ...common, "connector-id": "Nonnegative numeric connector ID", status: "SUCCEEDED|FAILED",
      "start-date": "Inclusive YYYY-MM-DD; requires --end-date", "end-date": "Exclusive YYYY-MM-DD; requires --start-date" },
    defaultFields: ["connectorId", "status", "timestamp"], examples: ["tenable-axi connector logs --connector-id 1 --limit 20",
      "tenable-axi connector logs --status FAILED --start-date 2026-01-01 --end-date 2026-02-01"], evidence: "specs/exposure-management.json" },
};
