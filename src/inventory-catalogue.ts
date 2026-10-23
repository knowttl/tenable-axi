import { z } from "zod";
import type { OperationBinding } from "./transport-core.js";

export const inventoryKinds = { asset: "assets", finding: "findings", software: "software" } as const;
export type InventoryKind = keyof typeof inventoryKinds;
export const defaultFields = { asset: ["id", "name", "class", "exposureScore"], finding: ["id", "name", "severity", "state"],
  software: ["name", "version", "publisher"] };
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

const common = { config: "Config path; default credential precedence", profile: "Profile name; default credential precedence",
  fields: "Comma-separated display or wire properties; default compact view", full: "Show full text; default false", help: "Show help" };
const collection = { limit: "Maximum emitted rows, 1-10000; default 100", all: "Read up to 10000 rows within invocation budgets; excludes --limit",
  cursor: "Opaque resume cursor; retain the original selectors and filters" };
const search = { query: "Simple query text", filter: "Repeatable: <property> <operator> <JSON string array>",
  "filter-file": "JSON flat array of {property, operator, value: string[]}; '-' reads stdin; excludes --filter",
  sort: "Wire property:asc|desc", "extra-properties": "Comma-separated extra wire properties", offset: "Starting record; default 0; excludes --cursor" };

export const inventoryCatalogue = Object.fromEntries((Object.keys(inventoryKinds) as InventoryKind[]).flatMap((kind) => [
  [`${kind} list`, { description: `Search ${inventoryKinds[kind]}${kind === "software" ? "; the pinned API exposes no stable software ID" : ""}`,
    operationId: `inventory-${inventoryKinds[kind]}-search`, defaultFields: defaultFields[kind], evidence: "specs/exposure-management.json",
    flags: { ...common, ...collection, ...search, ...(kind === "asset" ? { class: "Server-side asset class filter" } : {}) },
    examples: [`tenable-axi ${kind} list --limit 20`, `tenable-axi ${kind} list --query example`] }],
  [`${kind} properties`, { description: `Discover ${kind} properties and supported operators`,
    operationId: `inventory-${kind}-properties-list`, defaultFields: ["key", "readable_name", "operators", "sortable", "filterable"], evidence: "specs/exposure-management.json",
    flags: { ...common, ...collection, ...(kind === "asset" ? { "asset-classes": "Comma-separated documented asset classes" } : {}) },
    examples: [`tenable-axi ${kind} properties`, `tenable-axi ${kind} properties --full`] }],
  ...(kind === "software" ? [] : [[`${kind} show`, { description: `Find one ${kind} by exact ID search`,
    operationId: `inventory-${inventoryKinds[kind]}-search`, defaultFields: defaultFields[kind], evidence: "specs/exposure-management.json",
    flags: { ...common, id: "Required exact inventory ID", "extra-properties": search["extra-properties"] },
    examples: [`tenable-axi ${kind} show --id <id>`, `tenable-axi ${kind} show --id <id> --fields id,name,description --full`] }]]),
])) as Record<string, { description: string; flags: Record<string, string>; examples: string[];
  operationId: string; defaultFields: string[]; evidence: string }>;
