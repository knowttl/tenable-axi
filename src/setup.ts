import { AxiError } from "axi-sdk-js";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { catalogue } from "./catalogue.js";
import { installHooks } from "./hook-install.js";

export function setupHooks(argv: string[]): Record<string, unknown> {
  const usage = (): never => { throw new AxiError("Invalid hook setup command or flags", "VALIDATION_ERROR", [
    "Valid commands: setup hooks; valid flags: --scope user|project, --help",
  ]); };
  if (argv[1] !== "hooks") usage();
  let scope: "user" | "project" = "user";
  const seen = new Set<string>();
  for (let index = 2; index < argv.length; index++) {
    const flag = argv[index]!;
    if (!["--help", "--scope"].includes(flag) || seen.has(flag)) usage();
    seen.add(flag);
    if (flag === "--scope") {
      const value = argv[++index];
      if (value !== "user" && value !== "project") usage();
      scope = value as typeof scope;
    }
  }
  if (seen.has("--help")) return { command: "setup hooks", ...catalogue["setup hooks"] };
  const entry = fileURLToPath(new URL("../../bin/tenable-axi-hook.js", import.meta.url));
  if (!existsSync(entry)) throw new AxiError("Hook entry point is missing", "HOOK_INSTALL_FAILED", ["Reinstall @knowttl/tenable-axi, then run tenable-axi setup hooks"]);
  const failures: string[] = [];
  installHooks(realpathSync(entry), scope, (message) => { failures.push(message); });
  if (failures.length) throw new AxiError("Agent hook setup did not complete", "HOOK_INSTALL_FAILED", failures);
  return { hooks: { status: "installed", scope, integrations: "Claude Code, Codex, OpenCode" },
    help: ["Restart your agent session; context uses TENABLE_AXI_PROFILE and TENABLE_AXI_CONFIG from the session environment"] };
}
