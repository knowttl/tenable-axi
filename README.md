# tenable-axi

Investigate Tenable One exposure through compact TOON output and explicitly guarded business writes.
It uses TypeScript on Node.js 22.12 or later and is packaged as `@knowttl/tenable-axi`.
This is the pre-release source; publication follows separate live acceptance and release approval.

## Quickstart

Install the released package globally, or use `npx -y @knowttl/tenable-axi` in place of `tenable-axi` once published.
Until then, use the [local development commands](#development-and-testing).

```sh
npm install --global @knowttl/tenable-axi
tenable-axi config path
tenable-axi profile list
```

Save this configuration at the reported config path and supply the two environment variables through your secret manager.
Secret values never belong in arguments, chat, or configuration JSON.

```json
{
  "version": 1,
  "defaultProfile": "example",
  "profiles": {
    "example": {
      "origin": "https://cloud.tenable.com",
      "accessKey": { "env": "TENABLE_AXI_ACCESS_KEY" },
      "secretKey": { "env": "TENABLE_AXI_SECRET_KEY" },
      "writes": { "allowWrites": false, "operations": [] }
    }
  }
}
```

Config files must be owned regular files without group/other write access; use `chmod 600 <config-path>` on Unix.
SecretRefs also accept `{"file":"/absolute/path"}` to a protected secret file with no group/other permission bits.
Windows uses protected DACLs; UNC and device paths are refused.
No login command, credential minting, arbitrary HTTP, alternate origin or TLS bypass is available.

```sh
tenable-axi auth status --profile example
tenable-axi doctor --profile example
tenable-axi asset list --profile example --limit 10
tenable-axi finding list --profile example --filter 'severity = ["HIGH"]'
```

`auth status` is local; `doctor` makes one bounded tag-properties read and does not prove other module permissions.
Configured home reads up to five live exposure cards; unconfigured home stays offline.
Only `https://cloud.tenable.com` is supported.
Upstream licensing and the user's per-operation permissions still apply.
Inventory needs `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ`; inventory exports need its `EXPORT` privilege and attack exports need `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE`.
Connector logs have elevated permissions; their denial does not imply ordinary inventory users need Administrator.

## Use with your agent

Install optional hooks for ambient local context after installing the binary in a stable location:

```sh
tenable-axi setup hooks
```

This explicit opt-in installs or repairs Claude Code and Codex SessionStart hooks and an OpenCode managed plugin.
Ordinary commands never install integrations.
POSIX SessionStart hooks use the first executable on PATH only if it matches this installation, otherwise retaining the absolute hook path.
Windows SessionStart hooks and the OpenCode plugin invoke Node with the absolute hook script path; rerun setup after relocating Node or the installation.
Repeated setup preserves unrelated integrations and makes no changes when already current.
Restart the agent session after setup.
The hook prints local profile/origin/write posture, resolves no secrets, and never contacts Tenable.
It follows the session's `TENABLE_AXI_PROFILE` and `TENABLE_AXI_CONFIG`, so select those explicitly when working with multiple tenants.
Use `tenable-axi setup hooks --scope project` for project-local hook entries and the OpenCode plugin.
User setup honors `CLAUDE_CONFIG_DIR` (default `~/.claude`), `CODEX_HOME` (default `~/.codex`), and `$XDG_CONFIG_HOME/opencode` (default `~/.config/opencode`).
Project hook destinations remain `.claude`, `.codex`, and `.opencode` under the working directory.
Both scopes enable Codex's shared user-level hooks feature in the active `CODEX_HOME/config.toml`.
No repository-local Tenable configuration is discovered automatically.
To remove user hooks, remove only entries containing `tenable-axi-hook` from `settings.json` in the active Claude configuration directory and `hooks.json` in the active Codex directory, and the managed `plugins/axi-tenable-axi-hook.js` under OpenCode's active configuration directory.
For project scope, remove the corresponding `.claude/settings.json`, `.codex/hooks.json` entries and `.opencode/plugins/axi-tenable-axi-hook.js` under that project.
Keep unrelated entries and Codex's shared hooks feature enabled for other tools.

The generated skill provides discovery on demand, with no session hook required:

```sh
npx skills add knowttl/tenable-axi --skill tenable-axi
```

Hooks and skill work independently or together.
The skill uses non-interactive `npx -y @knowttl/tenable-axi` examples and ships inside the npm tarball.

## Configuration and safety

Linux/macOS configuration uses absolute `$XDG_CONFIG_HOME/tenable-axi/config.json`, otherwise `~/.config/tenable-axi/config.json`.
State uses absolute `$XDG_STATE_HOME/tenable-axi`, otherwise `~/.local/state/tenable-axi`.
Windows uses `%APPDATA%\tenable-axi` for config and `%LOCALAPPDATA%\tenable-axi` for state, ignoring XDG.
`--config` overrides `TENABLE_AXI_CONFIG`; `--profile` overrides `TENABLE_AXI_PROFILE`, then a complete environment profile, configured default, or sole profile is selected.
A complete environment profile requires both `TENABLE_AXI_ACCESS_KEY` and `TENABLE_AXI_SECRET_KEY`; partial values fail rather than mixing credentials.
Explicit file-selected profiles ignore environment profile fields.
Environment profiles cannot enable writes.
`TENABLE_AXI_READ_ONLY=1` or `true` forces read-only; `0`, `false`, or unset permits the configured policy, and other values fail closed.
`TENABLE_AXI_WRITE_LOG` selects a private journal instead of the default state-directory `writes.log`.

Writes require a file profile with `writes.allowWrites: true` and exact upstream operation IDs in `writes.operations`, including for previews.
For example, allow only `inventory-export-assets` to preview or create asset exports.
Run a write without `--execute` to inspect its redacted preview, then supply `--execute --confirm '<exact preview confirmation>'` after reviewing the target and effect.
`--dry-run` is explicit preview and excludes `--execute`.
The durable redacted journal records intent before sending once; ambiguous outcomes include audit IDs and must be reconciled before retrying.
Credential, user, role and access-control administration stays blocked, including nested security fields in otherwise allowed payloads.

## Command reference

The [generated reference](docs/commands.md) includes flags, defaults and examples from the executable catalogue.
Use each leaf's `--help` for concise help; unknown flags and invalid combinations fail before credentials or HTTP.
Bare `--version`, `-v` and `-V` print only the package version.

<!-- command-registry:start -->
| Command | Purpose |
|---|---|
| `tenable-axi asset list` | Search assets |
| `tenable-axi asset properties` | Discover asset properties and supported operators |
| `tenable-axi asset show` | Find one asset by exact ID search |
| `tenable-axi attack-path list` | Search top attack paths using the published specification route |
| `tenable-axi attack-technique list` | Search top attack techniques; affectedAssets counts assets_ids |
| `tenable-axi auth status` | Check local credentials and file security without contacting Tenable |
| `tenable-axi card list` | List exposure view cards |
| `tenable-axi card show` | Show an exposure card and its scores, trends and SLA details |
| `tenable-axi combination create` | Preview or create combination |
| `tenable-axi combination delete` | Preview or delete combination |
| `tenable-axi combination filters` | List allowed combination query properties and operators |
| `tenable-axi combination list` | list combinations |
| `tenable-axi combination show` | show combination |
| `tenable-axi combination update` | Preview or update combination |
| `tenable-axi config path` | Show selected config and state paths without reading files |
| `tenable-axi connector logs` | Read connector sync logs; the API has no server paging parameters |
| `tenable-axi doctor` | Check local security and one tag-properties read without retries |
| `tenable-axi export asset jobs` | List recent inventory asset export jobs |
| `tenable-axi export asset start` | Preview or create an inventory asset export job |
| `tenable-axi export attack download` | Download an attack export to a new file, redacting JSON/CSV within 128 MiB |
| `tenable-axi export attack status` | Read an attack export job; no polling by default |
| `tenable-axi export attack-path start` | Preview or start one attack-path export; requires configured write scope and ATTACK_PATH.WRITE |
| `tenable-axi export attack-technique start` | Preview or start one attack-technique export; requires configured write scope and ATTACK_PATH.WRITE |
| `tenable-axi export finding jobs` | List recent inventory finding export jobs |
| `tenable-axi export finding start` | Preview or create an inventory finding export job |
| `tenable-axi export inventory download` | Download one inventory chunk to a new redacted file |
| `tenable-axi export inventory status` | Read one inventory export status without polling |
| `tenable-axi export mitre-heatmap start` | Preview or start one mitre-heatmap export; requires configured write scope and ATTACK_PATH.WRITE |
| `tenable-axi finding list` | Search findings |
| `tenable-axi finding properties` | Discover finding properties and supported operators |
| `tenable-axi finding show` | Find one finding by exact ID search |
| `tenable-axi home` | Show profile state and up to five live exposure cards |
| `tenable-axi hook` | Show compact local profile context without resolving secrets or HTTP |
| `tenable-axi initiative create` | Preview or create initiative |
| `tenable-axi initiative delete` | Preview or delete initiative |
| `tenable-axi initiative list` | list initiatives |
| `tenable-axi initiative show` | show initiative |
| `tenable-axi initiative update` | Preview or update initiative |
| `tenable-axi profile list` | List configured profiles without resolving secrets or contacting Tenable |
| `tenable-axi setup hooks` | Explicitly install or repair local agent session integrations |
| `tenable-axi software list` | Search software; the pinned API exposes no stable software ID |
| `tenable-axi software properties` | Discover software properties and supported operators |
| `tenable-axi tag asset-filter list` | List documented dynamic tag filter definitions |
| `tenable-axi tag assignment add` | add tags for the exact asset set |
| `tenable-axi tag assignment list` | List tags assigned to one asset |
| `tenable-axi tag assignment remove` | remove tags for the exact asset set |
| `tenable-axi tag category create` | Create platform tag category |
| `tenable-axi tag category delete` | Delete platform tag category |
| `tenable-axi tag category list` | List platform tag category |
| `tenable-axi tag category show` | Show platform tag category |
| `tenable-axi tag category update` | Update platform tag category |
| `tenable-axi tag exclusion list` | List assets excluded from a dynamic tag |
| `tenable-axi tag list` | Search Exposure Management tags |
| `tenable-axi tag properties` | List available tag properties and operators |
| `tenable-axi tag value bulk-delete` | Preview or delete the exact tag value set |
| `tenable-axi tag value create` | Create platform tag value |
| `tenable-axi tag value delete` | Delete platform tag value |
| `tenable-axi tag value list` | List platform tag value |
| `tenable-axi tag value show` | Show platform tag value |
| `tenable-axi tag value update` | Update platform tag value |
<!-- command-registry:end -->

## Shipped behavior

Inventory reads and exports, attack searches and connector logs are implemented.
Attack path, attack technique and MITRE heatmap exports support guarded creation, status and redacted file downloads.
`tag list`, `tag properties`, `card list` and `card show` provide bounded Exposure Management reads.
Platform tag categories, values, assignments, exclusions and dynamic filter definitions are implemented, including guarded mutations.
Home shows up to five exposure cards when configured and setup guidance offline otherwise.
Card lists accept up to 25 cards per upstream page, emit only the requested limit, and preserve overflow in a scoped, redacted cursor bounded at 64 KiB.
Resume with the original selectors and fields; an oversized page or cursor fails validation rather than dropping cards.
Exposure response initiatives and combinations support reads and guarded writes, including allowed combination filters.
`hook` reports local profile context without resolving secrets or contacting Tenable.
Help, version, `auth status`, `profile list` and `config path` remain local.

Credentials use the strict versioned config and SecretRefs described in [profiles and authentication](docs/design.md#profiles-and-authentication).
Run `tenable-axi config path` to find the platform config path, or set both `TENABLE_AXI_ACCESS_KEY` and `TENABLE_AXI_SECRET_KEY` for an environment profile.
Run `tenable-axi auth status` to check sources and file security locally; it never contacts Tenable or prints key values.
The package ships [axi-credential.schema.json](axi-credential.schema.json) for hosts.

The internal transport enforces the exact commercial origin, reviewed catalogue bindings, escaped paths, scoped continuations, and redirect refusal.
One transport instance represents one invocation, sharing the [transport budgets](docs/design.md#transport-contract) across pages and retries.
Read operations may retry 429/502/503/504 twice; writes require coordinator authorization and never replay automatically.
Transport errors carry a stable code, operation, optional HTTP status and `retryAfter` in milliseconds, plus bounded redacted guidance.
Production binds reviewed inventory search/properties and exports, Exposure Management tag and card reads, attack searches, attack exports, connector logs, platform tags and Exposure Response commands; offline tests use synthetic fixtures and a CA-verified loopback HTTPS fake through the internal construction seam.
No flag or environment variable enables that seam in the CLI.

Inventory and attack export creation, platform tag mutations and Exposure Response writes use the write coordinator and are read-only by default.
It enforces immutable configured scope, redacted previews, exact confirmation, optional host approval, stale-state refusal and a durable private journal before a single authorized send.
Unknown outcomes include an audit ID and read-back guidance and are never replayed.
Named write commands register strict mutation definitions alongside transport bindings in the catalogue and call `createWriteCoordinator().run(operationId, input, options)`.
State readers establish no-ops and include concurrency fields in the compared state; operation definitions own documented payload validation and read-back guidance.

Use `initiative list/show/create/update/delete`, `combination list/show/create/update/delete` and `combination filters` for Exposure Response.
Show, update and delete require `--id <uuid>`; create and update require a strict JSON `--body-file` (or `-` for stdin, at most 1 MiB).
Updates send the complete replacement body, with the same required fields as creates.
Initiative bodies contain `name`, `scope`, `combination_ids`, `tenable_ids`, `owner`, `sla_in_days` and optional `description`.
Scope and each combination-ID array accept at most ten UUIDs; owner is an explicit UUID and SLA is a signed 32-bit integer as documented by the pinned schema.
Previews read the selected combinations and enforce the seventeen-query initiative limit without discovering users or changing tags.
Combination bodies contain `name`, `query`, `is_public` and optional `description`; queries use a single `{property, operator, value}` filter or nested `and`/`or` arrays with at most six conditions.
`exists` and `nexists` allow an omitted value; `combination filters` reports supported properties, operators and value metadata.
When selected, optional `allowedValues` and `selectMultiValue` remain absent if upstream omits them; malformed present values fail validation, including on cursor resume.
The preview explicitly describes public or private visibility, owner and scope effects.
Each write requires a file profile with `writes.allowWrites: true` and the exact `initiatives-create/update/delete` or `combinations-create/update/delete` operation IDs in `writes.operations`, including for preview.
Run again with `--execute --confirm '<exact preview confirmation>'` to send once through the existing journal and read-only guards.
Updates re-read the selected resource before sending and refuse changed state; identical updates/creates and verified absent deletes are no-ops.
The API does not document conditional writes, so re-reading narrows the race without guaranteeing atomic comparison.
Lists and allowed filters are unpaged upstream; `--limit` defaults to 100 and `--all` caps output at 10,000 rows.
Their scoped cursors contain only a position and collection fingerprint, bounded at 1 KiB, without row data or invented server paging parameters.
Resume re-fetches the collection with the original selectors and refuses changed collections; restart without `--cursor` if the collection changed.
`combination list --type private|shared|tenable` scopes the upstream request; the displayed type uses that selector or the returned `is_public` value, and stays null when neither establishes it.
No upstream total is supplied, so `total` remains null.
Use `--fields` for documented wire fields or compact aliases (`slaInDays`, filter `property`); `--full` removes text truncation while retaining invocation bounds.
Full-text hints omit `--execute` and `--confirm`, so following a write's hint previews without sending another mutation.

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

## Development and testing

```sh
corepack pnpm install --frozen-lockfile --ignore-scripts --config.confirm-modules-purge=false
corepack pnpm run build
node scripts/isolated.mjs node bin/tenable-axi.js --help
node scripts/isolated.mjs node bin/tenable-axi.js --version
corepack pnpm test
corepack pnpm run lint
corepack pnpm run spec:check
corepack pnpm run docs:check
```

See [verification](CONTRIBUTING.md#verification) for offline isolation and test selection.
The [capability map](docs/design.md#capability-map) defines planned v1 scope; the generated [inventory](inventory/capabilities.json) records every pinned operation's classification and does not enable execution.
After catalogue changes, rebuild and run `corepack pnpm run docs:generate` to regenerate the README table, command reference and skill.
Tests and manual CLI checks use temporary HOME/XDG directories and synthetic fixtures, with no live tenant or real credentials.
Pull requests are validated locally; hosted checks run only during [release publication](#releases).

## Releases

Release-please owns versions, tags, release notes and changelog updates.
The release workflow publishes only when release-please creates a release, after build, lint, offline fake tarball tests, spec and documentation checks.
It publishes the verified tarball with npm provenance through OIDC trusted publishing, with no stored npm token.
Before the first release, configure npm's trusted publisher for `knowttl/tenable-axi` and `.github/workflows/release-please.yml`, and complete the separate live acceptance in the design.
This change does not publish a package or run that workflow.

Licensed under the [MIT License](LICENSE).
