import { AxiError, runAxiCli } from "axi-sdk-js";
import { homedir } from "node:os";
import { DESCRIPTION, help } from "./catalogue.js";
import { encode } from "@toon-format/toon";
import { credentialStore, type CredentialContext } from "./profiles.js";
import { localCommand } from "./local-commands.js";
import { inventoryCommand } from "./inventory.js";
import { TransportError, type Transport, type TransportOptions } from "./transport.js";

export async function main(argv = process.argv.slice(2), options: { credentials?: CredentialContext; stdout?: { write: (chunk: string) => unknown }; transportFactory?: (options: TransportOptions) => Transport } = {}): Promise<void> {
  const store = credentialStore(options.credentials);
  const state = () => ({
    bin: process.argv[1]?.replace(homedir(), "~"), description: DESCRIPTION,
    status: "Inventory reads available; other endpoint modules are under construction",
    help: ["Run tenable-axi --help"],
  });
  await runAxiCli({
    description: DESCRIPTION,
    argv: ["scaffold"],
    topLevelHelp: "",
    home: state,
    stdout: { write: (chunk) => (options.stdout ?? process.stdout).write(store.redactor.text(chunk)) },
    formatError: (error) => ({
      output: `${encode(store.redactor.value(error instanceof TransportError ? error.toJSON() : error instanceof AxiError ? { error: { code: error.code, message: error.message }, help: error.suggestions }
        : { error: { code: "CONFIG_INVALID", message: "Local configuration operation failed" } }))}\n`,
      exitCode: error instanceof AxiError && error.code === "VALIDATION_ERROR" ? 2 : 1,
    }),
    commands: {
      scaffold: async () => {
        if (["asset", "finding", "software"].includes(argv[0] ?? "")) {
          const result = await inventoryCommand(argv, store, options.transportFactory);
          if (result.error) process.exitCode = 1;
          return store.redactor.value(result) as Record<string, unknown>;
        }
        if (["auth", "profile", "config"].includes(argv[0] ?? "")) return store.redactor.value(localCommand(argv, store)) as Record<string, unknown>;
        const args = argv[0] === "home" ? argv.slice(1) : argv;
        if (args.length > 1 || (args.length === 1 && args[0] !== "--help")) {
          throw new AxiError("Unknown command, argument, or flag", "VALIDATION_ERROR", [
            "Valid command: home; valid flag: --help", "Run tenable-axi --help",
          ]);
        }
        return args[0] === "--help" ? help() : state();
      },
    },
  });
}
