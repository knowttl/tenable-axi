import { z } from "zod";
import type { OperationBinding } from "./transport-core.js";

export const TAG_PRIVILEGE = "EXPOSURE_MANAGEMENT.TAG.TAG.READ";
const score = z.object({ score: z.number() }).passthrough();
export const cardRecord = z.object({ id: z.string(), name: z.string(), ces_score: score.optional() }).passthrough();
export const cardDetails = z.object({ id: z.string(), name: z.string(), ces_scores: z.object({ total: score }).passthrough().optional() }).passthrough();
export const tagRecord = z.object({ id: z.string(), name: z.string(), extra_properties: z.record(z.string(), z.unknown()).optional() }).passthrough();
const pagination = z.object({ total: z.number().int().nonnegative().optional(), total_record_count: z.number().int().nonnegative().optional() }).passthrough();
export const properties = z.object({ data: z.array(z.object({ key: z.string(), operators: z.array(z.string()) }).passthrough()) });

export const exposureBindings: Readonly<Record<string, OperationBinding>> = {
  "exposure-view-cards-search": {
    method: "GET", path: "/api/v1/t1/exposure-view/cards", effect: "read",
    query: ["is_global_card", "text_query", "sorting_order", "limit", "offset"], paging: ["limit", "offset"],
    decoder: z.object({ data: z.array(cardRecord), pagination: pagination.optional() }),
    permissionHelp: "Requires EXPOSURE_MANAGEMENT.ANALYTICS.EXPOSURE_VIEW.READ", validationHelp: "Check card list --help",
  },
  "exposure-view-card-details": {
    method: "GET", path: "/api/v1/t1/exposure-view/cards/{card_id}", effect: "read",
    query: ["trend_start_date", "trend_end_date", "sla_efficiency_start_date", "sla_efficiency_end_date", "sla_breakdown_filter", "include_trend_events"],
    decoder: cardDetails, permissionHelp: "Requires EXPOSURE_MANAGEMENT.ANALYTICS.EXPOSURE_VIEW.READ", validationHelp: "Check card show --help",
  },
  "inventory-tag-search": {
    method: "POST", path: "/api/v1/t1/tags/search", effect: "read",
    query: ["extra_properties", "offset", "limit", "sort"], paging: ["limit", "offset"],
    decoder: z.object({ data: z.array(tagRecord), pagination: pagination.optional() }),
    permissionHelp: `Requires ${TAG_PRIVILEGE}`, validationHelp: "Run tenable-axi tag properties to discover filter properties and operators",
  },
  "inventory-tag-properties-list": {
    method: "GET", path: "/api/v1/t1/tags/properties", effect: "read", query: [], decoder: properties,
    permissionHelp: `Requires ${TAG_PRIVILEGE}`, validationHelp: "Check tag properties --help",
  },
};
