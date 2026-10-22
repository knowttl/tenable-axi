import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test.each([
  'await fetch("https://cloud.tenable.com")',
  '(await import("node:net")).connect({host:"cloud.tenable.com",port:443})',
  '(await import("node:net")).createConnection(443,"cloud.tenable.com")',
  '(new (await import("node:net")).Socket()).connect({host:"127.0.0.1",port:443})',
  '(await import("node:tls")).connect({host:"cloud.tenable.com",port:443})',
  '(await import("node:https")).get("https://cloud.tenable.com")',
  '(await import("node:http")).get("http://127.0.0.1:443")',
  '(await import("node:dgram")).createSocket("udp4").send("test",443,"127.0.0.1")',
])("the process-tree guard denies unregistered network access: %s", (source) => {
  const guard = fileURLToPath(new URL("./support/deny-network.mjs", import.meta.url));
  const result = spawnSync(process.execPath, ["--import", guard, "--input-type=module", "-e", source], {
    encoding: "utf8", timeout: 5000,
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("Network access is disabled during offline tests");
});
