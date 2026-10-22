import { chmodSync, closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, win32 } from "node:path";
import { AxiError } from "axi-sdk-js";
import type { Stats } from "node:fs";

export type WindowsAcl = (path: string, action: "check" | "verify" | "restrict", directory: boolean) => void;
export const windowsAcl: WindowsAcl = (path, action, directory) => {
  const quoted = `'${path.replaceAll("'", "''")}'`;
  const script = `$ErrorActionPreference='Stop'; $p=${quoted}; $item=Get-Item -LiteralPath $p -Force; `
    + `if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse point' }; `
    + `$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $allowed=@($sid.Value,'S-1-5-18','S-1-5-32-544'); `
    + (action === "check" ? "" : action === "restrict"
      ? `$acl=New-Object Security.AccessControl.${directory ? "DirectorySecurity" : "FileSecurity"}; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); `
        + `foreach ($s in $allowed) { $id=New-Object Security.Principal.SecurityIdentifier($s); $rule=New-Object Security.AccessControl.FileSystemAccessRule($id,'FullControl','${directory ? "ContainerInherit,ObjectInherit" : "None"}','None','Allow'); $acl.AddAccessRule($rule) }; Set-Acl -LiteralPath $p -AclObject $acl`
      : `$acl=Get-Acl -LiteralPath $p; if (!$acl.AreAccessRulesProtected -or ($acl.Owner -ne $sid.Translate([Security.Principal.NTAccount]).Value -and $acl.Owner -ne $sid.Value)) { throw 'Unprotected ACL' }; `
        + `$seen=@(); foreach ($r in $acl.Access) { $s=$r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value; if ($s -notin $allowed -or $r.IsInherited -or $r.AccessControlType -ne 'Allow' -or $r.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) { throw 'Unexpected ACL' }; $seen+=$s }; foreach ($s in $allowed) { if ($s -notin $seen) { throw 'Missing ACL' } }`);
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: "pipe" });
};

export function toolDirectory(kind: "config" | "state", env = process.env, platform: NodeJS.Platform = process.platform, home = homedir()): string {
  if (platform === "win32") {
    const base = env[kind === "config" ? "APPDATA" : "LOCALAPPDATA"];
    return win32.join(base && win32.isAbsolute(base) ? base : win32.join(home, "AppData", kind === "config" ? "Roaming" : "Local"), "tenable-axi");
  }
  const xdg = env[kind === "config" ? "XDG_CONFIG_HOME" : "XDG_STATE_HOME"];
  return join(xdg && isAbsolute(xdg) ? xdg : join(home, kind === "config" ? ".config" : ".local/state"), "tenable-axi");
}

export type PrivateFileOptions = { platform?: NodeJS.Platform; acl?: WindowsAcl; uid?: number; rename?: typeof renameSync; wait?: (ms: number) => void };
export function privateFiles(options: PrivateFileOptions = {}) {
  const platform = options.platform ?? process.platform;
  const acl = options.acl ?? windowsAcl;
  const insecure = (path: string): never => { throw new AxiError(`Insecure private file: ${path}`, "CONFIG_INSECURE", [
    platform === "win32" ? `Apply a protected DACL granting only the current user, SYSTEM and Administrators to ${path}` : `chmod 600 '${path.replaceAll("'", "'\\''")}'`,
  ]); };
  function validate(stat: Stats, path: string, secret: boolean): void {
    if (!stat.isFile() || stat.isSymbolicLink()) insecure(path);
    if (platform !== "win32" && (stat.uid !== (options.uid ?? process.getuid!()) || (stat.mode & (secret ? 0o077 : 0o022)) !== 0)) insecure(path);
  }
  function check(path: string, secret = false, verifyAcl = false): void {
    validate(lstatSync(path), path, secret);
    if (platform === "win32") {
      try { acl(path, verifyAcl ? "verify" : "check", false); } catch { insecure(path); }
    }
  }
  function read(path: string, secret = false, verifyAcl = false): string {
    check(path, secret, verifyAcl);
    const fd = openSync(path, constants.O_RDONLY | (platform === "win32" ? 0 : constants.O_NOFOLLOW));
    try { validate(fstatSync(fd), path, secret); return readFileSync(fd, "utf8"); } finally { closeSync(fd); }
  }
  function flushDirectory(path: string): void {
    if (platform === "win32") return;
    const fd = openSync(path, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
  }
  function directory(path: string): void {
    const first = mkdirSync(path, { recursive: true, ...(platform === "win32" ? {} : { mode: 0o700 }) });
    let current = path;
    for (;;) {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory() || (platform !== "win32" && stat.uid !== (options.uid ?? process.getuid!()))) insecure(current);
      try {
        if (platform === "win32") acl(current, "restrict", true);
        else chmodSync(current, 0o700);
      } catch { insecure(current); }
      if (first) flushDirectory(current);
      if (!first || current === first) break;
      current = dirname(current);
    }
    if (first) flushDirectory(dirname(first));
  }
  function write(path: string, content: string): void {
    directory(dirname(path));
    if (existsSync(path)) check(path, true);
    const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
    let fd: number | undefined;
    try {
      fd = openSync(temporary, "wx", platform === "win32" ? undefined : 0o600);
      if (platform === "win32") { try { acl(temporary, "restrict", false); } catch { insecure(temporary); } }
      writeFileSync(fd, content, "utf8");
      fsyncSync(fd);
      closeSync(fd);
      fd = undefined;
      for (let attempt = 0;; attempt++) {
        try { (options.rename ?? renameSync)(temporary, path); break; } catch (error) {
          if (platform !== "win32" || !["EPERM", "EBUSY", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "") || attempt === 5) throw error;
          (options.wait ?? ((ms) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }))(25 * 2 ** attempt);
        }
      }
      flushDirectory(dirname(path));
    } finally {
      if (fd !== undefined) closeSync(fd);
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  return { check, read, directory, write };
}
