import { computeSessionStartHookUpdate, extractNpmShimScriptPath, type HookEntry } from "axi-sdk-js";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { parse, stringify, type TomlTable } from "smol-toml";

function portableHookCommand(execPath: string, name: string): string {
  const extensions = process.platform === "win32" ? ["", ...(process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")] : [""];
  for (const directory of (process.env.PATH ?? process.env.Path ?? "").split(delimiter)) {
    for (const extension of extensions) {
      const candidate = resolve(directory || ".", `${name}${extension}`);
      try {
        if (!statSync(candidate).isFile()) continue;
        accessSync(candidate, constants.X_OK);
      } catch { continue; }
      try {
        if (realpathSync(candidate) === execPath) return name;
        if (process.platform === "win32") {
          const target = extractNpmShimScriptPath(readFileSync(candidate, "utf8"));
          if (target && realpathSync(resolve(dirname(candidate), target)) === execPath) return name;
        }
      } catch { return execPath; }
      return execPath;
    }
  }
  return execPath;
}

export function installHooks(execPath: string, scope: "user" | "project", onError: (message: string) => void): void {
  const marker = "tenable-axi-hook";
  const home = homedir();
  const root = scope === "project" ? process.cwd() : home;
  const command = portableHookCommand(execPath, marker);
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
      const settings = current ? JSON.parse(current) : {};
      for (const group of settings.hooks?.SessionStart ?? []) {
        for (const hook of group.hooks ?? []) {
          if (Array.isArray(hook.args) && hook.args.some((arg: unknown) => typeof arg === "string" && arg.includes(marker))) {
            hook.command = shellCommand;
          }
        }
      }
      const [next] = computeSessionStartHookUpdate(settings, { marker, command: shellCommand });
      const hook = next.hooks!.SessionStart!.flatMap((group) => group.hooks ?? [])
        .find((hook) => hook.command === shellCommand)! as HookEntry & { args?: string[]; commandWindows?: string };
      delete hook.args;
      delete hook.commandWindows;
      if (process.platform === "win32") {
        if (path === join(root, ".claude/settings.json")) {
          hook.command = process.execPath;
          hook.args = [execPath];
        } else {
          const argv = Buffer.from(JSON.stringify([process.execPath, execPath])).toString("base64");
          const script = `$ErrorActionPreference = 'Stop'; $argv = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${argv}')) | ConvertFrom-Json; & $argv[0] $argv[1]; exit $LASTEXITCODE`;
          hook.commandWindows = `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(script, "utf16le").toString("base64")}`;
        }
      }
      return `${JSON.stringify(next, null, 2)}\n`;
    });
  }
  update(join(home, ".codex/config.toml"), (current) => {
    const config = parse(current, { integersAsBigInt: true });
    const features = config.features ?? {};
    if (typeof features !== "object" || features === null || Array.isArray(features) || features instanceof Date) {
      throw new Error("Codex features must be a TOML table");
    }
    const table = features as TomlTable;
    if (table.hooks === true) return current;
    table.hooks = true;
    config.features = table;
    return stringify(config);
  });
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
        execFile(${JSON.stringify(process.execPath)}, [${JSON.stringify(execPath)}], { cwd: directory, timeout: 10000 }, (error, stdout, stderr) => {
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
