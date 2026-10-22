import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { decode } from "@toon-format/toon";
import { main } from "../../src/cli.js";
import type { CredentialContext } from "../../src/profiles.js";

export function localFixture() {
  const home = mkdtempSync(join(tmpdir(), "tenable-axi-local-"));
  const env: NodeJS.ProcessEnv = { XDG_CONFIG_HOME: join(home, "config"), XDG_STATE_HOME: join(home, "state") };
  const path = join(home, "config/tenable-axi/config.json");
  function config(profiles: unknown = { example: {} }, extra: Record<string, unknown> = {}) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify({ version: 1, profiles, ...extra }), { mode: 0o600 });
    return path;
  }
  async function cli(args: string[], context: CredentialContext = {}, transportFactory?: NonNullable<Parameters<typeof main>[1]>["transportFactory"]) {
    let stdout = "";
    const previous = process.exitCode;
    process.exitCode = 0;
    try {
      await main(args, { credentials: { home, env, ...context }, transportFactory, stdout: { write: (chunk) => { stdout += chunk; } } });
      return { code: process.exitCode, stdout, data: decode(stdout) as Record<string, unknown> };
    } finally { process.exitCode = previous; }
  }
  return { home, env, path, config, cli, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}
