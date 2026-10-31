import { AxiError, runAxiCli } from "axi-sdk-js";
import { DESCRIPTION, help } from "./catalogue.js";
import { encode } from "@toon-format/toon";
import { credentialStore, type CredentialContext } from "./profiles.js";
import { localCommand } from "./local-commands.js";
import { inventoryCommand } from "./inventory.js";
import { exposureCommand, homeIdentity, type TransportFactory } from "./exposure.js";
import { TransportError } from "./transport.js";
import { attackCommand } from "./attack.js";
import { attackExportCommand } from "./attack-export.js";
import { inventoryExportCommand, type WriteCoordinatorFactory } from "./inventory-export.js";
import { createWriteCoordinator } from "./writes.js";
import { platformTagCommand } from "./platform-tag.js";
import { responseCommand } from "./response.js";
import { setupHooks } from "./setup.js";

export async function main(argv = process.argv.slice(2), options: { credentials?: CredentialContext; stdout?: { write: (chunk: string) => unknown }; transportFactory?: TransportFactory; writeCoordinatorFactory?: WriteCoordinatorFactory } = {}): Promise<void> {
  const store = credentialStore(options.credentials);
  await runAxiCli({
    description: DESCRIPTION,
    argv: ["scaffold"],
    topLevelHelp: "",
    home: async () => store.redactor.payload(await exposureCommand([], store, options.transportFactory)) as Record<string, unknown>,
    stdout: { write: (chunk) => (options.stdout ?? process.stdout).write(store.redactor.text(chunk)) },
    formatError: (error) => ({
      output: `${encode(store.redactor.value({
        ...((!argv.length || argv[0] === "home" || argv[0]?.startsWith("--") && argv[0] !== "--help")
          && !(error instanceof AxiError && error.code === "VALIDATION_ERROR") ? homeIdentity() : {}),
        ...(error instanceof TransportError ? error.toJSON() : error instanceof AxiError ? { error: { code: error.code, message: error.message }, help: error.suggestions }
          : { error: { code: "CONFIG_INVALID", message: "Command could not complete" } }),
      }))}\n`,
      exitCode: error instanceof AxiError && error.code === "VALIDATION_ERROR" ? 2 : 1,
    }),
    commands: {
      scaffold: async () => {
        if (argv[0] === "setup") return setupHooks(argv);
        if (argv[0] === "tag" && !["list", "properties"].includes(argv[1] ?? "")) return store.redactor.payload(await platformTagCommand(argv, store, options.transportFactory,
          options.writeCoordinatorFactory ?? ((flags) => createWriteCoordinator(flags, options.credentials)))) as Record<string, unknown>;
        if (["initiative", "combination"].includes(argv[0] ?? "")) {
          const result = await responseCommand(argv, store, options.transportFactory,
            options.writeCoordinatorFactory ?? ((flags) => createWriteCoordinator(flags, options.credentials)));
          if (result.error) process.exitCode = 1;
          return store.redactor.payload(result) as Record<string, unknown>;
        }
        if (argv[0] === "export") {
          const result = await (["attack-path", "attack-technique", "mitre-heatmap", "attack"].includes(argv[1] ?? "") ? attackExportCommand : inventoryExportCommand)(argv, store, options.transportFactory,
            options.writeCoordinatorFactory ?? ((flags) => createWriteCoordinator(flags, options.credentials)));
          if (result.error) process.exitCode = 1;
          return store.redactor.payload(result) as Record<string, unknown>;
        }
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
