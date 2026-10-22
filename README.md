# tenable-axi

An AXI command-line tool for Tenable One, under construction.
The scaffold uses TypeScript on Node.js 22.12 or later and will be published as `@knowttl/tenable-axi`.
Local home, help and version commands work offline; no Tenable endpoint commands are implemented yet and no npm release is available.

The internal transport enforces the exact commercial origin, reviewed catalogue bindings, escaped paths, scoped continuations, and redirect refusal.
One transport instance represents one invocation, sharing a 20-second deadline, 20-request ceiling and 20-MiB decoded response ceiling across pages and retries.
Read operations may retry 429/502/503/504 twice; writes require coordinator authorization and never replay automatically.
Transport errors carry a stable code, operation, optional HTTP status and `retryAfter` in milliseconds, plus bounded redacted guidance.
Production currently has no executable endpoint bindings; offline tests construct synthetic bindings and a CA-verified loopback HTTPS fake through the internal construction seam.
No flag or environment variable enables that seam in the CLI.

See the [design](docs/design.md) for v1 scope, credentials, write policy, verification, and implementation slices.
See [contributing](CONTRIBUTING.md) for development conventions.

```sh
corepack pnpm install --frozen-lockfile --ignore-scripts --config.confirm-modules-purge=false
corepack pnpm run build
node bin/tenable-axi.js --help
node bin/tenable-axi.js --version
corepack pnpm test
corepack pnpm run lint
corepack pnpm run spec:check
```

See [verification](CONTRIBUTING.md#verification) for offline isolation and test selection.
The [capability map](docs/design.md#capability-map) defines planned v1 scope; the generated [inventory](inventory/capabilities.json) records every pinned operation's classification and does not enable execution.

Licensed under the [MIT License](LICENSE).
