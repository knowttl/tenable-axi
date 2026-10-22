import { AxiError, runAxiCli } from "axi-sdk-js";
import { DESCRIPTION, help } from "./catalogue.js";
import { encode } from "@toon-format/toon";
import { credentialStore, type CredentialContext } from "./profiles.js";
import { localCommand } from "./local-commands.js";
import { inventoryCommand } from "./inventory.js";
import { exposureCommand, type TransportFactory } from "./exposure.js";
import { TransportError } from "./transport.js";
import { attackCommand } from "./attack.js";

export async function main(argv = process.argv.slice(2), options: { credentials?: CredentialContext; stdout?: { write: (chunk: string) => unknown }; transportFactory?: TransportFactory } = {}): Promise<void> {
  const store = credentialStore(options.credentials);
  await runAxiCli({
    description: DESCRIPTION,
    argv: ["scaffold"],
    topLevelHelp: "",
    home: async () => store.redactor.payload(await exposureCommand([], store, options.transportFactory)) as Record<string, unknown>,
    stdout: { write: (chunk) => (options.stdout ?? process.stdout).write(store.redactor.text(chunk)) },
    formatError: (error) => ({
      output: `${encode(store.redactor.value(error instanceof TransportError ? error.toJSON() : error instanceof AxiError ? { error: { code: error.code, message: error.message }, help: error.suggestions }
        : { error: { code: "CONFIG_INVALID", message: "Command could not complete" } }))}\n`,
      exitCode: error instanceof AxiError && error.code === "VALIDATION_ERROR" ? 2 : 1,
    }),
    commands: {
      scaffold: async () => {
        if (["attack-path", "attack-technique", "connector"].includes(argv[0] ?? "")) {
          const result = await attackCommand(argv, store, options.transportFactory);
          if (result.error) process.exitCode = 1;
          return store.redactor.value(result) as Record<string, unknown>;
        }
        if (["asset", "finding", "software"].includes(argv[0] ?? "")) {
          const result = await inventoryCommand(argv, store, options.transportFactory);
          if (result.error) process.exitCode = 1;
          return store.redactor.value(result) as Record<string, unknown>;
        }
        if (["auth", "profile", "config"].includes(argv[0] ?? "")) return store.redactor.value(localCommand(argv, store)) as Record<string, unknown>;
        return argv.length === 1 && argv[0] === "--help" ? help() : store.redactor.payload(await exposureCommand(argv, store, options.transportFactory)) as Record<string, unknown>;
      },
    },
  });
}
