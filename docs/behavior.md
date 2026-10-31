# Behavior reference

- [Credentials and transport](#credentials-and-transport)
- [Exposure Response](#exposure-response)
- [Inventory exports](#inventory-exports)
- [Inventory reads](#inventory-reads)
- [Doctor and exposure cards](#doctor-and-exposure-cards)
- [Platform tags](#platform-tags)
- [Attack evidence and connector logs](#attack-evidence-and-connector-logs)
- [Attack exports](#attack-exports)

## Credentials and transport

Inventory reads and exports, attack searches and connector logs are implemented.
Attack path, attack technique and MITRE heatmap exports support guarded creation, status and redacted file downloads.
`tag list`, `tag properties`, `card list` and `card show` provide bounded Exposure Management reads.
Platform tag categories, values, assignments, exclusions and dynamic filter definitions are implemented, including guarded mutations.
Home starts with the absolute current executable path and the tool description, including on authentication failures.
Only the actual home-directory prefix is collapsed to `~`.
Home shows up to five exposure cards when configured and setup guidance offline otherwise.
Exposure response initiatives and combinations support reads and guarded writes, including allowed combination filters.
`hook` reports local profile context without resolving secrets or contacting Tenable.
Help, version, `auth status`, `profile list` and `config path` remain local.

Credentials use the strict versioned config and SecretRefs described in [profiles and authentication](design.md#profiles-and-authentication).
Run `tenable-axi config path` to find the platform config path, or set both `TENABLE_AXI_ACCESS_KEY` and `TENABLE_AXI_SECRET_KEY` for an environment profile.
Run `tenable-axi auth status` to check sources and file security locally without printing key values; `accessKey` and `secretKey` report only `env` or `file`.
Home and auth status omit environment variable names and private configuration/secret paths from output and guidance; auth status no longer exposes a `config` field, including through `--fields`.
The package ships [axi-credential.schema.json](../axi-credential.schema.json) for hosts.

The internal transport enforces the exact commercial origin, reviewed catalogue bindings, escaped paths, scoped continuations, and redirect refusal.
One transport instance represents one invocation, sharing the [transport budgets](design.md#transport-contract) across pages and retries.
Read operations may retry 429/502/503/504 twice; writes require coordinator authorization and never replay automatically.
Transport errors carry a stable code, operation, optional HTTP status and `retryAfter` in milliseconds, plus bounded redacted guidance.
For 2xx responses handled as JSON that fail parsing or transport schema validation, `RESPONSE_INVALID` includes the HTTP `status`, `contentType`, `shape` and `shapeTruncated`; schema failures also include `issues`, `issuePaths` and `issuePathsTruncated`.
This includes non-JSON bodies such as HTML login pages, whose shape reports only a root `string` type.
These diagnostics report types and expected types, never response values or validator messages.
Content-type parameters are discarded; missing or invalid media types become null.
Shape keys accept only an ASCII letter followed by up to 39 ASCII letters, digits or underscores, excluding GUID-like names, and pass through the existing redactor; other keys become `<key>`.
Arrays report their count and sample only the first element at `[*]`; reports stop at 64 entries, depth four, 256 characters per path or 4096 total path characters.
Later command-specific checks and export file parsing may still report only a fixed message.
Production binds reviewed inventory search/properties and exports, Exposure Management tag and card reads, attack searches, attack exports, connector logs, platform tags and Exposure Response commands; offline tests use synthetic fixtures and a CA-verified loopback HTTPS fake through the internal construction seam.
No flag or environment variable enables that seam in the CLI.

Inventory and attack export creation, platform tag mutations and Exposure Response writes use the write coordinator and are read-only by default.
It enforces immutable configured scope, redacted previews, exact confirmation, optional host approval, stale-state refusal and a durable private journal before a single authorized send.
Unknown outcomes include an audit ID and read-back guidance and are never replayed.
Named write commands register strict mutation definitions alongside transport bindings in the catalogue and call `createWriteCoordinator().run(operationId, input, options)`.
State readers establish no-ops and include concurrency fields in the compared state; operation definitions own documented payload validation and read-back guidance.

## Exposure Response

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

## Inventory exports

Use `export asset start` or `export finding start` to preview the filters, properties, format and compression for a tenant-side job.
The selected file profile must configure `writes.allowWrites: true` and allow the exact `inventory-export-assets` or `inventory-export-findings` operation, including for previews.
Optional `--body-file` accepts strict documented query/filters JSON, or `-` for stdin, within 1 MiB.
Query options use `--properties`, `--use-readable-name true|false`, `--max-chunk-file-size`, `--sort`, `--file-format JSON|CSV` and `--compress true|false`.
Choose comma-separated `--properties` names from `asset properties` or `finding properties`; `id` maps to `asset_id` or `finding_id` respectively, while other names pass through unchanged.
Run again with `--execute --confirm '<exact preview confirmation>'` to create once and return immediately; exports have no server dry run or idempotency guarantee.
`TENABLE_AXI_READ_ONLY=true` overrides every configured write policy.
`export asset jobs` and `export finding jobs` expose `--status` and `--limit` (default 100, maximum 1000), returning only the last three days without server paging or a claim of complete history.
`export inventory status --id <id>` reads once without polling and reports available chunks.
`export inventory download --id <id> --chunk <number> --output <new-file>` downloads one explicit chunk and prints file metadata only.
Files are validated as JSON or CSV, scanned for secrets, redacted and published atomically without overwrite; gzip exports are decoded and re-encoded with the same format.
Inventory JSON chunks must contain arrays of objects.
See [download bounds](design.md#collections-jobs-and-bounded-reads) for file size and decompression limits.

## Inventory reads

Use `asset list/show/properties`, `finding list/show/properties/summary`, and `software list/properties` with `--help` for their flags and examples.
Lists default to 100 rows, expose upstream totals when supplied, and return a cursor when more rows remain.
`--all` remains bounded by 10,000 rows and the shared transport budgets; resume with the returned `--cursor` and original selectors, filters, sort, and fields.
Offset paging does not provide snapshot isolation.
`--fields` selects display or wire properties and automatically requests extra properties; `--full` removes the 1,000-character text preview without adding fields or rows or changing invocation bounds.
For inventory reads and `tag list`, `--extra-properties` also adds the requested properties to the output, even when omitted from `--fields`.
Absent selected inventory properties render as `null`; present malformed values still fail validation.
Inventory sort accepts display aliases such as `name`, `class` and `exposureScore` and maps them to each kind's documented sortable keys.
Unknown sort names return the valid choices before making a request.
`asset show` includes FQDNs and last-observed time; `finding show` includes asset ID, CVEs and sensor type, and `finding list` includes sensor type.
`finding summary` counts each severity and sensor type published in the pinned properties examples, including deprecated sensor types, using 19 sequential limit-1 searches and `pagination.total` without retries.
It accepts profile/config selection, does no per-host grouping, and retains completed counts with `complete: false` if a read fails or the unchanged invocation budget runs out.
Missing `pagination.total` fails validation rather than inventing a count.
These counts are independent reads rather than a snapshot, and sensor values can overlap; their sum is not a distinct finding total.
Simple filters use `--filter 'severity = ["HIGH"]'`; `--filter-file` accepts a flat JSON array of `{property, operator, value: string[]}` and rejects nested boolean expressions.
Software defaults to name, version, and publisher because the pinned API exposes no stable software ID.

## Doctor and exposure cards

`doctor` validates local configuration and file security, then performs one read each for assets, findings, software, attack paths, attack techniques, initiatives, export jobs and connector logs without retries or writes.
Each check reports `ok`, `permission-denied` for HTTP 403 with its privilege advice, or `error`; any unsuccessful check exits nonzero while the other modules are still checked within the existing budgets.
Probes use minimum documented page sizes; initiatives and connector logs have no server paging, so their collection reads remain bounded by the shared byte and deadline limits.
`connector logs` includes sync UUID, type, trigger reason, first failed stage name and first ERROR message, preferring summarized text over full text.
Failure details are `null` when no matching stage or log exists, and error text follows the same redaction, preview and `--full` behavior as other text.
Collections expose returned count, upstream total when known, completeness and a scoped resume cursor.
Card lists and home accept upstream pages of up to 25 cards even when fewer are requested, emit only the requested limit, and preserve overflow in a scoped, redacted cursor bounded at 64 KiB.
Pages above 25 cards or cursors above this bound fail validation rather than dropping cards.
Ordinary lists default to 100 output rows.
`--all` remains subject to invocation budgets and the 10,000-row ceiling.
Resume with `--cursor` and the same profile, fields, filters and sort.
Offset pagination does not promise snapshot isolation.
Tag `value` maps to the documented `name`; `category` requests `tag_category_name` through extra properties and remains null when unavailable.
Explicit `--extra-properties tag_category_name` adds the `category` output field even when `--fields` omits it.
Tag filter files contain the pinned API's strict array of `{property, operator, value}` filters, with string arrays for `value`; this endpoint does not define nested boolean filters.
Use `--help` on each leaf for selectors and defaults.

## Platform tags

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

Platform tag writes require `writes.allowWrites: true` and the exact operation ID from the [ledger](design.md#complete-operation-ledger) in `writes.operations`, including for previews.
They use the same preview, `--execute --confirm '<exact preview confirmation>'`, forced read-only override and private journal as export creation.
`tag value bulk-delete --ids-file <file>` consumes a JSON array of exact value UUIDs.
`tag assignment add/remove --asset-ids-file <file> --tag-ids-file <file>` consumes two JSON UUID arrays, confirms both complete sets, and returns one asynchronous job without polling.
Input files accept `-` for stdin, with only one stdin consumer and a 1 MiB bound per file.
State reads, including per-target checks for bulk operations, share invocation budgets; narrow large target sets when those budgets are exhausted.
Identical verified updates/creates and already desired assignments return successful no-ops; an unverified missing-resource response remains an error.
Deleting a category also deletes its values and assignments; deleting values removes their assignments while retaining the category.
Value delete and bulk-delete accept unconstrained or undecodable HTTP 2xx replies as exit-0 success once the `SUCCESS` journal outcome is durably recorded.
An undecodable reply includes a warning, audit ID and status; read back the target before retrying.

## Attack evidence and connector logs

Use `attack-path list`, `attack-technique list`, and `connector logs` with `--help` for their flags and examples.
Attack paths use the published `/api/v1/t1/apa/top-attack-paths/search` route.
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

## Attack exports

Use `export attack-path start`, `export attack-technique start` or `export mitre-heatmap start` with a strict JSON `--body-file`, for example `{"file_format":"JSON"}`, using `"JSON"` or `"CSV"` and the operation's options from the [pinned specification](../specs/exposure-management.json).
The body is limited to 1 MiB; `--body-file -` reads stdin.
Export filter logical operators use lowercase `and`/`or`, including attack path exports.
Select a configured profile with `--profile`; its `writes.allowWrites` must be true and `writes.operations` must include the exact operation ID (`apa-export-attack-path`, `apa-export-attack-technique` or `apa-export-mitre-heatmap`), even for previews.
Environment profiles cannot enable writes, and `TENABLE_AXI_READ_ONLY=true` blocks all creation.
Preview first, then pass `--execute --confirm '<exact-preview-confirmation>'` to create one job and return immediately.
Exports require `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE` and the corresponding upstream entitlement.
Use `export attack status --id <id>` for a single status read, or add `--wait` to poll within the shared deadline and request budgets.
If a polling budget expires after a validated pending response, `--wait` returns the last validated job with `complete:false` and `reason:POLL_BUDGET_EXCEEDED`, including when retries exhaust the request budget or an in-flight poll reaches the deadline.
Without a validated status, budget exhaustion remains an error; other polling failures remain errors.
Use `export attack download --id <id> --output <new-file>` to download JSON or CSV, including gzip-encoded files, with format-aware secret redaction and atomic publication within the [download bounds](design.md#collections-jobs-and-bounded-reads).
Attack JSON downloads accept arrays of objects and top-level objects, including MITRE heatmap Navigator layers.
Downloads refuse overwrite and print file metadata only.
Attack and inventory job namespaces are separate; these commands never address inventory export jobs.
