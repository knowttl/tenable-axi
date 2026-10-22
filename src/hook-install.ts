import { computeCodexConfigUpdate, computeSessionStartHookUpdate, extractNpmShimScriptPath, resolvePortableHookCommand } from "axi-sdk-js";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";

export function installHooks(execPath: string, scope: "user" | "project", onError: (message: string) => void): void {
  const marker = "tenable-axi-hook";
  const home = homedir();
  const root = scope === "project" ? process.cwd() : home;
  const command = resolvePortableHookCommand(execPath, [marker], marker, {
    pathEntries: (process.env.PATH ?? process.env.Path ?? "").split(delimiter),
    pathExtensions: process.platform === "win32" ? ["", ...(process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")] : [""],
    resolveRealPath: (path) => {
      try { return statSync(path).isFile() ? realpathSync(path) : undefined; } catch { return undefined; }
    },
    resolveShimTarget: (path) => {
      try {
        const target = extractNpmShimScriptPath(readFileSync(path, "utf8"));
        return target ? realpathSync(resolve(dirname(path), target)) : undefined;
      } catch { return undefined; }
    },
  });
  const shellCommand = command === marker ? command : `'${command.replaceAll("'", "'\\''")}'`;
  const update = (path: string, transform: (content: string) => string) => {
    try {
      const current = existsSync(path) ? readFileSync(path, "utf8") : "";
      const next = transform(current);
      if (current !== next) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, next, "utf8");
      }
    } catch (error) { onError(`${path}: ${error instanceof Error ? error.message : String(error)}`); }
  };
  for (const path of [join(root, ".claude/settings.json"), join(root, ".codex/hooks.json")]) {
    update(path, (current) => {
      const [next, changed] = computeSessionStartHookUpdate(current ? JSON.parse(current) : {}, { marker, command: shellCommand });
      return changed ? `${JSON.stringify(next, null, 2)}\n` : current;
    });
  }
  update(join(home, ".codex/config.toml"), (current) => computeCodexConfigUpdate(current)[0]);
  const managedMarker = `axi-sdk-js managed opencode plugin: ${marker}`;
  update(join(scope === "project" ? join(root, ".opencode") : join(home, ".config/opencode"), "plugins/axi-tenable-axi-hook.js"), (current) => {
    if (current && !current.includes(managedMarker)) throw new Error("refusing to overwrite unmanaged OpenCode plugin");
    return `// ${managedMarker}
import { execFile } from "node:child_process";

function ambientContext(directory) {
  const sessions = new Map();
  return (sessionID) => {
    if (!sessions.has(sessionID)) {
      sessions.set(sessionID, new Promise((resolve) => {
        execFile(${JSON.stringify(command)}, [], { cwd: directory, timeout: 10000 }, (error, stdout, stderr) => {
          const text = error ? "error: tenable-axi-hook ambient context failed: " + (stderr || stdout || error.message).trim() : stdout.trim();
          resolve(text ? "## AXI ambient context: tenable-axi-hook\\n" + text : "");
        });
      }));
    }
    return sessions.get(sessionID);
  };
}

export default {
  id: "axi-tenable-axi-hook",
  async setup(ctx) {
    const context = ambientContext(ctx.location.directory);
    await ctx.session.hook("context", async (event) => {
      const text = await context(event.sessionID);
      if (text) event.system.push({ type: "text", text });
    });
  },
  async server({ directory }) {
    const context = ambientContext(directory);
    return { "experimental.chat.system.transform": async (input, output) => {
      const text = await context(input.sessionID);
      if (text) output.system.push(text);
    } };
  },
};
`;
  });
}
