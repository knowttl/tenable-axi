import { z } from "zod";
import type { OperationBinding } from "./transport-core.js";

export const inventoryKinds = { asset: "assets", finding: "findings", software: "software" } as const;
export type InventoryKind = keyof typeof inventoryKinds;
export const defaultFields = { asset: ["id", "name", "class", "exposureScore"], finding: ["id", "name", "severity", "state", "sensor_type"],
  software: ["name", "version", "publisher"] };
const showFields = { asset: [...defaultFields.asset, "fqdns", "last_observed_at"],
  finding: [...defaultFields.finding, "asset_id", "cves"], software: defaultFields.software };
export const sortAliases: Record<InventoryKind, Record<string, string>> = {
  asset: { id: "asset_id", name: "asset_name", class: "asset_class", exposureScore: "aes" },
  finding: { id: "finding_id", name: "finding_name" }, software: { name: "application" },
};
// Sortable keys and count values come from the pinned properties-route examples.
export const sortableFields: Record<InventoryKind, string[]> = {
  asset: ["asset_id", "asset_class", "last_updated", "asset_name", "sources", "created_at", "first_observed_at", "last_observed_at",
    "last_licensed_at", "fqdns", "aes", "critical_vuln_count", "high_vuln_count", "low_vuln_count", "is_licensed", "exposure_classes",
    "tenable_uuid", "license_expires_at", "sensors", "critical_weakness_count", "high_weakness_count", "medium_weakness_count",
    "low_weakness_count", "total_weakness_count", "tag_count", "entitlement_count"],
  finding: ["finding_id", "state", "last_updated", "first_observed_at", "last_observed_at", "port", "protocol", "detection_id",
    "finding_name", "solution", "severity", "vpr_score", "cves", "asset_id", "asset_name", "asset_class", "apa_total_steps_count",
    "apa_low_steps_count", "apa_medium_steps_count", "apa_high_steps_count", "apa_critical_steps_count", "sensor_type"],
  software: ["cpe", "publisher", "application", "version", "software_update", "edition", "software_edition", "target_software",
    "target_hardware", "software_language", "software_other", "display_publisher", "display_application", "file_location",
    "port_binding_count", "ports", "protocols", "last_seen_version", "eol_date", "devices_count", "version_count", "cpe_count",
    "file_location_count", "type", "asset_sources", "last_seen", "first_seen", "category_names"],
};
export const findingCountValues = {
  severity: ["Info", "Low", "Medium", "High", "Critical"],
  sensor_type: ["ACCURICS", "INVENTORY", "RAPID_7", "SECURITY_CENTER", "CARBON_BLACK", "TVDB", "AWS", "OT", "CONSEC", "WAS", "ASM", "NESSUS", "CLOUD_SCAN", "TIE"],
};
export const aliases: Record<InventoryKind, Record<string, string>> = {
  asset: { class: "asset_class", exposureScore: "aes" }, finding: {}, software: { name: "application" },
};
export const wireFields: Record<InventoryKind, Record<string, z.ZodType>> = {
  asset: { id: z.string(), name: z.string(), asset_class: z.string(), aes: z.number(), acr: z.number() },
  finding: { id: z.string(), name: z.string(), severity: z.string(), state: z.string(), asset_id: z.string() },
  software: { application: z.string(), publisher: z.string(), type: z.array(z.string()), devices_count: z.number().int().nonnegative() },
};
export const propertyFields: Record<string, z.ZodType> = { key: z.string(), readable_name: z.string(), operators: z.array(z.string()),
  sortable: z.boolean(), filterable: z.boolean(), control: z.record(z.string(), z.unknown()), description: z.string() };
export const assetClasses = ["ACCOUNT", "APPLICATION", "CONTAINER", "DEVICE", "GENERAL", "GROUP", "IAC", "IDENTITY", "RESOURCE", "ROLE", "STORAGE", "UNKNOWN"] as const;
export const filterSchema = z.strictObject({
  property: z.string().min(1),
  operator: z.enum(["=", "!=", "<=", "between", "match", ">=", "<", ">", "contains", "not contains", "exists", "not exists", "older than", "newer than", "within last"]),
  value: z.array(z.string()),
});
export const inventoryPage = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  pagination: z.object({ total: z.number().int().nonnegative().optional(), offset: z.number().int().nonnegative(),
    limit: z.number().int().positive() }).optional(),
});
const properties = z.array(z.record(z.string(), z.unknown()));

export const inventoryBindings: Readonly<Record<string, OperationBinding>> = Object.freeze(Object.fromEntries(
  (Object.keys(inventoryKinds) as InventoryKind[]).flatMap((kind) => {
    const noun = inventoryKinds[kind];
    const advice = {
      permissionHelp: "Inventory reads require EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ; check the selected user's access",
      validationHelp: `Run tenable-axi ${kind} properties to discover supported properties and operators`,
    };
    return [
      [`inventory-${noun}-search`, { ...advice, method: "POST", path: `/api/v1/t1/inventory/${noun}/search`,
        effect: "read", query: ["offset", "limit", "sort", "extra_properties"], paging: ["offset", "limit"], decoder: inventoryPage }],
      [`inventory-${kind}-properties-list`, { ...advice, method: "GET", path: `/api/v1/t1/inventory/${noun}/properties`,
        effect: "read", query: kind === "asset" ? ["asset_classes"] : [],
        decoder: kind === "asset" ? z.union([z.object({ properties }).transform(({ properties }) => ({ data: properties })),
          z.object({ data: properties })]) : z.object({ data: properties }) }],
    ] as [string, OperationBinding][];
  }),
));

export const filterExamples: Record<InventoryKind, string> = {
  asset: 'asset_class = ["DEVICE"]', finding: 'severity = ["HIGH"]', software: 'application = ["example-app"]',
};
const common = (fields: string) => ({ config: "Config path; default credential precedence", profile: "Profile name; default credential precedence",
  fields, full: "Show untruncated text; does not add fields or rows; default false", help: "Show help" });
const listFields = (kind: InventoryKind, fields = defaultFields[kind]) =>
  `Comma-separated display or wire properties; display names: ${fields.join(", ")}; default compact view`;
const propertyFieldsHelp = `Comma-separated output fields; accepted: ${Object.keys(propertyFields).join(", ")}; default compact view`;
const collection = { limit: "Maximum emitted rows, 1-10000; default 100", all: "Read up to 10000 rows within invocation budgets; excludes --limit",
  cursor: "Opaque resume cursor; retain the original selectors and filters" };
const search = { query: "Simple query text", filter: "Repeatable: <property> <operator> <JSON string array>",
  "filter-file": "JSON flat array of {property, operator, value: string[]}; '-' reads stdin; excludes --filter",
  sort: "Sortable display or wire property:asc|desc; unknown names report valid choices", "extra-properties": "Comma-separated extra wire properties", offset: "Starting record; default 0; excludes --cursor" };

export const inventoryCatalogue = Object.fromEntries((Object.keys(inventoryKinds) as InventoryKind[]).flatMap((kind) => [
  ...(kind !== "finding" ? [] : [["finding summary", {
    description: "Count findings by each published severity and sensor_type value using limit-1 searches; no per-asset grouping",
    operationId: "inventory-findings-search", defaultFields: [], evidence: "specs/exposure-management.json",
    flags: { config: "Config path; default credential precedence", profile: "Profile name; default credential precedence",
      query: search.query, filter: search.filter, "filter-file": search["filter-file"], help: "Show help" },
    examples: ["tenable-axi finding summary", `tenable-axi finding summary --filter 'state = ["ACTIVE"]'`],
  }]]),
  [`${kind} list`, { description: `Search ${inventoryKinds[kind]}${kind === "software" ? "; the pinned API exposes no stable software ID" : ""}`,
    operationId: `inventory-${inventoryKinds[kind]}-search`, defaultFields: defaultFields[kind], evidence: "specs/exposure-management.json",
    flags: { ...common(listFields(kind)), ...collection, ...search,
      filter: `Repeatable: <property> <operator> <JSON string array>, e.g. ${filterExamples[kind]}`,
      ...(kind === "asset" ? { class: "Server-side asset class filter" } : {}) },
    examples: [`tenable-axi ${kind} list --limit 20`, `tenable-axi ${kind} list --query example`,
      `tenable-axi ${kind} list --filter '${filterExamples[kind]}'`,
      ...(kind === "finding" ? [`tenable-axi finding list --filter 'sensor_type = ["NESSUS"]'`,
        "tenable-axi finding list --limit 10000 --offset 10000 --sort finding_id:asc"] : [])] }],
  [`${kind} properties`, { description: `Discover ${kind} properties and supported operators`,
    operationId: `inventory-${kind}-properties-list`, defaultFields: ["key", "readable_name", "operators", "sortable", "filterable"], evidence: "specs/exposure-management.json",
    flags: { ...common(propertyFieldsHelp), ...collection, ...(kind === "asset" ? { "asset-classes": "Comma-separated documented asset classes" } : {}) },
    examples: [`tenable-axi ${kind} properties`, `tenable-axi ${kind} properties --full`] }],
  ...(kind === "software" ? [] : [[`${kind} show`, { description: `Find one ${kind} by exact ID search`,
    operationId: `inventory-${inventoryKinds[kind]}-search`, defaultFields: showFields[kind], evidence: "specs/exposure-management.json",
    flags: { ...common(listFields(kind, showFields[kind])), id: "Required exact inventory ID", "extra-properties": search["extra-properties"] },
    examples: [`tenable-axi ${kind} show --id <id>`, `tenable-axi ${kind} show --id <id> --fields id,name,description --full`] }]]),
])) as Record<string, { description: string; flags: Record<string, string>; examples: string[];
  operationId: string; defaultFields: string[]; evidence: string }>;
