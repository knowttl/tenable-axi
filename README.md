# tenable-axi

An AXI command-line tool for Tenable One, under construction.
The scaffold uses TypeScript on Node.js 22.12 or later and will be published as `@knowttl/tenable-axi`.
`tag list`, `tag properties`, `card list` and `card show` provide bounded Exposure Management reads.
Home shows up to five exposure cards when configured and setup guidance offline otherwise.
`hook` reports local profile context without resolving secrets or contacting Tenable.
Help, version, `auth status`, `profile list` and `config path` remain local; no npm release is available.

Credentials use the strict versioned config and SecretRefs described in [profiles and authentication](docs/design.md#profiles-and-authentication).
Run `tenable-axi config path` to find the platform config path, or set both `TENABLE_AXI_ACCESS_KEY` and `TENABLE_AXI_SECRET_KEY` for an environment profile.
Run `tenable-axi auth status` to check sources and file security locally; it never contacts Tenable or prints key values.
The package ships [axi-credential.schema.json](axi-credential.schema.json) for hosts.

The internal transport enforces the exact commercial origin, reviewed catalogue bindings, escaped paths, scoped continuations, and redirect refusal.
One transport instance represents one invocation, sharing a 20-second deadline, 20-request ceiling and 20-MiB decoded response ceiling across pages and retries.
Read operations may retry 429/502/503/504 twice; writes require coordinator authorization and never replay automatically.
Transport errors carry a stable code, operation, optional HTTP status and `retryAfter` in milliseconds, plus bounded redacted guidance.
Production binds only reviewed implemented operations; offline tests use synthetic responses and a CA-verified loopback HTTPS fake through the internal construction seam.
No flag or environment variable enables that seam in the CLI.

The internal write coordinator is ready for named endpoint slices; it ships no write command or executable write binding yet.
It enforces immutable configured scope, redacted previews, exact confirmation, optional host approval, stale-state refusal and a durable private journal before a single authorized send.
Unknown outcomes include an audit ID and read-back guidance and are never replayed.
Later slices register strict mutation definitions alongside transport bindings in the catalogue and call `createWriteCoordinator().run(operationId, input, options)` from their named commands.
State readers establish no-ops and include concurrency fields in the compared state; operation definitions own documented payload validation and read-back guidance.

`doctor` validates local configuration and file security, then performs exactly one tag-properties read without retries.
It checks `EXPOSURE_MANAGEMENT.TAG.TAG.READ`, without claiming access to other modules.
Collections expose returned count, upstream total when known, completeness and a scoped resume cursor.
Card requests cap each wire page at 25; ordinary lists default to 100 output rows.
`--all` remains subject to invocation budgets and the 10,000-row ceiling.
Resume with `--cursor` and the same profile, fields, filters and sort.
Offset pagination does not promise snapshot isolation.
Tag `value` maps to the documented `name`; `category` requests `tag_category_name` through extra properties and remains null when unavailable.
Tag filter files contain the pinned API's strict array of `{property, operator, value}` filters, with string arrays for `value`; this endpoint does not define nested boolean filters.
Use `--help` on each leaf for selectors and defaults.

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
