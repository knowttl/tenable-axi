import { createHash, randomUUID } from "node:crypto";
import { lstatSync } from "node:fs";
import { isAbsolute, join, resolve, win32 } from "node:path";
import { z } from "zod";
import { credentialStore, type CredentialContext } from "./profiles.js";
import { privateFiles } from "./private-file.js";
import { constructTransport, TransportError, type OperationBinding, type RequestOptions, type Transport } from "./transport-core.js";

export type MutationTarget =
  | { kind: string; id: string }
  | { kind: string; name: string }
  | { kind: string; ids: readonly string[] }
  | { kind: string; payload: true };

// Only reviewed domain definitions supply schemas, target selection and read-back.
// A state reader reports no-op only when upstream reads establish desired state.
export type MutationOperation = Readonly<{
  input: z.ZodType;
  prepare(input: unknown): { target: MutationTarget; request: Pick<RequestOptions, "pathParams" | "query" | "body"> };
  current?: (transport: Pick<Transport, "request">, input: unknown) => Promise<{ state: unknown; noop?: boolean }>;
  effect: string;
  readBackHelp: readonly string[];
}>;
export type MutationPreview = Readonly<{
  profile: string; operation: string; target: MutationTarget; effect: string;
  current: unknown; proposed: unknown; confirm: string; noop: boolean;
}>;
export type WriteCoordinatorOptions = {
  config?: string; profile?: string; readOnly?: boolean;
  approval?: (preview: MutationPreview) => boolean | Promise<boolean>;
};
export type MutationOptions = { execute?: boolean; dryRun?: boolean; confirm?: string; intentId?: string };

function canonical(value: unknown): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, normalize(child)]));
    return value;
  };
  return JSON.stringify(normalize(value));
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const auditRecord = z.strictObject({
  kind: z.enum(["intent", "outcome"]), time: z.string().datetime(), auditId: z.string().uuid(),
  intentKey: z.string().regex(/^[a-f0-9]{64}$/), profile: z.string(), operation: z.string(),
  target: z.string().regex(/^[a-f0-9]{64}$/), effect: z.literal("write"), status: z.number().int().min(100).max(599).optional(),
  result: z.enum(["SUCCESS", "FAILED", "NOT_SENT", "OUTCOME_UNKNOWN"]).optional(),
}).superRefine((record, context) => {
  const validOutcome = record.result === "SUCCESS" ? record.status !== undefined && record.status >= 200 && record.status < 300
    : record.result === "FAILED" ? record.status !== undefined && record.status >= 300
      : (record.result === "NOT_SENT" || record.result === "OUTCOME_UNKNOWN") && record.status === undefined;
  if (record.kind === "intent" ? record.status !== undefined || record.result !== undefined : !validOutcome) {
    context.addIssue({ code: "custom", message: "Invalid journal record" });
  }
});

// Internal seam, like constructTransport: production supplies the closed catalogue
// and native fetch. Tests supply synthetic operations and fake Tenable only.
export function constructWriteCoordinator(options: WriteCoordinatorOptions, dependencies: {
  operations: Readonly<Record<string, MutationOperation>>;
  bindings: Readonly<Record<string, OperationBinding>>;
  fetch: typeof globalThis.fetch;
  credentials?: CredentialContext;
  files?: ReturnType<typeof privateFiles>;
}) {
  options = { ...options };
  const store = credentialStore(dependencies.credentials);
  const profile = store.select(store.load(options.config).config, options.profile);
  const forced = store.readOnly() || options.readOnly === true;
  const scope = Object.freeze({ profile: profile.name, origin: profile.origin,
    allowWrites: profile.source !== "env-profile" && profile.writes.allowWrites,
    operations: Object.freeze([...profile.writes.operations]) });
  const definitions = Object.fromEntries(Object.entries(dependencies.operations).map(([name, definition]) =>
    [name, { ...definition, readBackHelp: [...definition.readBackHelp] }]));
  const bindings = Object.fromEntries(Object.entries(dependencies.bindings).map(([name, binding]) =>
    [name, { ...binding, query: [...binding.query], paging: [...(binding.paging ?? [])] }]));
  const env = dependencies.credentials?.env ?? process.env;
  const override = env.TENABLE_AXI_WRITE_LOG?.trim();
  const platform = dependencies.credentials?.platform ?? process.platform;
  const journalPath = override ? (platform === "win32" ? win32.resolve(override) : resolve(override))
    : (platform === "win32" ? win32.join : join)(store.statePath(), "writes.log");
  if (override && !(platform === "win32" ? /^[A-Za-z]:[\\/]/.test(override) : isAbsolute(override))) {
    throw new TransportError({ code: "CONFIG_INVALID", message: "TENABLE_AXI_WRITE_LOG must be an absolute path", operation: "writes" });
  }
  const files = dependencies.files ?? privateFiles(dependencies.credentials);
  let transport: Transport | undefined;
  const authorizations = new WeakMap<object, string>();
  function sender(): Transport {
    return transport ??= constructTransport({ keys: store.credentials(profile), origin: scope.origin }, {
      bindings, fetch: dependencies.fetch,
      consumeWriteAuthorization(authorization, request) {
        if (!authorization || typeof authorization !== "object") return false;
        const expected = authorizations.get(authorization);
        authorizations.delete(authorization);
        return expected !== undefined && expected === canonical(request);
      },
    });
  }
  function fail(code: string, message: string, operation: string, help: readonly string[] = [], auditId?: string): never {
    throw new TransportError({ code, message, operation, ...(auditId ? { auditId } : {}) }, help);
  }
  function record(value: z.infer<typeof auditRecord>): void {
    let release: (() => void) | undefined;
    try {
      release = files.lock(`${journalPath}.lock`);
      let contents = "";
      try { lstatSync(journalPath); contents = files.read(journalPath, true, true); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (contents && !contents.endsWith("\n")) throw new Error("Incomplete journal");
      const records = contents ? contents.slice(0, -1).split("\n").map((line) => auditRecord.parse(JSON.parse(line))) : [];
      const intents = new Map<string, z.infer<typeof auditRecord>>();
      const outcomes = new Set<string>();
      for (const prior of records) {
        if (prior.kind === "intent") {
          if (intents.has(prior.intentKey)) throw new Error("Duplicate intent");
          intents.set(prior.intentKey, prior);
        } else {
          const intent = intents.get(prior.intentKey);
          if (!intent || outcomes.has(prior.intentKey) || intent.auditId !== prior.auditId
            || intent.profile !== prior.profile || intent.operation !== prior.operation || intent.target !== prior.target || intent.effect !== prior.effect) throw new Error("Invalid outcome");
          outcomes.add(prior.intentKey);
        }
      }
      if (value.kind === "intent" && intents.has(value.intentKey)) {
        fail("ALREADY_EXECUTED", "Intent was already reserved; reconcile it without replay", value.operation, [], value.auditId);
      }
      if (value.kind === "outcome" && (!intents.has(value.intentKey) || outcomes.has(value.intentKey))) throw new Error("Missing intent");
      files.write(journalPath, `${contents}${JSON.stringify(auditRecord.parse(store.redactor.payload(value)))}\n`);
      release();
      release = undefined;
    } catch (error) {
      if (error instanceof TransportError && error.error.code === "ALREADY_EXECUTED") throw error;
      fail(value.kind === "intent" ? "INTENT_NOT_RECORDED" : "OUTCOME_UNKNOWN",
        value.kind === "intent" ? "Intent could not be recorded; mutation was not sent" : "Outcome could not be recorded; remote success is possible",
        value.operation, ["Reconcile the private journal and any remaining lock manually; read back the target before retrying"], value.auditId);
    } finally {
      // An unresolved lock remains a fail-closed condition for later invocations.
      if (release) {
        try { release(); } catch { /* Preserve the structured journal failure. */ }
      }
    }
  }

  async function run(operation: string, input: unknown, flags: MutationOptions = {}) {
    flags = { ...flags };
    const definition = Object.hasOwn(definitions, operation) ? definitions[operation] : undefined;
    if (!definition || bindings[operation]?.effect !== "write") fail("OPERATION_BLOCKED", "Operation has no reviewed write binding", operation);
    const parsed = definition!.input.safeParse(input);
    if (!parsed.success) fail("VALIDATION_ERROR", "Invalid mutation input; check the named operation's schema", operation);
    const prepared = definition!.prepare(JSON.parse(canonical(parsed.data)) as unknown);
    const request = JSON.parse(canonical(prepared.request)) as RequestOptions;
    const target = JSON.parse(canonical(prepared.target)) as MutationTarget;
    const securityField = (value: unknown): boolean => !!value && typeof value === "object" && Object.entries(value).some(([key, child]) =>
      /^(?:access_control|permissions|roles|credentials|api_keys)$/i.test(key) || securityField(child));
    if (securityField(request.body)) fail("VALIDATION_ERROR", "Security administration payloads are blocked", operation);
    const uuid = z.string().uuid();
    if (!target.kind?.trim() || ("id" in target ? !uuid.safeParse(target.id).success
      : "name" in target ? !target.name.trim() : "ids" in target ? !target.ids.length || target.ids.some((id) => !uuid.safeParse(id).success)
        : target.payload !== true)) fail("VALIDATION_ERROR", "An exact mutation target is required", operation);
    if ("ids" in target) target.ids = [...new Set(target.ids)].sort();
    if (flags.execute && flags.dryRun) fail("VALIDATION_ERROR", "--execute and --dry-run are mutually exclusive", operation);
    if (forced || store.readOnly() || !scope.allowWrites) fail("WRITES_DISABLED", "Writes are disabled for the selected profile", operation);
    if (!scope.operations.includes(operation)) fail("OPERATION_NOT_WRITABLE", "Operation is outside the configured write scope", operation);
    const connection = sender();
    const plan = connection.prepare(operation, request);
    const { effect: _effect, ...identity } = plan;
    const confirmationTarget = "payload" in target ? { kind: target.kind, digest: digest(canonical(request)) } : target;
    const confirm = canonical([scope.profile, operation, confirmationTarget]);
    const reader = { request: async (name: string, options?: RequestOptions) => {
      if (connection.prepare(name, options).effect !== "read") fail("OPERATION_BLOCKED", "State readers cannot send writes", operation);
      return connection.request(name, options);
    } };
    const current = await definition!.current?.(reader, parsed.data);
    const state = canonical(current?.state ?? null);
    const preview = store.redactor.payload({ profile: scope.profile, operation, target, effect: definition!.effect,
      current: current?.state ?? null, proposed: request, confirm, noop: current?.noop === true }) as MutationPreview;
    if (!flags.execute) return { kind: "dry-run" as const, preview };
    if (preview.noop) return { kind: "noop" as const, preview };
    // Redaction must never turn an exact-target check into a different approval.
    if (preview.confirm !== confirm) fail("CONFIRM_UNSAFE", "Target contains credential material; choose a safe target", operation);
    if (flags.confirm !== confirm) fail(flags.confirm === undefined ? "CONFIRM_REQUIRED" : "CONFIRM_MISMATCH", "Pass --confirm equal to the exact preview confirmation", operation);
    if (options.approval && !await options.approval(structuredClone(preview))) fail("APPROVAL_DENIED", "Host approval was denied", operation);
    if (flags.intentId !== undefined && !flags.intentId.trim()) fail("VALIDATION_ERROR", "Intent ID must not be blank", operation);
    const auditId = randomUUID();
    const meta = { auditId, intentKey: digest(flags.intentId ?? auditId), profile: scope.profile, operation,
      target: digest(canonical(confirmationTarget)), effect: "write" as const };
    const append = (kind: "intent" | "outcome", result?: z.infer<typeof auditRecord>["result"], status?: number) => record({ ...meta, kind,
      time: new Date().toISOString(), ...(result === undefined ? {} : { result }), ...(status === undefined ? {} : { status }) });
    append("intent");
    try {
      const fresh = await definition!.current?.(reader, parsed.data);
      if (canonical(fresh?.state ?? null) !== state) fail("PREVIEW_CHANGED", "Target changed after preview; review it again", operation);
    } catch (error) { append("outcome", "NOT_SENT"); throw error; }
    const authorization = Object.freeze({});
    authorizations.set(authorization, canonical(identity));
    let response: { status: number; body: unknown };
    try { response = await connection.request(operation, { ...request, authorization }); }
    catch (error) {
      authorizations.delete(authorization);
      const upstream = error instanceof TransportError ? error : undefined;
      const status = upstream?.error.status;
      const unknown = upstream?.error.code === "OUTCOME_UNKNOWN" || status === undefined;
      append("outcome", unknown ? "OUTCOME_UNKNOWN" : status! >= 200 && status! < 300 ? "SUCCESS" : "FAILED", status);
      if (unknown) fail("OUTCOME_UNKNOWN", "Mutation may have been applied; never replay this intent", operation, definition!.readBackHelp, auditId);
      throw new TransportError({ ...upstream!.error, auditId }, upstream!.help);
    }
    append("outcome", "SUCCESS", response.status);
    return { kind: "success" as const, preview, auditId, status: response.status, response: store.redactor.payload(response.body) };
  }
  return { scope, run };
}
