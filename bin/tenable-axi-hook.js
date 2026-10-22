#!/usr/bin/env node
import { encode } from "@toon-format/toon";

// Ambient context must remain local, even when a profile is configured.
try {
  const { credentialStore } = await import("../dist/src/profiles.js");
  const { exposureCommand } = await import("../dist/src/exposure.js");
  const store = credentialStore();
  const context = await exposureCommand(["hook"], store);
  process.stdout.write(`${encode(store.redactor.value(context))}\n`);
} catch {
  process.stdout.write("tenable: local profile status unavailable\n");
}
