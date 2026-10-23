import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { TransportError, type OperationBinding } from "./transport-core.js";
import type { MutationOperation } from "./writes-core.js";

const uuid = z.string().uuid();
const categoryName = z.string().min(1).max(127).regex(/^[^:]+$/).refine((value) => !!value.trim());
const valueName = z.string().min(1).max(50).regex(/^[^,]+$/);
const rule = z.strictObject({ property: z.string().min(1), operator: z.string().min(1),
  value: z.union([z.string(), z.array(z.string())]).refine((value) =>
    (typeof value === "string" ? value.split(",").length : value.reduce((count, item) => count + item.split(",").length, 0)) <= 1024) });
const conditions = z.strictObject({ and: z.array(rule).optional(), or: z.array(rule).optional() })
  .refine((value) => (value.and?.length ?? 0) + (value.or?.length ?? 0) <= 40);
const filters = z.strictObject({ asset: conditions.optional() });
const categoryBody = z.strictObject({ name: categoryName, description: z.string().max(3000).optional() });
const valueFields = { value: valueName.optional(), description: z.string().optional(), filters: filters.optional() };
const createValueBody = z.strictObject({ ...valueFields, value: valueName, category_name: categoryName.optional(),
  category_uuid: uuid.optional(), category_description: z.string().max(3000).optional() })
  .refine((value) => !!value.category_name || !!value.category_uuid);
const updateValueBody = z.strictObject({ ...valueFields, version: z.number().int().nonnegative().optional() })
  .refine((value) => Object.keys(value).some((key) => key !== "version"));
export const tagIds = z.array(uuid).min(1).max(10000).transform((ids) => [...new Set(ids)].sort());
export const platformTagInputs = {
  "tags-create-tag-category": z.strictObject({ body: categoryBody }),
  "tags-edit-tag-category": z.strictObject({ id: uuid, body: categoryBody }),
  "tags-delete-tag-category": z.strictObject({ id: uuid }),
  "tags-create-tag-value": z.strictObject({ body: createValueBody }),
  "tags-update-tag-value": z.strictObject({ id: uuid, body: updateValueBody }),
  "tags-delete-tag-value": z.strictObject({ id: uuid }),
  "tags-delete-tag-values-bulk": z.strictObject({ body: z.strictObject({ values: tagIds }) }),
  "tags-assign-asset-tags": z.strictObject({ body: z.strictObject({ action: z.enum(["add", "remove"]), assets: tagIds, tags: tagIds }) }),
};
const record = z.record(z.string(), z.unknown());
export const tagPagination = z.object({ offset: z.number().int().nonnegative(), limit: z.number().int().positive(), total: z.number().int().nonnegative() });
const detail = z.object({ uuid }).passthrough();
const list = (key: string) => z.object({ [key]: z.array(record), pagination: tagPagination });
const definitions = [
  ["tags-create-tag-category", "POST", "/tags/categories", "write", [], detail, "Scan Manager [40] or PS.ACCT_MGMT.TAGS.CREATE"],
  ["tags-list-tag-categories", "GET", "/tags/categories", "read", ["f", "ft", "limit", "offset", "sort"], list("categories"), "Basic [16]"],
  ["tags-tag-category-details", "GET", "/tags/categories/{tag_category_uuid}", "read", [], detail, "Basic [16]"],
  ["tags-edit-tag-category", "PUT", "/tags/categories/{tag_category_uuid}", "write", [], detail, "Scan Manager [40] or PS.ACCT_MGMT.TAGS.EDIT; edit permission on all values"],
  ["tags-delete-tag-category", "DELETE", "/tags/categories/{tag_category_uuid}", "write", [], record, "Scan Manager [40] or PS.ACCT_MGMT.TAGS.DELETE; edit permission on all values"],
  ["tags-create-tag-value", "POST", "/tags/values", "write", [], detail, "Scan Manager [40] or PS.ACCT_MGMT.TAGS.CREATE"],
  ["tags-list-tag-values", "GET", "/tags/values", "read", ["f", "ft", "wf", "w", "limit", "offset", "sort"], list("values"), "Basic [16]"],
  ["tags-tag-value-details", "GET", "/tags/values/{tag_value_uuid}", "read", [], detail, "Basic [16]"],
  ["tags-update-tag-value", "PUT", "/tags/values/{tag_value_uuid}", "write", [], detail, "Scan Operator [24] or PS.ACCT_MGMT.TAGS.EDIT"],
  ["tags-delete-tag-value", "DELETE", "/tags/values/{tag_value_uuid}", "write", [], z.unknown(), "Scan Operator [24] or PS.ACCT_MGMT.TAGS.DELETE; edit permission on the value"],
  ["tags-delete-tag-values-bulk", "POST", "/tags/values/delete-requests", "write", [], z.unknown(), "Scan Operator [24] or PS.ACCT_MGMT.TAGS.DELETE"],
  ["tags-assign-asset-tags", "POST", "/tags/assets/assignments", "write", [], z.object({ job_uuid: z.string().min(1) }), "Basic [16]"],
  ["tags-list-asset-tags", "GET", "/tags/assets/{asset_uuid}/assignments", "read", [], z.object({ tags: z.array(z.object({ asset_uuid: uuid, value_uuid: uuid }).passthrough()) }), "Basic [16] or PS.ACCT_MGMT.TAGS.READ"],
  ["tags-list-exclusions", "GET", "/tags/values/{tag_value_uuid}/exclusions", "read", ["target_type", "limit", "offset"], list("excluded_targets"), "Basic [16] or PS.ACCT_MGMT.TAGS.READ"],
  ["tags-list-asset-filters", "GET", "/tags/assets/filters", "read", [], z.object({ filters: z.array(record) }), "Basic [16] or PS.ACCT_MGMT.TAGS.READ"],
] as const;
export const platformTagBindings: Readonly<Record<string, OperationBinding>> = Object.fromEntries(definitions.map(
  ([id, method, path, effect, query, decoder, permission]) => [id, { method, path, effect, query, decoder,
    permissionHelp: `Requires ${permission}`, validationHelp: "Run tenable-axi tag asset-filter list for dynamic rules; read the current tag and version before retrying" }]));

type TagInput = { id?: string; body?: Record<string, unknown> };
function sameBody(state: Record<string, unknown>, body: Record<string, unknown>): boolean {
  const normalized = { ...state };
  if (body.filters && state.filters) {
    let asset = (state.filters as { asset?: unknown }).asset;
    if (typeof asset === "string") {
      try { asset = JSON.parse(asset) as unknown; } catch { return false; }
    }
    if (asset && typeof asset === "object" && !Array.isArray(asset)) {
      normalized.filters = { ...state.filters as Record<string, unknown>, asset: Object.fromEntries(Object.entries(asset).map(([key, rules]) =>
        [key, ["and", "or"].includes(key) && Array.isArray(rules) ? rules.map((item: unknown) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return item;
          const { field, ...rest } = item as Record<string, unknown>;
          return typeof field === "string" && !Object.hasOwn(rest, "property") ? { ...rest, property: field } : item;
        }) : rules])) };
    }
  }
  return Object.entries(body).filter(([key]) => !["version", "category_uuid", "category_name", "category_description"].includes(key))
    .every(([key, value]) => isDeepStrictEqual(normalized[key], value));
}
export const platformTagMutations: Readonly<Record<string, MutationOperation>> = Object.fromEntries(
  Object.entries(platformTagInputs).map(([operation, input]) => {
    const category = operation.includes("category"), create = operation.startsWith("tags-create"), update = operation.includes("edit") || operation.includes("update");
    const bulk = operation === "tags-delete-tag-values-bulk", assignment = operation === "tags-assign-asset-tags";
    const noun = category ? "category" : "value";
    return [operation, { input,
      prepare(raw: unknown) {
        const { id, body } = raw as TagInput;
        return { target: assignment ? { kind: "tag-assignment", payload: true as const }
          : bulk ? { kind: "tag-values", ids: body!.values as string[] }
            : create ? { kind: `tag-${noun}`, name: category ? body!.name as string : `${body!.category_uuid ?? body!.category_name}:${body!.value}` }
              : { kind: `tag-${noun}`, id: id! },
        request: { ...(id ? { pathParams: { [category ? "tag_category_uuid" : "tag_value_uuid"]: id } } : {}), ...(body ? { body } : {}) } };
      },
      async current(transport, raw: unknown) {
        const { id, body } = raw as TagInput;
        if (assignment) {
          const state: Record<string, string[]> = {};
          for (const asset of body!.assets as string[]) {
            const response = (await transport.request("tags-list-asset-tags", { pathParams: { asset_uuid: asset } })).body as { tags: { asset_uuid: string; value_uuid: string }[] };
            if (response.tags.some((tag) => tag.asset_uuid !== asset)) throw new TransportError({ code: "RESPONSE_INVALID", message: "Assignment read returned another asset", operation });
            state[asset] = [...new Set(response.tags.map((tag) => tag.value_uuid))].sort();
          }
          return { state, noop: Object.values(state).every((tags) => (body!.tags as string[]).every((tag) => tags.includes(tag) === (body!.action === "add"))) };
        }
        if (bulk) {
          const state = [];
          for (const value of body!.values as string[]) {
            const current = (await transport.request("tags-tag-value-details", { pathParams: { tag_value_uuid: value } })).body as { uuid: string };
            if (current.uuid !== value) throw new TransportError({ code: "RESPONSE_INVALID", message: "Tag read returned another identifier", operation });
            state.push(current);
          }
          return { state };
        }
        if (create) {
          const response = (await transport.request(category ? "tags-list-tag-categories" : "tags-list-tag-values", {
            query: { f: category ? [`name:eq:${body!.name}`] : [`value:eq:${body!.value}`, `category_name:eq:${body!.category_name ?? ""}`].slice(0, body!.category_name ? 2 : 1), ft: "and", limit: 100, offset: 0 },
          })).body as { categories?: Record<string, unknown>[]; values?: Record<string, unknown>[]; pagination: { total: number; limit: number; offset: number } };
          const rows = (category ? response.categories : response.values)!;
          if (response.pagination.total < rows.length || rows.length > 100 || response.pagination.offset !== 0 || response.pagination.limit !== 100) {
            throw new TransportError({ code: "RESPONSE_INVALID", message: "Malformed tag lookup pagination", operation });
          }
          const matches = rows.filter((row) => category ? row.name === body!.name : row.value === body!.value
            && (body!.category_uuid ? row.category_uuid === body!.category_uuid : row.category_name === body!.category_name));
          let state: unknown = response;
          if (matches.length === 1 && response.pagination.total <= rows.length) {
            const decoded = detail.safeParse(matches[0]);
            if (!decoded.success) throw new TransportError({ code: "RESPONSE_INVALID", message: "Tag lookup returned a malformed identifier", operation });
            const match = decoded.data;
            const current = (await transport.request(category ? "tags-tag-category-details" : "tags-tag-value-details", {
              pathParams: { [category ? "tag_category_uuid" : "tag_value_uuid"]: match.uuid },
            })).body as Record<string, unknown>;
            if (current.uuid !== match.uuid) throw new TransportError({ code: "RESPONSE_INVALID", message: "Tag read returned another identifier", operation });
            state = current;
            const sameCategory = category || (body!.category_uuid ? current.category_uuid === body!.category_uuid : current.category_name === body!.category_name);
            return { state, noop: sameCategory && sameBody(current, body!) && (category || body!.filters !== undefined || current.type === "static") };
          }
          return { state };
        }
        const state = (await transport.request(category ? "tags-tag-category-details" : "tags-tag-value-details", {
          pathParams: { [category ? "tag_category_uuid" : "tag_value_uuid"]: id! },
        })).body as Record<string, unknown>;
        if (state.uuid !== id) throw new TransportError({ code: "RESPONSE_INVALID", message: "Tag read returned another identifier", operation });
        return { state, noop: update && sameBody(state, body!) };
      },
      effect: assignment ? "Add or remove the exact tag set on the exact asset set as proposed, asynchronously; no automatic polling"
        : operation.includes("delete") ? `Delete tag ${noun}${bulk ? "s" : ""} and remove associated asset assignments${category ? "; also delete every value in the category" : "; retain the category"}`
          : `${create ? "Create" : "Update"} tag ${noun}${!category ? "; dynamic filters change automatic asset assignment; a new category name may create a category" : ""}`,
      readBackHelp: [`Run tenable-axi tag ${assignment ? "assignment list --asset-id <id>" : `${noun} show --id <id>`}; reconcile before retrying an unknown outcome`],
    } satisfies MutationOperation];
  }));

const common = { config: "Config path; default platform path", profile: "Profile name; default credential precedence", fields: "Comma-separated output fields; default compact view", full: "Full text; default false", help: "Show help" };
const paging = { limit: "Output rows; default 100; maximum 10000", offset: "Starting record; default 0", cursor: "Resume the same scoped collection", all: "Read at most 10000 rows; excludes --limit" };
const writes = { execute: "Execute once; default preview", "dry-run": "Explicit preview; excludes --execute", confirm: "Exact confirmation from preview", "intent-id": "Unique execution intent for replay protection" };
type Entry = { description: string; operationId: string; flags: Record<string, string>; defaultFields: string[]; examples: string[] };
export const platformTagCatalogue: Record<string, Entry> = {};
function entry(name: string, operationId: string, flags: Record<string, string>, defaultFields: string[], description: string) {
  const required = [["id", "<id>"], ["name", '"Location"'], ["body-file", "tag.json"], ["asset-id", "<id>"], ["tag-id", "<id>"],
    ["ids-file", "ids.json"], ["asset-ids-file", "assets.json"], ["tag-ids-file", "tags.json"]]
    .filter(([flag]) => Object.hasOwn(flags, flag!)).map(([flag, value]) => `--${flag} ${value}`).join(" ");
  platformTagCatalogue[name] = { operationId, flags: { ...common, ...flags }, defaultFields, description,
    examples: [`tenable-axi ${name} ${required}`.trim(), `tenable-axi ${name} --profile example ${required} --full`] };
}
for (const noun of ["category", "value"]) {
  const category = noun === "category", defaults = category ? ["id", "name", "reserved"] : ["id", "category", "value", "type"];
  const operations = category ? ["tags-list-tag-categories", "tags-tag-category-details", "tags-create-tag-category", "tags-edit-tag-category", "tags-delete-tag-category"]
    : ["tags-list-tag-values", "tags-tag-value-details", "tags-create-tag-value", "tags-update-tag-value", "tags-delete-tag-value"];
  for (const [index, verb] of ["list", "show", "create", "update", "delete"].entries()) entry(`tag ${noun} ${verb}`, operations[index]!, {
    ...(["show", "update", "delete"].includes(verb) ? { id: "Required exact UUID" } : {}),
    ...(verb === "list" ? { ...paging, filter: "Repeatable field:operator:value", "filter-type": "and|or; API default and", sort: "Comma-separated field:asc|desc",
      ...(!category ? { with: "Wildcard search value (w)", "with-filter": "Comma-separated wildcard fields (wf)" } : {}) } : {}),
    ...(["create", "update"].includes(verb) ? category ? { name: "Required category name, at most 127 characters, no colon", description: "Optional description, at most 3000 characters" } : { "body-file": "Required strict tag JSON; '-' for stdin; maximum 1 MiB; no access_control" } : {}),
    ...(["create", "update", "delete"].includes(verb) ? writes : {}),
  }, verb === "delete" ? ["kind", "auditId", "status"] : defaults, `${verb[0]!.toUpperCase()}${verb.slice(1)} platform tag ${noun}`);
}
entry("tag value bulk-delete", "tags-delete-tag-values-bulk", { ...writes, "ids-file": "Required JSON UUID array; '-' for stdin; maximum 1 MiB" }, ["kind", "auditId", "status"], "Preview or delete the exact tag value set");
entry("tag assignment list", "tags-list-asset-tags", { "asset-id": "Required exact asset UUID", limit: paging.limit, cursor: paging.cursor, all: paging.all }, ["assetId", "tagId", "value"], "List tags assigned to one asset");
for (const action of ["add", "remove"]) entry(`tag assignment ${action}`, "tags-assign-asset-tags", { ...writes, "asset-ids-file": "Required JSON asset UUID array; '-' for stdin", "tag-ids-file": "Required JSON tag UUID array; '-' for stdin" }, ["id", "state"], `${action} tags for the exact asset set`);
entry("tag exclusion list", "tags-list-exclusions", { ...paging, "tag-id": "Required exact dynamic tag UUID", "target-type": "assets; API default assets" }, ["targetId", "targetType"], "List assets excluded from a dynamic tag");
entry("tag asset-filter list", "tags-list-asset-filters", { limit: paging.limit, cursor: paging.cursor, all: paging.all }, ["property", "operators"], "List documented dynamic tag filter definitions");
