import { AxiError } from "axi-sdk-js";
import { catalogue } from "./catalogue.js";
import { credentialStore } from "./profiles.js";

export function localCommand(argv: string[], store: ReturnType<typeof credentialStore>): Record<string, unknown> {
  const name = argv.slice(0, 2).join(" ");
  const entry = catalogue[name as keyof typeof catalogue];
  const usage = (): never => { throw new AxiError("Unknown command, argument, duplicate or invalid flag", "VALIDATION_ERROR", [
    "Valid commands: auth status, profile list, config path; valid flags: --config <path>, --profile <name>, --fields <names>, --full, --help",
  ]); };
  if (!entry || name === "home") usage();
  const flags = new Map<string, string>();
  for (let index = 2; index < argv.length; index++) {
    const flag = argv[index]!;
    if (!flag.startsWith("--") || !Object.hasOwn(entry.flags, flag.slice(2)) || flags.has(flag)) usage();
    if (flag === "--help" || flag === "--full") flags.set(flag, "true");
    else {
      const value = argv[++index];
      if (!value || value.startsWith("--")) usage();
      flags.set(flag, value!);
    }
  }
  if (flags.has("--help")) return { command: name, ...entry };
  // Validation, including output selection, must finish before reading credentials.
  const available = name === "auth status" ? ["profile", "source", "origin", "accessKey", "secretKey", "readOnly"]
    : name === "profile list" ? ["profiles", "count", "config"] : ["config", "state"];
  const fields = flags.get("--fields")?.split(",") ?? available;
  if (fields.some((field) => !available.includes(field)) || new Set(fields).size !== fields.length) usage();
  const config = flags.get("--config");
  let result: Record<string, unknown>;
  if (name === "auth status") result = store.status(config, flags.get("--profile"));
  else if (name === "profile list") result = store.list(config);
  else result = { config: store.configPath(config), state: store.statePath() };
  return Object.fromEntries(fields.map((field) => [field, result[field]]));
}
