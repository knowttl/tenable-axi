# tenable-axi

An AXI command-line tool for Tenable One, under construction.
It uses TypeScript on Node.js 22.12 or later and will be published as `@knowttl/tenable-axi`.
Inventory reads, attack searches and connector logs are implemented.
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
Production binds reviewed inventory search/properties, Exposure Management tag and card reads, attack searches and connector logs; offline tests use synthetic fixtures and a CA-verified loopback HTTPS fake through the internal construction seam.
No flag or environment variable enables that seam in the CLI.

The internal write coordinator is ready for named endpoint slices; it ships no write command or executable write binding yet.
It enforces immutable configured scope, redacted previews, exact confirmation, optional host approval, stale-state refusal and a durable private journal before a single authorized send.
Unknown outcomes include an audit ID and read-back guidance and are never replayed.
Later slices register strict mutation definitions alongside transport bindings in the catalogue and call `createWriteCoordinator().run(operationId, input, options)` from their named commands.
State readers establish no-ops and include concurrency fields in the compared state; operation definitions own documented payload validation and read-back guidance.

Use `asset list/show/properties`, `finding list/show/properties`, and `software list/properties` with `--help` for their flags and examples.
Lists default to 100 rows, expose upstream totals when supplied, and return a cursor when more rows remain.
`--all` remains bounded by 10,000 rows and the shared transport budgets; resume with the returned `--cursor` and original selectors, filters, sort, and fields.
Offset paging does not provide snapshot isolation.
`--fields` selects display or wire properties and automatically requests extra properties; `--full` removes the 1,000-character text preview while retaining invocation bounds.
Simple filters use `--filter 'severity = ["HIGH"]'`; `--filter-file` accepts a flat JSON array of `{property, operator, value: string[]}` and rejects nested boolean expressions.
Software defaults to name, version, and publisher because the pinned API exposes no stable software ID.

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

Use `attack-path list`, `attack-technique list`, and `connector logs` with `--help` for their flags and examples.
Attack paths use the published `/api/v1/t1/apa/top-attack-paths/search` route; the pyTenable route disagreement remains a live-acceptance check in the design.
AI summarization defaults to false; explicitly enable it with `--run-ai-summarization true`.
`--include-resolved` includes resolved paths or archived/resolved techniques.
Attack filters accept `--filter 'priority gte 8'` or a `--filter-file` containing the documented single or nested filter object.
Path logical operators use `AND`/`OR`; technique logical operators use `and`/`or`, with at most two logical levels in either case.
Attack searches send at least 100 wire rows even for a smaller output limit, retaining excess selected fields in a bounded redacted cursor for resume.
Technique `id` maps to `serial_id`, and `affectedAssets` counts the returned `assets_ids` array.
Connector logs accept connector ID, sync status, and paired date boundaries (inclusive start, exclusive end), without invented server paging parameters.
Log `timestamp` is the sync start time; use `--fields connectorId,status,sync_logs --full` for event details.
Unpaged log collections retain unreturned rows for bounded local resume; if the upstream total exceeds the available collection, output reports that limitation and suggests narrowing the selectors.
Connector log denial explains Administrator or the documented connector-read privilege without recommending Administrator for inventory access.

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
