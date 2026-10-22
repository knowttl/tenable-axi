import { z } from "zod";
import { TransportError, type OperationBinding } from "./transport-core.js";
import type { MutationOperation } from "./writes-core.js";

const uuid = z.string().uuid();
type Query = { property: string; operator: string; value?: string | number | boolean | (string | number)[] } | { and: Query[] } | { or: Query[] };
const query: z.ZodType<Query> = z.lazy(() => z.union([
  z.strictObject({ property: z.string().min(1), operator: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]).optional() })
    .refine((value) => ["exists", "nexists"].includes(value.operator) || value.value !== undefined),
  z.strictObject({ and: z.array(query).min(1).max(6) }), z.strictObject({ or: z.array(query).min(1).max(6) }),
]));
function queryCount(value: unknown): number {
  if (!value || typeof value !== "object") return Infinity;
  const row = value as Record<string, unknown>;
  if (typeof row.property === "string") return 1;
  const children = row.and ?? row.or;
  return Array.isArray(children) && children.length ? children.reduce<number>((sum, child) => sum + queryCount(child), 0) : Infinity;
}
export const responseBodies = {
  combination: z.strictObject({ name: z.string().min(1).max(128), description: z.string().max(1024).optional(),
    is_public: z.boolean(), query: query.refine((value) => queryCount(value) <= 6) }),
  initiative: z.strictObject({ name: z.string().min(1).max(128), description: z.string().max(1024).optional(), owner: uuid,
    sla_in_days: z.number().int().min(-2147483648).max(2147483647), scope: z.array(uuid).max(10),
    combination_ids: z.array(uuid).max(10), tenable_ids: z.array(uuid).max(10) }),
};
export type ResponseKind = keyof typeof responseBodies;
const record = z.object({ id: uuid, name: z.string() }).passthrough();
const filter = z.object({ name: z.string(), operators: z.array(z.string()) }).passthrough();
export const responseBindings: Record<string, OperationBinding> = {};
export const responseMutations: Record<string, MutationOperation> = {};
export const responseCatalogue: Record<string, { description: string; operationId: string; flags: Record<string, string>; defaultFields: string[]; examples: string[]; evidence: string }> = {};
const common = { config: "Config path; default credential precedence", profile: "Profile name; default credential precedence",
  fields: "Comma-separated fields; default compact view", full: "Full text; default false", help: "Show help" };
const paging = { limit: "Output rows; default 100, maximum 10000", all: "Up to 10000 rows; excludes --limit", cursor: "Resume the same unpaged collection; requires original selectors" };
const write = { execute: "Send once; default preview", "dry-run": "Preview only; excludes --execute", confirm: "Exact preview confirmation; required to execute" };
const fail = (code: string, message: string, operation: string): never => { throw new TransportError({ code, message, operation }); };
const canonical = (value: unknown): string => JSON.stringify(value && typeof value === "object"
  ? Array.isArray(value) ? value.map((item) => JSON.parse(canonical(item)))
    : Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, JSON.parse(canonical(child))])) : value);

for (const kind of ["initiative", "combination"] as const) {
  const plural = `${kind}s`;
  const path = `/exposure-response/${plural}`;
  for (const verb of ["list", "show", "create", "update", "delete"] as const) {
    const operation = `${plural}-${verb === "show" ? "details" : verb}`;
    const mutating = ["create", "update", "delete"].includes(verb);
    const selected = ["show", "update", "delete"].includes(verb);
    const permission = mutating ? verb === "create" ? "CREATE" : verb === "delete" ? "DELETE" : "EDIT" : "READ";
    responseBindings[operation] = { method: verb === "create" ? "POST" : verb === "update" ? "PUT" : verb === "delete" ? "DELETE" : "GET",
      path: selected ? `${path}/{${kind}_id}` : path, effect: mutating ? "write" : "read",
      query: verb === "list" && kind === "combination" ? ["type"] : [],
      decoder: verb === "list" ? z.object({ [plural]: z.array(record) }) : verb === "delete" ? z.object({}).passthrough()
        : verb === "create" ? z.object({ id: uuid }) : record,
      permissionHelp: `Requires EXPOSURE_MANAGEMENT.EM_ER.EM_ER.${permission} or VM.VM_ER.VM_ER.${permission}; check the selected user's role and ownership`,
      validationHelp: `Run tenable-axi ${kind} ${verb} --help; combination queries use combination filters, with six queries per combination and seventeen per initiative` };
    responseCatalogue[`${kind} ${verb}`] = { description: `${mutating ? "Preview or " : ""}${verb} ${kind}${verb === "list" ? "s" : ""}`,
      operationId: operation, flags: { ...common, ...(verb === "list" ? { ...paging, ...(kind === "combination" ? { type: "private, shared or tenable; default all accessible" } : {}) } : {}),
        ...(selected ? { id: "Required exact UUID" } : {}), ...(mutating ? write : {}),
        ...(["create", "update"].includes(verb) ? { "body-file": "Required strict JSON, at most 1 MiB; '-' reads stdin" } : {}) },
      defaultFields: mutating ? ["id"] : verb === "show" ? kind === "initiative"
        ? ["id", "name", "description", "owner", "slaInDays", "scope", "combination_ids", "tenable_ids"]
        : ["id", "name", "description", "type", "query"] : kind === "initiative" ? ["id", "name", "owner", "slaInDays"] : ["id", "name", "type"],
      examples: [`tenable-axi ${kind} ${verb}${selected ? " --id <id>" : ""}${["create", "update"].includes(verb) ? " --body-file body.json" : ""}`,
        `tenable-axi ${kind} ${verb} --help`], evidence: "specs/vulnerability-management.json" };
    if (!mutating) continue;
    const input = z.strictObject({ ...(selected ? { id: uuid } : {}), ...(verb === "delete" ? {} : { body: responseBodies[kind] }) });
    responseMutations[operation] = { input,
      prepare(raw) {
        const { id, body } = raw as { id?: string; body?: { name: string } };
        return { target: id ? { kind, id } : { kind, name: body!.name }, request: { ...(id ? { pathParams: { [`${kind}_id`]: id } } : {}), ...(body ? { body } : {}) } };
      },
      async current(transport, raw) {
        const { id, body } = raw as { id?: string; body?: Record<string, unknown> };
        let existing: Record<string, unknown> | undefined;
        // A list verifies absence; a detail 404 alone never establishes a no-op.
        if (verb !== "update") {
          const listed = (await transport.request(`${plural}-list`)).body as Record<string, Record<string, unknown>[]>;
          const matches = listed[plural]!.filter((row) => id ? row.id === id : row.name === body!.name);
          if (matches.length > 1) fail("RESPONSE_INVALID", "Multiple resources matched the exact target", operation);
          existing = matches[0];
        }
        if (verb === "update" || existing) {
          const targetId = id ?? existing!.id as string;
          existing = (await transport.request(`${plural}-details`, { pathParams: { [`${kind}_id`]: targetId } })).body as Record<string, unknown>;
          if (existing.id !== targetId) fail("RESPONSE_INVALID", "Details returned a different target", operation);
        }
        const combinations: unknown[] = [];
        if (kind === "initiative" && body) {
          let count = 0;
          const ids = [...new Set([...body.combination_ids as string[], ...body.tenable_ids as string[]])].sort();
          // One unpaged read keeps even large valid selections inside the shared request budget on both state reads.
          if (ids.length) {
            const listed = (await transport.request("combinations-list")).body as { combinations: Record<string, unknown>[] };
            for (const combinationId of ids) {
              const matches = listed.combinations.filter((row) => row.id === combinationId);
              if (!matches.length) fail("NOT_FOUND", "A selected combination is unavailable; check explicit IDs and read privileges", operation);
              if (matches.length !== 1 || !query.safeParse(matches[0]!.query).success) fail("RESPONSE_INVALID", "Selected combination has an invalid or ambiguous query", operation);
              count += queryCount(matches[0]!.query);
              combinations.push(matches[0]);
            }
          }
          if (count > 17) fail("VALIDATION_ERROR", "Initiatives support at most seventeen queries across all selected combinations", operation);
        }
        let identical = false;
        if (existing && body) {
          const proposed = { description: "", ...body };
          const current = Object.fromEntries(Object.keys(proposed).map((key) => [key, key === "description" ? existing![key] ?? "" : existing![key]]));
          identical = Object.values(current).every((value) => value !== undefined) && canonical(current) === canonical(proposed);
          if (verb === "create" && !identical) fail("CONFLICT", "The proposed name already exists with different or unverified state", operation);
        }
        return { state: { existing: existing ?? null, combinations }, noop: verb === "delete" ? !existing : identical };
      },
      effect: kind === "combination" ? `${verb} a combination; is_public=true shares it across the organization, false keeps it private; existing initiatives may change`
        : `${verb} an initiative with the explicit owner, asset scope, combinations and SLA; owner assignment remains subject to upstream permissions`,
      readBackHelp: [`Run tenable-axi ${kind} list or ${kind} show --id <known-id> before retrying; an interrupted mutation may have succeeded`],
    };
  }
}
responseBindings["combinations-filters-list"] = { method: "GET", path: "/exposure-response/combinations/allowed/filters", effect: "read", query: [],
  decoder: z.object({ filters: z.array(filter) }), permissionHelp: "Check Exposure Response read privileges",
  validationHelp: "Run tenable-axi combination filters" };
responseCatalogue["combination filters"] = { description: "List allowed combination query properties and operators", operationId: "combinations-filters-list",
  flags: { ...common, ...paging }, defaultFields: ["property", "operators"], examples: ["tenable-axi combination filters", "tenable-axi combination filters --fields property,operators,type"], evidence: "specs/vulnerability-management.json" };
