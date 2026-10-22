import type { OperationBinding } from "./transport-core.js";
import type { MutationOperation } from "./writes-core.js";
import { inventoryBindings, inventoryCatalogue } from "./inventory-catalogue.js";
import { exposureBindings } from "./exposure-contracts.js";
import { attackBindings, attackCatalogue } from "./attack-catalogue.js";
import { attackExportBindings, attackExportCatalogue, attackExportMutations } from "./attack-export-catalogue.js";
import { inventoryExportBindings, inventoryExportCatalogue, inventoryExportMutations } from "./inventory-export-catalogue.js";
import { platformTagBindings, platformTagCatalogue, platformTagMutations } from "./platform-tag-catalogue.js";

export const DESCRIPTION = "Agent-friendly CLI for Tenable One, under construction";

// Endpoint slices add reviewed executable bindings alongside their commands.
export const transportBindings: Readonly<Record<string, OperationBinding>> = Object.freeze({ ...inventoryBindings, ...exposureBindings, ...attackBindings, ...inventoryExportBindings, ...attackExportBindings, ...platformTagBindings });
export const mutationOperations: Readonly<Record<string, MutationOperation>> = Object.freeze({ ...inventoryExportMutations, ...attackExportMutations, ...platformTagMutations });

// Evidence and planned commands never enable execution. Endpoint slices add explicit bindings here.
export const catalogue = {
  ...inventoryCatalogue,
  ...attackCatalogue,
  ...inventoryExportCatalogue,
  ...attackExportCatalogue,
  ...platformTagCatalogue,
  home: {
    description: "Show profile state and up to five live exposure cards",
    flags: { config: "Config path; default platform path", profile: "Profile name; default credential precedence", fields: "Card fields; default id,name,score", full: "Full text; default false", help: "Show help; default false" },
    examples: ["tenable-axi", "tenable-axi home --help"],
  },
  "auth status": {
    description: "Check local credentials and file security without contacting Tenable",
    flags: { config: "Config path; default TENABLE_AXI_CONFIG or platform path", profile: "Profile name; default credential precedence", fields: "Comma-separated output fields; default all", full: "Show full text; default false", help: "Show help; default false" },
    examples: ["tenable-axi auth status", "tenable-axi auth status --profile example"],
  },
  "profile list": {
    description: "List configured profiles without resolving secrets or contacting Tenable",
    flags: { config: "Config path; default TENABLE_AXI_CONFIG or platform path", profile: "Common selector; list still shows all profiles", fields: "Comma-separated output fields; default all", full: "Show full text; default false", help: "Show help; default false" },
    examples: ["tenable-axi profile list", "tenable-axi profile list --config /example/config.json"],
  },
  "config path": {
    description: "Show selected config and state paths without reading files",
    flags: { config: "Config path; default TENABLE_AXI_CONFIG or platform path", profile: "Common selector; paths are independent of profile", fields: "Comma-separated output fields; default all", full: "Show full text; default false", help: "Show help; default false" },
    examples: ["tenable-axi config path", "tenable-axi config path --fields config"],
  },
  ...exposureCatalogue(),
} as const;

function exposureCatalogue() {
  const common = { config: "Config path; default platform path", profile: "Profile name; default credential precedence", fields: "Comma-separated output fields; default compact projection", full: "Full text; default false", help: "Show help; default false" };
  const paging = { limit: "Output rows; default 100", offset: "Starting record; default 0", cursor: "Resume the same scoped collection", all: "Read up to 10000 rows; incompatible with --limit" };
  return {
    "card list": { description: "List exposure view cards", flags: { ...common, ...paging, global: "true or false; default all cards", query: "Card name search", "sorting-order": "asc or desc; default API order" }, examples: ["tenable-axi card list", "tenable-axi card list --global true --limit 5"] },
    "card show": { description: "Show an exposure card and its scores, trends and SLA details", flags: { ...common, id: "Required card ID", "trend-start-date": "UTC ISO timestamp", "trend-end-date": "UTC ISO timestamp", "sla-efficiency-start-date": "UTC ISO timestamp", "sla-efficiency-end-date": "UTC ISO timestamp", "sla-breakdown-filter": "ANY, REMEDIATED or NON_REMEDIATED; default ANY", "include-trend-events": "true or false; default false" }, examples: ["tenable-axi card show --id <id>", "tenable-axi card show --id <id> --include-trend-events true"] },
    "tag list": { description: "Search Exposure Management tags", flags: { ...common, ...paging, query: "Simple text search", filter: "Repeatable: property operator JSON-array-of-strings", "filter-file": "Strict documented tag filter array; incompatible with --filter", sort: "property:asc or property:desc", "extra-properties": "Comma-separated property names" }, examples: ["tenable-axi tag list", "tenable-axi tag list --query production --limit 10"] },
    "tag properties": { description: "List available tag properties and operators", flags: common, examples: ["tenable-axi tag properties", "tenable-axi tag properties --fields property,operators"] },
    doctor: { description: "Check local security and one tag-properties read without retries", flags: common, examples: ["tenable-axi doctor", "tenable-axi doctor --profile example"] },
    hook: { description: "Show compact local profile context without resolving secrets or HTTP", flags: common, examples: ["tenable-axi hook", "tenable-axi hook --profile example"] },
  };
}

export function help(): Record<string, unknown> {
  return {
    description: DESCRIPTION,
    commands: Object.fromEntries(Object.entries(catalogue).map(([name, entry]) => [name, entry.description])),
    flags: Object.fromEntries(Object.entries(catalogue.home.flags).map(([name, description]) => [`--${name}`, description])),
    version: "-v, -V, --version: print the bare version",
    examples: catalogue.home.examples,
  };
}
