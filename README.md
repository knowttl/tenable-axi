# tenable-axi

An AXI command-line tool for Tenable One, under construction.
It uses TypeScript on Node.js 22.12 or later and will be published as `@knowttl/tenable-axi`.
Inventory reads and exports, attack searches and connector logs are implemented.
Attack path, attack technique and MITRE heatmap exports support guarded creation, status and redacted file downloads.
`tag list`, `tag properties`, `card list` and `card show` provide bounded Exposure Management reads.
Platform tag categories, values, assignments, exclusions and dynamic filter definitions are implemented, including guarded mutations.
Home shows up to five exposure cards when configured and setup guidance offline otherwise.
`hook` reports local profile context without resolving secrets or contacting Tenable.
Help, version, `auth status`, `profile list` and `config path` remain local; no npm release is available.

Credentials use the strict versioned config and SecretRefs described in [profiles and authentication](docs/design.md#profiles-and-authentication).
Run `tenable-axi config path` to find the platform config path, or set both `TENABLE_AXI_ACCESS_KEY` and `TENABLE_AXI_SECRET_KEY` for an environment profile.
Run `tenable-axi auth status` to check sources and file security locally; it never contacts Tenable or prints key values.
The package ships [axi-credential.schema.json](axi-credential.schema.json) for hosts.

The internal transport enforces the exact commercial origin, reviewed catalogue bindings, escaped paths, scoped continuations, and redirect refusal.
One transport instance represents one invocation, sharing the [transport budgets](docs/design.md#transport-contract) across pages and retries.
Read operations may retry 429/502/503/504 twice; writes require coordinator authorization and never replay automatically.
Transport errors carry a stable code, operation, optional HTTP status and `retryAfter` in milliseconds, plus bounded redacted guidance.
Production binds reviewed inventory search/properties and exports, Exposure Management tag and card reads, attack searches, attack exports, connector logs and platform tags; offline tests use synthetic fixtures and a CA-verified loopback HTTPS fake through the internal construction seam.
No flag or environment variable enables that seam in the CLI.

Inventory and attack export creation and platform tag mutations use the write coordinator and are read-only by default.
It enforces immutable configured scope, redacted previews, exact confirmation, optional host approval, stale-state refusal and a durable private journal before a single authorized send.
Unknown outcomes include an audit ID and read-back guidance and are never replayed.
Named write commands register strict mutation definitions alongside transport bindings in the catalogue and call `createWriteCoordinator().run(operationId, input, options)`.
State readers establish no-ops and include concurrency fields in the compared state; operation definitions own documented payload validation and read-back guidance.

Use `export asset start` or `export finding start` to preview the filters, properties, format and compression for a tenant-side job.
The selected file profile must configure `writes.allowWrites: true` and allow the exact `inventory-export-assets` or `inventory-export-findings` operation, including for previews.
Optional `--body-file` accepts strict documented query/filters JSON, or `-` for stdin, within 1 MiB.
Query options use `--properties`, `--use-readable-name true|false`, `--max-chunk-file-size`, `--sort`, `--file-format JSON|CSV` and `--compress true|false`.
Run again with `--execute --confirm '<exact preview confirmation>'` to create once and return immediately; exports have no server dry run or idempotency guarantee.
`TENABLE_AXI_READ_ONLY=true` overrides every configured write policy.
`export asset jobs` and `export finding jobs` expose `--status` and `--limit` (default 100, maximum 1000), returning only the last three days without server paging or a claim of complete history.
`export inventory status --id <id>` reads once without polling and reports available chunks.
`export inventory download --id <id> --chunk <number> --output <new-file>` downloads one explicit chunk and prints file metadata only.
Files are validated as JSON or CSV, scanned for secrets, redacted and published atomically without overwrite; gzip exports are decoded and re-encoded with the same format.
Inventory JSON chunks must contain arrays of objects.
See [download bounds](docs/design.md#collections-jobs-and-bounded-reads) for file size and decompression limits.

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

Use `tag category list/show/create/update/delete` and `tag value list/show/create/update/delete/bulk-delete` for platform tags.
Category creates and updates require `--name`, with optional `--description`; show, update and delete select an exact `--id` UUID.
Value creates and updates require `--body-file <file>` with only documented non-security fields; show, update and delete select an exact `--id` UUID.
Creates accept category UUID or name, optional category description, value, description and dynamic filters; a new category name may create a category.
Updates accept value, description, filters and the documented `version` field; read `tag value show --id <id> --fields id,value,version` before updating.
Dynamic rules use `filters.asset.and` or `filters.asset.or` arrays of `{property, operator, value}`, where value is a string or string array, with at most 40 rules and 1024 values per rule.
`tag asset-filter list` exposes available rule properties and operators and explains the resource-tag filters the upstream omits.
Security fields, including nested `access_control`, are rejected before credentials or HTTP.
Platform category/value list filters use repeatable `--filter 'field:operator:value'`, `--filter-type and|or` and comma-separated `--sort field:asc|desc`.
Value wildcard search pairs `--with <text>` and `--with-filter category_name,value,description` with the documented `w` and `wf` parameters.
`tag assignment list --asset-id <id>` reads one asset's assignments; `tag exclusion list --tag-id <id> --target-type assets` reads dynamic tag exclusions.
Unpaged assignment/filter collections retain unreturned selected fields in bounded redacted cursors without inventing server paging parameters.

Platform tag writes require `writes.allowWrites: true` and the exact operation ID from the [ledger](docs/design.md#complete-operation-ledger) in `writes.operations`, including for previews.
They use the same preview, `--execute --confirm '<exact preview confirmation>'`, forced read-only override and private journal as export creation.
`tag value bulk-delete --ids-file <file>` consumes a JSON array of exact value UUIDs.
`tag assignment add/remove --asset-ids-file <file> --tag-ids-file <file>` consumes two JSON UUID arrays, confirms both complete sets, and returns one asynchronous job without polling.
Input files accept `-` for stdin, with only one stdin consumer and a 1 MiB bound per file.
State reads, including per-target checks for bulk operations, share invocation budgets; narrow large target sets when those budgets are exhausted.
Identical verified updates/creates and already desired assignments return successful no-ops; an unverified missing-resource response remains an error.
Deleting a category also deletes its values and assignments; deleting values removes their assignments while retaining the category.

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

Use `export attack-path start`, `export attack-technique start` or `export mitre-heatmap start` with a strict JSON `--body-file`, for example `{"file_format":"JSON"}`, using `"JSON"` or `"CSV"` and the operation's options from the [pinned specification](specs/exposure-management.json).
The body is limited to 1 MiB; `--body-file -` reads stdin.
Export filter logical operators use lowercase `and`/`or`, including attack path exports.
Select a configured profile with `--profile`; its `writes.allowWrites` must be true and `writes.operations` must include the exact operation ID (`apa-export-attack-path`, `apa-export-attack-technique` or `apa-export-mitre-heatmap`), even for previews.
Environment profiles cannot enable writes, and `TENABLE_AXI_READ_ONLY=true` blocks all creation.
Preview first, then pass `--execute --confirm '<exact-preview-confirmation>'` to create one job and return immediately.
Exports require `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE` and the corresponding upstream entitlement.
Use `export attack status --id <id>` for a single status read, or add `--wait` to poll within the shared deadline and request budgets.
If a polling budget expires after a validated pending response, `--wait` returns the last validated job with `complete:false` and `reason:POLL_BUDGET_EXCEEDED`, including when retries exhaust the request budget or an in-flight poll reaches the deadline.
Without a validated status, budget exhaustion remains an error; other polling failures remain errors.
Use `export attack download --id <id> --output <new-file>` to download JSON or CSV, including gzip-encoded files, with format-aware secret redaction and atomic publication within the [download bounds](docs/design.md#collections-jobs-and-bounded-reads).
Attack JSON downloads accept arrays of objects and top-level objects, including MITRE heatmap Navigator layers.
Downloads refuse overwrite and print file metadata only.
Attack and inventory job namespaces are separate; these commands never address inventory export jobs.

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
