import { AxiError, runAxiCli } from "axi-sdk-js";
import { homedir } from "node:os";
import { DESCRIPTION, help } from "./catalogue.js";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const state = () => ({
    bin: process.argv[1]?.replace(homedir(), "~"), description: DESCRIPTION,
    status: "Scaffold only; Tenable operations are not implemented",
    help: ["Run tenable-axi --help"],
  });
  await runAxiCli({
    description: DESCRIPTION,
    argv: ["scaffold"],
    topLevelHelp: "",
    home: state,
    commands: {
      scaffold: () => {
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
