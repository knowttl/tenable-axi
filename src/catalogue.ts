import type { OperationBinding } from "./transport-core.js";

export const DESCRIPTION = "Agent-friendly CLI for Tenable One, under construction";

// Endpoint slices add reviewed executable bindings alongside their commands.
export const transportBindings: Readonly<Record<string, OperationBinding>> = Object.freeze({});

// Evidence and planned commands never enable execution. Endpoint slices add explicit bindings here.
export const catalogue = {
  home: {
    description: "Show scaffold status without contacting Tenable",
    flags: { help: "Show help; default false" },
    examples: ["tenable-axi", "tenable-axi home --help"],
  },
} as const;

export function help(): Record<string, unknown> {
  return {
    description: DESCRIPTION,
    commands: Object.fromEntries(Object.entries(catalogue).map(([name, entry]) => [name, entry.description])),
    flags: Object.fromEntries(Object.entries(catalogue.home.flags).map(([name, description]) => [`--${name}`, description])),
    version: "-v, -V, --version: print the bare version",
    examples: catalogue.home.examples,
  };
}
