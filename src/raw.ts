import { AxiError } from "axi-sdk-js";
import { closeSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { catalogue } from "./catalogue.js";
import type { TransportFactory } from "./exposure.js";
import { bodyFile, type WriteCoordinatorFactory } from "./inventory-export.js";
import type { credentialStore } from "./profiles.js";
import { createTransport } from "./transport.js";
import { createWriteCoordinator } from "./writes.js";

const accessControlRoute = /(?:^|\/)(?:users?|(?:access-)?groups?|roles?|permissions?|access-control|credentials?|share|(?:[a-z0-9._~]+-)*keys?|apikeys?)(?:\/|$)/i;
const apiPath = z.string()
  .regex(/^\/[A-Za-z0-9._~/-]+$/)
  .refine((path) => !/(?:^|\/)\.{1,2}(?:\/|$)|\/\//.test(path))
  .refine((path) => !accessControlRoute.test(path));
const writeMethod = z.enum(["POST", "PUT", "PATCH", "DELETE"]);

export async function rawCommand(argv: string[], store: ReturnType<typeof credentialStore>,
  factory: TransportFactory = createTransport, writeFactory: WriteCoordinatorFactory = createWriteCoordinator,
  output: (chunk: Uint8Array, contentType: string | null, signal: AbortSignal) => void | Promise<void> = () => {}): Promise<Record<string, unknown>> {
  const name = argv.slice(0, 2).join(" ");
  const entry = catalogue[name as keyof typeof catalogue];
  const usage = (message: string): never => { throw new AxiError(message, "VALIDATION_ERROR", [entry
    ? `Valid flags for ${name}: ${Object.keys(entry.flags).map((flag) => `--${flag}`).join(", ")}`
    : "Valid commands: raw get, raw write"]); };
  if (!entry) usage("Unknown raw command");
  const flags = new Map<string, string>();
  for (let index = 2; index < argv.length; index++) {
    const flag = argv[index]!;
    if (!flag.startsWith("--") || !Object.hasOwn(entry!.flags, flag.slice(2)) || flags.has(flag)) usage(`Unknown argument, flag, or duplicate flag: ${flag}`);
    const value = ["--help", "--execute", "--dry-run"].includes(flag) ? "true" : argv[++index];
    if (!value || value.startsWith("--")) usage(`Missing value for ${flag}`);
    flags.set(flag, value!);
  }
  const get = (key: string) => flags.get(`--${key}`);
  if (get("help")) return { command: name, ...entry };
  const path = apiPath.safeParse(get("path")).data ?? usage("--path must be an absolute Tenable API path of letters, digits, dots, dashes, underscores, tildes and slashes, without dot segments or access-control routes");
  const params = new URLSearchParams(get("query") ?? "");
  const query = Object.fromEntries([...new Set(params.keys())].map((key) => [key, params.getAll(key)]));
  if (argv[1] === "get") {
    const profile = store.select(store.load(get("config")).config, get("profile"));
    const transport = factory({ keys: store.credentials(profile), origin: profile.origin });
    const out = get("out");
    let fd: number | undefined;
    let completed = false;
    try {
      const response = await transport.request("raw-get", { raw: { method: "GET", path }, query, rawOutput: async (contentType, signal) => {
        if (out) fd = openSync(out, "wx", 0o600);
        if (!out) await output(new Uint8Array(), contentType, signal);
        return (chunk) => { if (fd !== undefined) writeFileSync(fd, chunk); else return output(chunk, contentType, signal); };
      } });
      completed = true;
      return out ? { status: response.status, contentType: response.contentType, output: out } : {};
    } finally {
      if (fd !== undefined) { closeSync(fd); if (!completed) unlinkSync(out!); }
    }
  }
  const method = writeMethod.safeParse(get("method")).data ?? usage("--method must be POST, PUT, PATCH or DELETE");
  let body: unknown;
  if (get("body-file")) {
    try { body = bodyFile(get("body-file")!); } catch { usage("Cannot read --body-file as JSON within the 1 MiB limit"); }
  }
  const result = await writeFactory({ config: get("config"), profile: get("profile") }).run("raw-write", { query, body },
    { execute: get("execute") === "true", dryRun: get("dry-run") === "true", confirm: get("confirm"), intentId: get("intent-id") },
    { method, path }, async (contentType, signal) => {
      await output(new Uint8Array(), contentType, signal);
      return (chunk) => output(chunk, contentType, signal);
    });
  if (result.kind !== "success") return result;
  return {};
}
