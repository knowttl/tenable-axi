import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import openapiTS, { astToString, type OpenAPI3 } from "openapi-typescript";
import { inventorySchema } from "../dist/src/inventory/schema.js";
import type { CapabilityInventory } from "../dist/src/inventory/schema.js";

const generate = process.argv[2] === "--generate";
if (!generate && process.argv[2] !== "--check") throw new Error("Use --generate or --check");
const sources = JSON.parse(readFileSync("inventory/specs.json", "utf8")) as CapabilityInventory["sources"];
const design = readFileSync("docs/design.md", "utf8");
const methods = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
const operations: CapabilityInventory["operations"] = [];

function plannedSlice(commands: string[]) {
  const command = commands[0];
  if (!command) return null;
  if (/^(asset|finding|software) /.test(command)) return "T5";
  if (/^(card |tag (list|properties)$)/.test(command)) return "T6";
  if (/^(attack-path|attack-technique|connector) /.test(command)) return "T7";
  if (/^export (asset|finding|inventory) /.test(command)) return "T8";
  if (command.startsWith("export ")) return "T9";
  if (command.startsWith("tag ")) return "T10";
  if (/^(initiative|combination) /.test(command)) return "T11";
  throw new Error(`No implementation slice for ${command}`);
}

function artifact(path: string, content: string) {
  if (generate) writeFileSync(path, content);
  else if (readFileSync(path, "utf8") !== content) throw new Error(`Stale generated artifact: ${path}`);
}

mkdirSync("src/generated", { recursive: true });
for (const source of sources) {
  const bytes = readFileSync(`specs/${source.id}.json`);
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) {
    throw new Error(`Pinned specification hash mismatch: ${source.id}`);
  }
  const spec = JSON.parse(bytes.toString()) as OpenAPI3;
  // Generation must stay offline, even if a future snapshot adds external references.
  function checkRefs(value: unknown) {
    if (!value || typeof value !== "object") return;
    if ("$ref" in value && typeof value.$ref === "string" && !value.$ref.startsWith("#/")) throw new Error("External $ref is forbidden");
    for (const child of Object.values(value)) checkRefs(child);
  }
  checkRefs(spec);
  const section = design.split(`### ${source.id}.json\n`)[1]?.split("\n### ")[0];
  if (!section) throw new Error(`Missing design ledger: ${source.id}`);
  const ledger = [...section.matchAll(/^\| `([^`]+)` \| `([A-Z]+) ([^`]+)` \| (v1-read|v1-write|blocked) \| (.*?) \| (.*?) \|$/gm)];
  const seen = new Set();
  for (const [path, item] of Object.entries(spec.paths!)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!methods.has(method)) continue;
      const matches = ledger.filter((row) => row[1] === operation.operationId && row[2] === method.toUpperCase() && row[3] === path);
      if (matches.length !== 1) throw new Error(`Operation needs exactly one classification: ${method} ${path}`);
      const row = matches[0] as unknown as [string, string, string, string, CapabilityInventory["operations"][number]["disposition"], string, string];
      if (seen.has(operation.operationId)) throw new Error(`Duplicate operation ID: ${operation.operationId}`);
      seen.add(operation.operationId);
      const plannedCommands = row[5] === "-" ? [] : row[5]!.replaceAll("`", "").split(" / ");
      if ((row[4] === "blocked") !== (plannedCommands.length === 0)) throw new Error("Blocked operation cannot have a planned command");
      operations.push({ source: source.id, operationId: operation.operationId, method: method.toUpperCase() as CapabilityInventory["operations"][number]["method"], path,
        disposition: row[4], plannedCommands, reason: row[6], slice: plannedSlice(plannedCommands) });
    }
  }
  if (seen.size !== source.operations || ledger.length !== seen.size) throw new Error(`Incomplete ledger: ${source.id}`);
  const declarations = astToString(await openapiTS(spec));
  artifact(`src/generated/${source.id}.d.ts`, declarations);
}
const inventory = inventorySchema.parse({ schemaVersion: 1, sources, operations });
artifact("inventory/capabilities.json", `${JSON.stringify(inventory, null, 2)}\n`);
const counts = Object.fromEntries(["v1-read", "v1-write", "blocked"].map((kind) => [kind, operations.filter((op) => op.disposition === kind).length]));
if (operations.length !== 360 || counts["v1-read"] !== 31 || counts["v1-write"] !== 19 || counts.blocked !== 310) {
  throw new Error("Inventory differs from the accepted 360-operation scope");
}
console.log(`${generate ? "Generated" : "Verified"} pinned specs, declarations and ${operations.length} classifications: ${JSON.stringify(counts)}`);
