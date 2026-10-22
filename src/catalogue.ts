export const DESCRIPTION = "Agent-friendly CLI for Tenable One, under construction";

// Evidence and planned commands never enable execution. Endpoint slices add explicit bindings here.
export const catalogue = {
  home: {
    description: "Show scaffold status without contacting Tenable",
    flags: { help: "Show help; default false" },
    examples: ["tenable-axi", "tenable-axi home --help"],
  },
  "auth status": {
    description: "Check local credentials and file security without contacting Tenable",
    flags: { config: "Config path; default TENABLE_AXI_CONFIG or platform path", profile: "Profile name; default credential precedence", fields: "Comma-separated output fields; default all", full: "Show full text; default false", help: "Show help; default false" },
    examples: ["tenable-axi auth status", "tenable-axi auth status --profile example"],
  },
  "profile list": {
    description: "List configured profiles without resolving secrets or contacting Tenable",
    flags: { config: "Config path; default TENABLE_AXI_CONFIG or platform path", profile: "Common selector; list still shows all profiles", fields: "Comma-separated output fields; default all", full: "Show full text; default false", help: "Show help; default false" },
    examples: ["tenable-axi profile list", "tenable-axi profile list --config /example/config.json"],
  },
  "config path": {
    description: "Show selected config and state paths without reading files",
    flags: { config: "Config path; default TENABLE_AXI_CONFIG or platform path", profile: "Common selector; paths are independent of profile", fields: "Comma-separated output fields; default all", full: "Show full text; default false", help: "Show help; default false" },
    examples: ["tenable-axi config path", "tenable-axi config path --fields config"],
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
