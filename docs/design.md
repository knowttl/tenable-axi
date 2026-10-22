# tenable-axi design

Planning baseline prepared on 2026-10-22.
This document defines intended behavior; T1 ships the scaffold, pinned specifications, generated types, complete inventory and local home/help/version commands, T5 ships the six inventory search and properties reads, T6 ships tags, exposure cards, home and doctor, and T7 ships attack searches and connector logs.
Remaining endpoint commands and safety boundaries below remain commitments for later slices.

## Purpose and scope

Provide an agent-friendly CLI for Tenable One with full read and write operation parity for the approved modules in v1.
Cover all 24 Exposure Management operations, platform tags, and exposure-response initiatives with their supporting combinations.
Publish [knowttl/tenable-axi](https://github.com/knowttl/tenable-axi) and npm package `@knowttl/tenable-axi`.
Support only `https://cloud.tenable.com` in v1.
Upstream permissions and licences remain prerequisites; command availability never implies permission to run it.
Credential issuance, users, roles, and access-control management stay blocked, including inside otherwise approved payloads.
Other Platform and Vulnerability Management domains remain outside this Tenable One scope.
No arbitrary REST, raw request, or generic write command is exposed.
No design research or automated test uses a live tenant or credential.

## Accepted decisions

| Decision | Choice and consequence |
|---|---|
| Runtime | TypeScript, strict ESM, `axi-sdk-js`, `@toon-format/toon`, and zod; minimum Node.js version in [package.json](../package.json). |
| API client | Thin hand-written `fetch` transport; generate compile-time types only from pinned OpenAPI bytes. |
| Coverage | 50 approved operations: 31 reads and 19 writes; 310 blocked across three specs. |
| Writes | Implemented in v1 but read-only by default, with per-profile policy, preview, exact-target confirmation, and journal. |
| Export jobs | All five creation operations are writes; status, lists, and downloads are reads. |
| Region | Exact commercial origin only; no alternate-origin flag or redirect. |
| Hosted use | Shipped strict credential schema and importable catalogue for later artium-axi integration. |

The [pyTenable library](https://github.com/tenable/pytenable) remains research reference material rather than a runtime dependency.
The investigation of [pyTenable at b3ed887](https://github.com/tenable/pytenable/tree/b3ed887) found 21 exact matches to the 24 Exposure Management operations, two undocumented endpoints, and a different top-attack-paths route.
The published specification is the reviewed operation source; do not silently substitute undocumented SDK routes.
TypeScript follows the [vectra-axi design](https://github.com/knowttl/vectra-axi/blob/main/docs/design.md) and fits artium-axi's npm pinning and schema-driven adapter.
A Python SDK would still leave AXI policy, safe credentials, paging, and output to this tool while adding another runtime and packaging path.
A generated runtime client would still need replacement auth, errors, retry, origin, and write policy, so types-only generation is the simpler boundary.

## Evidence and API contracts

The [API navigation](https://developer.tenable.com/reference/navigate) separates Exposure Management from Platform and Vulnerability Management.
Downloads on 2026-10-22 identify all three as OpenAPI 3.1.2 with `info.version` 1.0.0.
Pin the full SHA-256 because that version string does not identify a particular snapshot.
T1 commits these unmodified snapshots, their byte hashes and generated declarations.

The authoritative source URLs, operation counts and SHA-256 hashes are in [inventory/specs.json](../inventory/specs.json), checked against the snapshots by `spec:check`.

Fifteen Exposure Management operations warn that their response structure is beta and subject to change.
Some filter examples disagree with schema enums and value types.
Validate filters offline against the schemas and record discrepancies with synthetic fixtures rather than accepting arbitrary grammar.
Recheck documented parameters, privileges, bodies, and responses while implementing each slice.
T13 verifies the documented `/api/v1/t1/apa/top-attack-paths/search` route before release.

## Capability map

The complete operation ledger below classifies every method/path in the three snapshots exactly once as `v1-read`, `v1-write`, or `blocked`, with its reason.
POST searches are reads; HTTP verb alone does not determine effect.
Parity covers the approved business operations and their non-security parameters, including dynamic tag filters and exposure-response combinations, subject to the explicit security exclusions.
Tag `access_control` input is rejected before HTTP on create/update; read responses may report permissions but cannot change them.
Initiative owner UUIDs are supplied explicitly without exposing user discovery or administration.

| Module | Reads | Writes | Slice |
|---|---:|---:|---|
| Inventory assets, findings, software | 6 | 0 | T5 |
| Exposure Management tags and cards | 4 | 0 | T6 |
| Attack paths, techniques, connector logs | 3 | 0 | T7 |
| Inventory exports | 4 | 2 | T8 |
| Attack path exports | 2 | 3 | T9 |
| Platform tags | 7 | 8 | T10 |
| Exposure response | 5 | 6 | T11 |

Credential minting stays permanently blocked, particularly `users-keys`: generating keys invalidates the caller's existing pair.
User, role, group membership, permissions, and access-control operations are never reachable through commands or fallback routes.
Blocked means unavailable in v1 with no hidden passthrough.

## Architecture and module depth

The execution path is strict command catalogue -> caller-shaped Tenable session -> single HTTPS sink -> runtime decoder -> safe projection/redaction -> AXI output.
The session hides credential resolution, operation binding, budgets, paging, transport errors, and runtime decoding from command handlers.
Keep related domain functions together instead of adding forwarding wrappers per endpoint.
The write coordinator owns a separate authorization boundary.

One typed executable catalogue owns grammar, flags, effect, method/path, operation ID, decoder, default fields, paging, privileges, and evidence references.
The inventory records every upstream operation, including blocked ones, with source URL/hash, disposition, reason, and slice.
Evidence entries never enable execution: commands bind reviewed operations explicitly and the sink refuses absent or mismatched bindings.
Catalogue data generates concise help, reference, static skill, and hosted inventory.

T1 pins `openapi-typescript` as a dev dependency and generates separate declarations from all three specs.
There is no generated runtime client, auth helper, or request behavior.
Offline `spec:check` verifies byte hashes, complete operation classification, and deterministic regenerated declarations against committed files.
An explicit refresh reviews route, field, permission, paging, and error changes before updating hashes.
CI never requires fetching a floating upstream spec, and new operations stay blocked pending review.

Zod decoders require only fields rendered by the selected view and tolerate extra upstream fields.
Decode explicitly requested extra fields without requiring the entire generated schema at runtime.
Keep missing optional values distinct from required-field failures; never replace absent scores or denied data with zero.
Strict command/profile/request validation is separate from tolerant response decoding.

### Transport contract

There is one network sink and no domain-level `fetch` call.
Build paths from reviewed templates and escaped identifiers, never caller URLs.
Require canonical origin `https://cloud.tenable.com`, without userinfo, path, query, fragment, alternate port, or alternate origin.
Keep TLS verification enabled and set `redirect: error`.
Validate continuation and download destinations before any send and refuse traversal or unregistered routes.
Only the sink composes `X-ApiKeys: accessKey=<accessKey>; secretKey=<secretKey>`.
Reject key values containing header delimiters or control characters.

Default invocation budgets are 20 seconds, 20 requests, and 20 MiB of decoded responses, including retries and pages.
Each request is cancellable with only the remaining deadline.
Reads, including reviewed search POSTs, may retry 429 and reviewed transient 502/503/504 responses at most twice within those budgets.
Honor valid `retry-after` seconds or HTTP dates first; return `RATE_LIMITED` immediately with `retryAfter` if the delay exceeds the remaining budget.
Without a valid header use bounded backoff of 250 ms then 500 ms within the same deadline.
If retries are exhausted while the service still returns 429, return `RATE_LIMITED` with the last valid delay and actionable retry guidance.
Never automatically replay writes, including export creation, because an interrupted send may already have changed the tenant.
A mutation 429 returns `RATE_LIMITED` and its delay without replay.

Translate all documented error bodies into `error: {code, message, operation, status?, retryAfter?, auditId?}` and contextual `help` when useful.
Handle `{statusCode,error,message}`, `{message,status}`, `{error,message}`, connector `{detail:...}`, Exposure View `{status,message,error:[]}`, and selected Platform/VM variants.
Handle empty bodies, malformed JSON, schema-less responses, and HTML 429 without emitting raw HTML, dependency output, or stack traces.
Map 401 to authentication failure, 403 to permission denial with operation-specific advice, 404 to missing resource, and invalid input to actionable validation guidance.
Malformed successful responses produce `RESPONSE_INVALID`, never plausible empty data.
Redact bounded error text before any channel renders it.

## Profiles and authentication

Follow the public [AXI credential standard](https://github.com/knowttl/artium-axi/blob/main/docs/credential-standard.md) and [host credential guidance](https://github.com/knowttl/artium-axi/blob/main/docs/tool-credentials.md).
The prefix is `TENABLE_AXI`.
The strict versioned configuration has this shape:

```json
{
  "version": 1,
  "defaultProfile": "example",
  "profiles": {
    "example": {
      "origin": "https://cloud.tenable.com",
      "accessKey": {"env": "TENABLE_AXI_ACCESS_KEY"},
      "secretKey": {"env": "TENABLE_AXI_SECRET_KEY"},
      "writes": {"allowWrites": false, "operations": []}
    }
  }
}
```

Both key fields are SecretRefs accepting exactly `{"env":"NAME"}` or `{"file":"<absolute-path>"}`.
Omitted refs default to the corresponding `TENABLE_AXI_ACCESS_KEY` and `TENABLE_AXI_SECRET_KEY` refs; both resolved values are required.
Reject inline secrets, unknown keys, malformed refs, and `stored` refs.
Validate env reference names against `^[A-Za-z_][A-Za-z0-9_]*$` while loading configuration and never echo rejected values.
Ship `axi-credential.schema.json` as the schema of one profile with `x-secret: true` on both key fields.
No `auth login`, `auth logout`, token minting, credential storage, browser login, or vendor `TO_*` aliases are provided.

Config selection is `--config`, then `TENABLE_AXI_CONFIG`, then the platform default.
Profile selection is `--profile`, `TENABLE_AXI_PROFILE`, complete env profile, configured default, then sole profile.
File-selected profiles ignore env profile fields, and partial env profiles fail instead of mixing sources.
`TENABLE_AXI_ORIGIN` may select only the allowed origin; absence defaults to it.
Env profiles cannot enable writes and command flags cannot widen the configured write policy.
`TENABLE_AXI_READ_ONLY` accepts `1`/`true`, `0`/`false`, or unset, case-insensitively; other values fail closed with `CONFIG_INVALID`.

Linux/macOS config uses absolute `$XDG_CONFIG_HOME/tenable-axi/config.json`, otherwise `~/.config/tenable-axi/config.json`.
State uses absolute `$XDG_STATE_HOME/tenable-axi`, otherwise `~/.local/state/tenable-axi`.
Windows ignores XDG and uses `%APPDATA%\tenable-axi` for config and `%LOCALAPPDATA%\tenable-axi` for state.
Use `os.homedir()`, no repository-local discovery, and profile names matching `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`.
One private-file module enforces regular files, no symlinks/reparse points, POSIX ownership, 0700 directories, config not writable by group/other, and secret files with no group/other bits.
Windows uses protected DACLs granting only the current user, SYSTEM, and Administrators, applied before writes.
Secret files use UTF-8 with BOM and trailing whitespace removed; reject Windows UNC/device paths.
Private writes are atomic and flushed, with bounded Windows rename retries per the credential standard.
Windows DACL verification belongs in `auth status` and `doctor`, with injectable platform/ACL seams for offline tests.
Use stable credential errors `AUTH_REQUIRED`, `CONFIG_INVALID`, `CONFIG_INSECURE`, `PROFILE_REQUIRED`, `PROFILE_AMBIGUOUS`, and `PROFILE_NOT_FOUND`, reserving `CONFIG_MOVED` for any explicitly supported future migration.

Register exact access/secret values and the complete composed header, including its actual spacing, in raw, JSON-escaped, and URL-encoded forms.
Redact stdout, stderr, errors, previews, downloaded content where applicable, and journal records.
Also apply key-name and secret-pattern redaction to upstream JSON; never show request headers.
Use a dedicated least-privilege Tenable user per integration with only the modules and explicit writes needed.
Inventory reads need `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ`; exports need its `EXPORT` privilege.
Tags, exposure view, and attack paths require their corresponding `EXPOSURE_MANAGEMENT.*.READ` privileges.
Attack path exports need `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE`.
Connector logs require Administrator, so log denial must not imply granting Administrator for ordinary inventory use.
Platform tags and initiatives retain their documented per-operation permissions and ownership constraints.
Keys share the user's rate budget and rotation invalidates the old pair; do not promise overlapping validity.

## CLI and output contract

Use noun/subnoun/verb grammar, named selectors, kebab-case flags, and no prompts.
`--profile`, `--config`, and `--help` are common flags; declare `--fields` and `--full` on output-bearing leaves.
Reject unknown flags, unexpected arguments, invalid combinations, and duplicate non-repeatable flags before credentials or HTTP, with exit 2 and valid flags inline.
Lists expose `--limit` (default 100), `--offset` where supported, `--cursor` for bounded resume, and `--all` mutually exclusive with `--limit`.
Search leaves expose documented `--query`, repeatable `--filter`, `--sort`, and domain flags only where supported.
Never silently implement unsupported server filters by scanning every record.

The ledger maps every approved operation to its planned command.
This table defines selectors, extra flags, and compact projections; display field names map to documented wire fields in each decoder.

| Commands | Selectors and additional flags | Default list fields |
|---|---|---|
| `asset list/show/properties` | Show: `--id`, using exact ID search; list: query/filter/sort and `--class`. | id, name, class, exposureScore |
| `finding list/show/properties` | Show: `--id`, using exact ID search; list: query/filter/sort. | id, name, severity, state |
| `software list/properties` | Query/filter/sort; the [pinned spec](../specs/exposure-management.json) exposes no stable software ID. | name (application), version (extra_properties.version), publisher |
| `tag list/properties` | Exposure Management query/filter/sort. | id, category, value |
| `card list/show` | List: `--global`, `--query`, `--sorting-order`; show: `--id` and trend/SLA flags below. | id, name, score |
| `attack-path list` | Documented filters/sort and `--include-resolved`; AI summarization off by default. | id, name, priority |
| `attack-technique list` | Documented filters/sort and `--include-resolved`. | id, name, affectedAssets |
| `connector logs` | Documented connector/time selectors and bounded limit. | connectorId, status, timestamp |
| `export asset start`, `export finding start` | Strict `--body-file` for documented filters/options; write flags. | id, state |
| `export asset jobs`, `export finding jobs` | Documented filters and pagination. | id, state, createdAt |
| `export inventory status/download` | `--id`; download requires `--chunk`, `--output`. | id, state, availableChunks |
| `export attack-path start`, `export attack-technique start`, `export mitre-heatmap start` | Strict `--body-file` for format/filter options; write flags. | id, state |
| `export attack status/download` | `--id`; download requires `--output`. | id, state |
| `tag category list/show/create/update/delete` | Show/update/delete: `--id`; create/update: `--name`, optional `--description`; list: repeatable `--filter`, `--filter-type and\|or`, `--sort`. | id, name, reserved |
| `tag value list/show/create/update/delete/bulk-delete` | Show/update/delete: `--id`; create/update: `--body-file`; bulk-delete: `--ids-file`; list: filter/type/sort, `--with`, `--with-filter` for `w`/`wf`. | id, category, value, type |
| `tag assignment list/add/remove` | List: `--asset-id`; add/remove: `--asset-ids-file`, `--tag-ids-file`. | assetId, tagId, value |
| `tag exclusion list`, `tag asset-filter list` | Exclusions: `--tag-id`, `--target-type`, paging; filters: no selector. | targetId, targetType; property, operators |
| `initiative list/show/create/update/delete` | Show/update/delete: `--id`; create/update: strict `--body-file` with name, scope, combination IDs, Tenable IDs, owner, SLA, optional description. | id, name, owner, slaInDays |
| `combination list/show/create/update/delete`, `combination filters` | List: `--type private\|shared\|tenable`; show/update/delete: `--id`; create/update: strict `--body-file` with name, query, is_public, optional description. | id, name, type; property, operators |

`--body-file -` and explicit list files accept stdin; reject competing stdin consumers and enforce input size bounds.
Payloads are operation-specific, reject unknown/security fields recursively, and cannot select a method/path.
Tag create supports category UUID or name, category description, value, description, and dynamic filters, excluding `access_control`.
Tag update supports its version field and filters, excluding `access_control`.
Initiatives validate at most ten scope tags and documented combination/query limits without discovering owners through blocked endpoints.

The following parameter mappings complete the Exposure Management flag contract.
Boolean value flags accept explicit `true` or `false` where callers need both states; convenience `--include-resolved` sets upstream `exclude_resolved=false`.
All unspecified API defaults follow the pinned schema, except the CLI's explicit row limits and disabled AI summarization.

| Leaves | Additional mapping |
|---|---|
| Inventory and tag searches | `--extra-properties` maps `extra_properties`; `--fields` automatically requests properties needed by the selected projection; `--filter-file` accepts the [pinned spec's](../specs/exposure-management.json) flat array of {property, operator, value: string[]}, mutually exclusive with repeatable simple `--filter`; nested boolean expressions are unsupported. |
| `asset properties` | `--asset-classes` maps the documented `asset_classes` array; list `--class` is a validated server-side class filter rather than an invented query parameter. |
| Attack searches | `--filter-file` represents the documented single/nested filter body; `--sort`, offset/limit, and `--include-resolved` map their query fields; attack paths also exposes `--run-ai-summarization true\|false`, default false. |
| `connector logs` | `--connector-id`, `--status`, `--start-date`, `--end-date` map the four documented query fields; dates use YYYY-MM-DD. |
| `card list` | `--global true\|false` maps `is_global_card`, `--query` maps `text_query`, and `--sorting-order asc\|desc` maps `sorting_order`. |
| `card show` | `--trend-start-date`, `--trend-end-date`, `--sla-efficiency-start-date`, `--sla-efficiency-end-date` use UTC ISO 8601 timestamps; `--sla-breakdown-filter ANY\|REMEDIATED\|NON_REMEDIATED` and `--include-trend-events true\|false` map their snake_case fields. |
| Inventory export starts | `--properties`, `--use-readable-name true\|false`, `--max-chunk-file-size`, `--sort`, `--file-format`, `--compress true\|false` map query fields; `--body-file` contains only the documented query/filters. |
| Inventory job lists | `--status QUEUED\|PROCESSING\|FINISHED\|ERROR` and `--limit`; there is no server-side offset or continuation parameter. |
| Attack export starts | Body fields include `file_format`, filter(s), columns, file_name, and operation-specific vector/technique IDs and sort exactly where documented. |

Inventory and tag simple filters use `--filter '<property> <operator> <JSON-array-of-strings>'`; their filter files preserve the [pinned spec's](../specs/exposure-management.json) flat property-filter array without inventing nested boolean expressions.
Attack structured files preserve the schema's nested boolean expressions without inventing a universal grammar.
Property names remain tenant-specific and API validation errors suggest the corresponding properties command.
Attack searches require wire limits of at least 100 even for smaller output windows, so retain excess rows in bounded continuation state.
Card wire pages cap at 25; home requests five.
Job lists without paging cannot promise complete history beyond the server's maximum; output marks that limitation explicitly.

Keep JSON internally and encode [TOON](https://toonformat.dev/reference/spec) at stdout.
Structured data, errors, and relevant `help[]` use stdout; diagnostics and progress use stderr.
Exit 0 means success/no-op, 1 runtime failure, and 2 usage failure.
Detail text previews 1,000 characters with original length and a `--full` hint only when truncated.
`--full` never disables byte, time, request, or row bounds.
Lists carry returned count, upstream total when supplied, completeness, and continuation separately from array headers.
Unknown totals stay unknown; never infer them from page length.
An empty success says, for example, `0 findings matched the selected filters`, with exit 0.
Denied, unavailable, and malformed responses are errors rather than empty states.
Suggestions preserve profile and filters and use placeholders for unknown IDs.

No arguments and `home` print executable path with home collapsed to `~`, one-sentence description, profile/origin, effective read-only policy, and up to five live exposure cards when configured.
An unconfigured home gives setup state without HTTP.
The session hook prints a compact local-only profile summary, so session start does not implicitly contact the tenant.
`auth status`, `profile list`, and `config path` are local and show sources rather than secret values.
`doctor` validates config/file security and performs one bounded `inventory-tag-properties-list` read without retries or writes.
Doctor privilege advice is operation-specific; it cannot prove access to all modules.
Bare `-v`, `-V`, and `--version` print only the version and exit 0 through `axi-sdk-js/fast-path` before dynamic import of the graph.
Every leaf has concise `--help` with defaults, required arguments, and two or three complete examples.

## Collections, jobs, and bounded reads

Use operation-specific paging shapes, minimum sizes, and maxima; do not blindly send default 100 to every endpoint.
Fetch sequentially only what is needed for the requested output.
`--all` is bounded by 10,000 emitted rows and the shared 20-request, 20-second, 20-MiB budgets.
A normal budget stop emits `complete:false`, reason, and resumable cursor; a partial transport/schema failure retains valid rows but exits 1.
Cursors bind origin, profile identity, operation, filters, sort, and within-page position, preserve unreturned rows, and detect repeated continuations.
Offset paging does not promise snapshot isolation.
Unpaged collections still obey byte/output limits without invented paging parameters.

Export start creates one job and returns immediately; status is a separate read with no default polling.
Inventory status exposes available chunks; download addresses one explicit chunk ID.
Attack exports use separate status/download commands so IDs cannot accidentally select the wrong API family.
Downloads require an explicit new output file, use a bounded temporary file and atomic completion, refuse overwrite, and print metadata only.
T8/T9 define format-aware JSON/CSV secret scanning and redaction before enabling downloads, with synthetic fixtures and a hard byte ceiling.
Download invocations use a separate 128-MiB encoded and decoded file ceiling so the documented inventory chunk sizes up to 100 MiB are supported; ordinary JSON responses retain the 20-MiB budget.
Compressed exports are decoded within that ceiling for format validation/redaction and re-encoded as requested; decompression exceeding the ceiling aborts without publishing a partial file.
Never journal export contents or follow an unvalidated download URL.
Downloads remain read-class despite the explicit local output effect; the host maps it through a controlled artifact boundary.

## Mutation coordinator

Follow the [Vectra coordinator](https://github.com/knowttl/vectra-axi/blob/main/src/writes.ts): default read-only, immutable configured scope, explicit execution, durable redacted audit.
Use upstream operation IDs from the ledger in `writes.operations`.
An empty allowlist denies all mutations; wildcards, CLI flags, and env profiles cannot expand it.
`TENABLE_AXI_READ_ONLY=true` overrides every profile, including export creation.

Enforce this order:

1. Validate the named operation, non-security payload, immutable origin, and exact target.
2. Enforce forced read-only, `writes.allowWrites === true`, and explicit allowlist, including for previews.
3. Read current state where supported and render a local redacted preview of target, current state, proposed payload, effect, and confirmation string.
4. Without `--execute`, return the preview; explicit `--dry-run` does the same and is mutually exclusive with `--execute`.
5. Require `--confirm` equal to the exact preview target for every v1 write and apply a host approval hook when supplied.
6. Durably reserve intent, re-read mutable targets, refuse changed preview state, send once through single-use authorization bound to sender/method/path/payload, and durably record outcome.

Single-resource confirmation includes profile, kind, and UUID; creates include profile, kind, and exact proposed name.
Bulk/export confirmation includes the full sorted target set or digest of the full canonical payload plus profile/operation, printed in the preview.
A count alone never approves a target set.
Exports preview filter/format scope and tenant-side job creation; there is no server-side dry run or claim of creation idempotency.
Verified identical updates, identical existing creates, absent deletes, and already-added/removed assignments are exit-0 no-ops where reads establish desired state.
A duplicate name with different state or an unverified 404 is not a no-op.
Use the tag version field for concurrency and conditional headers only where documented.
Re-reading narrows a race but does not provide atomic compare-and-set.

The journal defaults to state-directory `writes.log`, with nonblank `TENABLE_AXI_WRITE_LOG` override for hosts.
It is logically append-only, private, redacted, and serialized under an exclusive lock, preserving prior records through atomic replacement and flushing before success.
Intent metadata includes time, audit ID, profile, operation, target/digest, and effect; outcome includes status and result.
Exclude keys, headers, bodies, and export contents.
Duplicate durable intent IDs, malformed journals, and unresolved locks block sends; never automatically remove a lock.
Intent recording failure means no send; outcome recording failure reports possible remote success.
An ambiguous disconnect/timeout returns `OUTCOME_UNKNOWN`, audit ID, and read-back guidance without replay.
Read back exports through job/status commands when possible; never claim an unknown create did not happen.
The journal is an audit aid, not tamper-proof or a server-side exactly-once guarantee.

## Change recipe and tests

Add an endpoint by updating evidence/effect, binding a named command, writing its projection/decoder, and testing outcomes through its real public interface.
T1 configures `.no-mistakes.yaml` following vectra-axi's separated prepare/test/lint command pattern.
See [contribution verification](../CONTRIBUTING.md#verification) for affected-test selection, the fixed baseline and shared-input full-suite triggers.
Require practical observable behavior through the CLI and transport against the fake Tenable upstream.
Do not add tautological mock-echo checks, checks already covered by the compiler, or implementation snapshots.
Use our own fake transport and synthetic fixtures for populated, empty, denied, malformed, beta-extra-field, and partial cases.
Install a network-denying guard before imports, including subprocesses, allowing only the explicitly constructed fake HTTPS Tenable.
Packaged-CLI fixtures inject a test-only transport construction seam to send logical requests to loopback with synthetic keys and a test CA.
Production validation still enforces `https://cloud.tenable.com`; no production flag/env switch permits localhost or disables TLS.
The fake records requests, serves reviewed contracts, and runs with outbound networking denied across the process tree.

Use Vitest, isolated HOME/XDG, fake clock/randomness, and injectable platform ACL operations.
Test redirects, foreign continuations, secret sentinels on all channels, every documented error family, HTML 429, retry budgets, malformed delays, repeated cursors, and mid-page resume.
Exercise guarded exports, wrong confirmation, no-op assignments, stale versions, journal failure, duplicate intent, ambiguous outcome, and redaction.
Test the packed tarball against fake HTTPS for critical version/help, credential, paged-read, export, and guarded-write journeys.
No automated test needs Tenable DNS, a live tenant, or a real credential.
Repeat changed async/time/I/O tests and check process/server cleanup without sleeps.
Compare version latency to a `node -e` startup floor on the same machine instead of an absolute millisecond threshold.

## Implementation slices

Each slice aims for a few hundred hand-written lines and is independently testable with fakes.
Generated specs, declarations, and inventory rows are excluded from that size.
Split endpoint families into sequential reviewable changes if needed without widening scope or deferring acceptance criteria.
The order below is the delivery order even when dependencies allow independent preparation.

| Slice | Dependencies | Scope | Verify |
|---|---|---|---|
| T1 | Design | Scaffold; `.no-mistakes.yaml` with vectra-axi's separated prepare/test/lint commands; pinned specs/hashes; generated types; complete inventory; catalogue skeleton; version fast path. | Offline build/lint, affected tests plus a small fixed baseline, `spec:check`, 360 classifications, version output/startup-floor test. |
| T2 | T1 | Profiles, SecretRefs, private files, redaction, credential schema, local auth/profile/config commands. | Both platform branches, precedence, partial env, sentinels, no network. |
| T3 | T1 | Closed transport, origin/header policy, bounded retry/errors, network guard, fake transport/HTTPS Tenable. | Every error family, redirects, continuations, retry/deadline bounds. |
| T4 | T2, T3 | Write coordinator, immutable scope, preview, confirmation, durable journal, unknown outcome. | Default/forced read-only, allowlist, no-op, journal failures, send once. |
| T5 | T2, T3 | Assets/findings/software list, show where defined, properties, filters, paging, fields/truncation. | Populated/empty/denied/beta fixtures, budgets/resume. |
| T6 | T2, T3 | Tags, exposure cards, home, doctor. | Five-card home, unconfigured state, local hook context, one-read doctor, card details/totals. |
| T7 | T2, T3 | Attack paths, techniques, connector logs. | Published path, denied Administrator logs, paging, AI default off. |
| T8 | T4, T5 | Inventory exports: creation, jobs, status, chunk downloads. | Guarded starts, no replay/poll, chunk selection, atomic bounded redacted output. |
| T9 | T4, T7 | Attack path/technique/heatmap export creation, status, download. | WRITE privilege advice, separate job namespace, unknown outcome, bounded files. |
| T10 | T4, T6 | Platform tag categories/values, bulk deletion, assignments, exclusions, filters. | All 15 operations, nested ACL rejection, dynamic filters, version conflicts, no-ops. |
| T11 | T4, T10 | Initiatives, combinations, allowed filters. | All 11 operations, owner/scope/SLA/query limits, public/private preview, conflicts/deletes. |
| T12 | T5 through T11 | Release README, generated reference/skill and checks, SessionStart setup, release-please, npm provenance workflow. | Fake tarball acceptance, docs/skill/spec checks, build/lint/tests; review workflow without publishing. |
| T13 | T12 | Separately authorized live acceptance on `cloud.tenable.com` with supplied keys. | Doctor, read per module, disputed route, approved export/write lifecycle on disposable targets, sanitized evidence. |
| T14 | T13 | First npm release with provenance and reviewed version/tag. | Published integrity, schema/catalogue metadata, offline version/help smoke. |
| T15 | T14 | Separate artium-axi integration. | Host suite, image packaging, fake walking skeleton, credential editor/write boundaries. |

T13 never makes tests tenant-dependent and no key is requested or used in this design slice.
Live writes require approval of exact disposable targets/effects; cleanup uses the same guard.
Resolve beta contract, permission, and download limitations before claiming parity or releasing.
Before release, perform real Windows `auth status` and protected config-write checks per credential platform guidance.

### Release and session integration

T12 adds explicit `setup hooks` opt-in for Claude Code, Codex, and OpenCode.
Install/repair a PATH-verified executable name or absolute fallback, idempotently, with directory/profile-scoped context.
Use SessionStart where supported and an equivalent managed plugin for OpenCode.
Ordinary commands never install hooks.
Generate the installable skill from static home/discovery metadata, remove live state, and use `npx -y @knowttl/tenable-axi` examples.
Document hooks first and skill as complementary discovery; CI checks both reference and skill freshness.
Release-please owns versions, tags, release notes, and changelog; publishing verifies the package and uses npm provenance.

### artium-axi integration contract

T15 changes the host repository separately after the first npm release.
Pin the package in `tools/package.json`, integrity metadata, and lockfile, and smoke-check offline version in the image.
Import the pinned catalogue, write constants, and shipped credential schema to generate inventory bound to source digests.
Register shared tool schemas, executable/skill/schema paths, endpoints, rewrite/discovery, admin, health, manifests, and documentation.
Use `withCredentialProfile`: one private `artium` profile, `ARTIUM_SECRET_<n>` refs, server-owned read-only policy and write journal.
Register both keys and the composed header with the host output scanner.
Block setup, local credential/profile/config commands, caller config/profile selection, origin/credential overrides, and arbitrary server paths.
Review stdin/uploaded-file flags explicitly and map export outputs through controlled artifacts.
The host write switch adds a gate; it cannot bypass the native allowlist, preview, exact confirmation, or journal.
Add bounded health read and credential guidance, and test fake reads/writes, denied overrides, download artifacts, and redaction through the published package.
Hosted callers share one service user's rate budget, so structured throttling must fit the host deadline.

## Complete operation ledger

Each row is identified by source, operation ID, and method/path.
`v1-read` includes search POSTs and export status/downloads; `v1-write` always uses the coordinator.
Reasons below are normative; planned commands do not claim current implementation.

### exposure-management.json

| Operation ID | Method/path | Disposition | Planned command | Reason |
|---|---|---|---|---|
| `apa-attack-paths-search` | `POST /api/v1/t1/apa/top-attack-paths/search` | v1-read | `attack-path list` | Approved investigation or supporting read. |
| `apa-attack-techniques-search` | `POST /api/v1/t1/apa/top-attack-techniques/search` | v1-read | `attack-technique list` | Approved investigation or supporting read. |
| `connectors-logs` | `GET /api/v1/t1/connectors/logs` | v1-read | `connector logs` | Approved investigation or supporting read. |
| `apa-export-attack-path` | `POST /api/v1/export/attack-path` | v1-write | `export attack-path start` | Creates a tenant-side export job; gated write. |
| `apa-export-attack-technique` | `POST /api/v1/export/attack-technique` | v1-write | `export attack-technique start` | Creates a tenant-side export job; gated write. |
| `apa-export-mitre-heatmap` | `POST /api/v1/export/mitre-heatmap` | v1-write | `export mitre-heatmap start` | Creates a tenant-side export job; gated write. |
| `apa-export-status` | `GET /api/v1/export/{export_id}/status` | v1-read | `export attack status` | Approved investigation or supporting read. |
| `apa-export-download` | `GET /api/v1/export/{export_id}/download` | v1-read | `export attack download` | Approved investigation or supporting read. |
| `exposure-view-cards-search` | `GET /api/v1/t1/exposure-view/cards` | v1-read | `card list` | Approved investigation or supporting read. |
| `exposure-view-card-details` | `GET /api/v1/t1/exposure-view/cards/{card_id}` | v1-read | `card show` | Approved investigation or supporting read. |
| `inventory-assets-search` | `POST /api/v1/t1/inventory/assets/search` | v1-read | `asset list / asset show` | Approved investigation or supporting read. |
| `inventory-findings-search` | `POST /api/v1/t1/inventory/findings/search` | v1-read | `finding list / finding show` | Approved investigation or supporting read. |
| `inventory-software-search` | `POST /api/v1/t1/inventory/software/search` | v1-read | `software list` | Approved investigation or supporting read. |
| `inventory-asset-properties-list` | `GET /api/v1/t1/inventory/assets/properties` | v1-read | `asset properties` | Approved investigation or supporting read. |
| `inventory-finding-properties-list` | `GET /api/v1/t1/inventory/findings/properties` | v1-read | `finding properties` | Approved investigation or supporting read. |
| `inventory-software-properties-list` | `GET /api/v1/t1/inventory/software/properties` | v1-read | `software properties` | Approved investigation or supporting read. |
| `inventory-export-assets` | `POST /api/v1/t1/inventory/export/assets` | v1-write | `export asset start` | Creates a tenant-side export job; gated write. |
| `inventory-export-findings` | `POST /api/v1/t1/inventory/export/findings` | v1-write | `export finding start` | Creates a tenant-side export job; gated write. |
| `inventory-export-assets-jobs` | `GET /api/v1/t1/inventory/export/assets/status` | v1-read | `export asset jobs` | Approved investigation or supporting read. |
| `inventory-export-findings-jobs` | `GET /api/v1/t1/inventory/export/findings/status` | v1-read | `export finding jobs` | Approved investigation or supporting read. |
| `inventory-export-status` | `GET /api/v1/t1/inventory/export/{export_id}/status` | v1-read | `export inventory status` | Approved investigation or supporting read. |
| `inventory-export-download` | `GET /api/v1/t1/inventory/export/{export_id}/download/{chunk_id}` | v1-read | `export inventory download` | Approved investigation or supporting read. |
| `inventory-tag-search` | `POST /api/v1/t1/tags/search` | v1-read | `tag list` | Approved investigation or supporting read. |
| `inventory-tag-properties-list` | `GET /api/v1/t1/tags/properties` | v1-read | `tag properties` | Approved investigation or supporting read. |

### tenable-platform-settings.json

| Operation ID | Method/path | Disposition | Planned command | Reason |
|---|---|---|---|---|
| `vm-api-security-settings-list` | `GET /access-control/v1/api-security-settings` | blocked | - | User, role, group or access-control management; never exposed. |
| `vm-api-security-settings-update` | `PUT /access-control/v1/api-security-settings` | blocked | - | User, role, group or access-control management; never exposed. |
| `groups-create` | `POST /groups` | blocked | - | User, role, group or access-control management; never exposed. |
| `groups-list` | `GET /groups` | blocked | - | User, role, group or access-control management; never exposed. |
| `groups-edit` | `PUT /groups/{group_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `groups-delete` | `DELETE /groups/{group_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `groups-list-users` | `GET /groups/{group_uuid}/users` | blocked | - | User, role, group or access-control management; never exposed. |
| `groups-add-user` | `POST /groups/{group_uuid}/users/{user_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `groups-delete-user` | `DELETE /groups/{group_uuid}/users/{user_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v3-access-control-permission-create` | `POST /api/v3/access-control/permissions` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v3-access-control-permissions-list` | `GET /api/v3/access-control/permissions` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v3-access-control-permissions-details` | `GET /api/v3/access-control/permissions/{permission_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v3-access-control-permission-update` | `PUT /api/v3/access-control/permissions/{permission_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v3-access-control-permission-delete` | `DELETE /api/v3/access-control/permissions/{permission_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v3-access-control-permissions-user-list` | `GET /api/v3/access-control/permissions/users/{user_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v3-access-control-permissions-user-group-list` | `GET /api/v3/access-control/permissions/user-groups/{user_group_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v3-access-control-permissions-current-user-list` | `GET /api/v3/access-control/permissions/users/me` | blocked | - | User, role, group or access-control management; never exposed. |
| `access-control-roles-create` | `POST /access-control/v1/roles` | blocked | - | User, role, group or access-control management; never exposed. |
| `access-control-roles-list` | `GET /access-control/v1/roles` | blocked | - | User, role, group or access-control management; never exposed. |
| `access-control-roles-details` | `GET /access-control/v1/roles/{role_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `access-control-roles-update` | `PUT /access-control/v1/roles/{role_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `access-control-roles-delete` | `DELETE /access-control/v1/roles/{role_uuid}` | blocked | - | User, role, group or access-control management; never exposed. |
| `access-control-roles-list-permissions` | `GET /access-control/v1/role-permissions` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-create` | `POST /users` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-list` | `GET /users` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-details` | `GET /users/{user_id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-edit` | `PUT /users/{user_id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-delete` | `DELETE /users/{user_id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `access-control-users-role-list` | `GET /access-control/v1/users/{user_uuid}/roles` | blocked | - | User, role, group or access-control management; never exposed. |
| `access-control-users-role-update` | `PUT /access-control/v1/users/{user_uuid}/roles` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-password` | `PUT /users/{user_uuid}/chpasswd` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-enabled` | `PUT /users/{user_id}/enabled` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-list-auths` | `GET /users/{user_id}/authorizations` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-update-auths` | `PUT /users/{user_id}/authorizations` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-keys` | `PUT /users/{user_id}/keys` | blocked | - | Credential minting invalidates the existing API key pair; never exposed. |
| `users-two-factor-enable` | `POST /users/{user_id}/two-factor/send-verification` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-two-factor-enable-verify` | `POST /users/{user_id}/two-factor/verify-code` | blocked | - | User, role, group or access-control management; never exposed. |
| `users-two-factor` | `PUT /users/{user_id}/two-factor` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v1-access-groups-create` | `POST /access-groups` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v1-access-groups-list` | `GET /access-groups` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v1-access-groups-edit` | `PUT /access-groups/{id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v1-access-groups-delete` | `DELETE /access-groups/{id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v1-access-groups-details` | `GET /access-groups/{id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v1-access-groups-list-filters` | `GET /access-groups/filters` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v1-access-groups-list-rule-filters` | `GET /access-groups/rules/filters` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v2-access-groups-create` | `POST /v2/access-groups` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v2-access-groups-list` | `GET /v2/access-groups` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v2-access-groups-edit` | `PUT /v2/access-groups/{id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v2-access-groups-delete` | `DELETE /v2/access-groups/{id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v2-access-groups-details` | `GET /v2/access-groups/{id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v2-access-groups-list-filters` | `GET /v2/access-groups/filters` | blocked | - | User, role, group or access-control management; never exposed. |
| `io-v2-access-groups-list-rule-filters` | `GET /v2/access-groups/rules/filters` | blocked | - | User, role, group or access-control management; never exposed. |
| `audit-log-events` | `GET /audit-log/v1/events` | blocked | - | Outside approved Tenable One v1 modules. |
| `agents-list` | `GET /scanners/null/agents` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-group-list-agents` | `GET /scanners/null/agent-groups/{agent_group_id}/agents` | blocked | - | Outside approved Tenable One v1 modules. |
| `agents-get-safe-mode-summary` | `GET /agents/safe-mode-summary` | blocked | - | Outside approved Tenable One v1 modules. |
| `agents-get` | `GET /scanners/null/agents/{agent_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-agents-rename` | `PATCH /scanners/null/agents/{agent_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `agents-delete` | `DELETE /scanners/null/agents/{agent_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `agents-directives-create` | `POST /scanners/null/agents/{agent_id}/directives` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-config-details` | `GET /scanners/null/agents/config` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-config-edit` | `PUT /scanners/null/agents/config` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-exclusions-create` | `POST /scanners/null/agents/exclusions` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-exclusions-list` | `GET /scanners/null/agents/exclusions` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-exclusions-details` | `GET /scanners/null/agents/exclusions/{exclusion_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-exclusions-edit` | `PUT /scanners/null/agents/exclusions/{exclusion_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-exclusions-delete` | `DELETE /scanners/null/agents/exclusions/{exclusion_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-groups-create` | `POST /scanners/null/agent-groups` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-groups-list` | `GET /scanners/null/agent-groups` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-groups-details` | `GET /scanners/null/agent-groups/{group_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-groups-configure` | `PUT /scanners/null/agent-groups/{group_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-groups-delete` | `DELETE /scanners/null/agent-groups/{group_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-groups-add-agent` | `PUT /scanners/null/agent-groups/{group_id}/agents/{agent_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-groups-delete-agent` | `DELETE /scanners/null/agent-groups/{group_id}/agents/{agent_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `bulk-task-agent-status` | `GET /scanners/null/agents/_bulk/{task_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `bulk-task-agent-group-status` | `GET /scanners/null/agent-groups/{group_id}/agents/_bulk/{task_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `bulk-add-agents` | `POST /scanners/null/agent-groups/{group_id}/agents/_bulk/add` | blocked | - | Outside approved Tenable One v1 modules. |
| `bulk-remove-agents` | `POST /scanners/null/agent-groups/{group_id}/agents/_bulk/remove` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-agent-bulk-operations-add-to-network` | `POST /scanners/null/agents/_bulk/addToNetwork` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-agent-bulk-operations-remove-from-network` | `POST /scanners/null/agents/_bulk/removeFromNetwork` | blocked | - | Outside approved Tenable One v1 modules. |
| `agent-bulk-operations-profile` | `POST /scanners/null/agents/_bulk/assignToProfile` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-agent-bulk-operations-directive` | `POST /scanners/null/agents/_bulk/directive` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-agent-bulk-operations-group-directive` | `POST /scanners/null/agent-groups/{group_id}/agents/_bulk/directive` | blocked | - | Outside approved Tenable One v1 modules. |
| `bulk-unlink-agents` | `POST /scanners/null/agents/_bulk/unlink` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-connectors-create` | `POST /settings/connectors` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-connectors-list` | `GET /settings/connectors` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-connectors-details` | `GET /settings/connectors/{connector_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-connectors-update` | `PUT /settings/connectors/{connector_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-connectors-delete` | `DELETE /settings/connectors/{connector_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-connectors-get-arm-template` | `GET /settings/connectors/azure-fa/{connector_id}/arm-template` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-connectors-get-cft-template` | `POST /settings/connectors/cloudformation-template` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-connectors-get-aws-cloudtrails` | `POST /settings/connectors/aws/cloudtrails` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-connectors-import-assets` | `POST /settings/connectors/{connector_id}/import` | blocked | - | Outside approved Tenable One v1 modules. |
| `credentials-create` | `POST /credentials` | blocked | - | Credential/key administration outside approved business scope; never exposed. |
| `credentials-list` | `GET /credentials` | blocked | - | Credential/key administration outside approved business scope; never exposed. |
| `credentials-details` | `GET /credentials/{uuid}` | blocked | - | Credential/key administration outside approved business scope; never exposed. |
| `credentials-update` | `PUT /credentials/{uuid}` | blocked | - | Credential/key administration outside approved business scope; never exposed. |
| `credentials-delete` | `DELETE /credentials/{uuid}` | blocked | - | Credential/key administration outside approved business scope; never exposed. |
| `credentials-list-credential-types` | `GET /credentials/types` | blocked | - | Credential/key administration outside approved business scope; never exposed. |
| `credentials-file-upload` | `POST /credentials/files` | blocked | - | Credential/key administration outside approved business scope; never exposed. |
| `exclusions-create` | `POST /exclusions` | blocked | - | Outside approved Tenable One v1 modules. |
| `exclusions-list` | `GET /exclusions` | blocked | - | Outside approved Tenable One v1 modules. |
| `exclusions-import` | `POST /exclusions/import` | blocked | - | Outside approved Tenable One v1 modules. |
| `exclusions-details` | `GET /exclusions/{exclusion_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `exclusions-edit` | `PUT /exclusions/{exclusion_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `exclusions-delete` | `DELETE /exclusions/{exclusion_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `networks-create` | `POST /networks` | blocked | - | Outside approved Tenable One v1 modules. |
| `networks-list` | `GET /networks` | blocked | - | Outside approved Tenable One v1 modules. |
| `networks-details` | `GET /networks/{network_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `networks-update` | `PUT /networks/{network_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `networks-delete` | `DELETE /networks/{network_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-networks-asset-count-details` | `GET /networks/{network_id}/counts/assets-not-seen-in/{num_days}` | blocked | - | Outside approved Tenable One v1 modules. |
| `networks-assign-scanner` | `POST /networks/{network_id}/scanners/{scanner_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `networks-list-scanners` | `GET /networks/{network_id}/scanners` | blocked | - | Outside approved Tenable One v1 modules. |
| `networks-assign-scanner-bulk` | `POST /networks/{network_id}/scanners` | blocked | - | Outside approved Tenable One v1 modules. |
| `networks-list-assignable-scanners` | `GET /networks/{network_id}/assignable-scanners` | blocked | - | Outside approved Tenable One v1 modules. |
| `sensors-ot-create` | `POST /sensors` | blocked | - | Outside approved Tenable One v1 modules. |
| `sensors-ot-list` | `GET /sensors/{type}` | blocked | - | Outside approved Tenable One v1 modules. |
| `sensors-ot-details` | `GET /sensors/{type}/{id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `sensors-ot-update` | `PUT /sensors/{type}/{id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `sensors-ot-delete` | `DELETE /sensors/{type}/{id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `sensors-ot-linking-key-generate` | `POST /sensors/{type}/linking-key` | blocked | - | Credential/key administration outside approved business scope; never exposed. |
| `permissions-list` | `GET /permissions/{object_type}/{object_id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `permissions-change` | `PUT /permissions/{object_type}/{object_id}` | blocked | - | User, role, group or access-control management; never exposed. |
| `profiles-create` | `POST /sensors/profiles/{sensor_type}` | blocked | - | Outside approved Tenable One v1 modules. |
| `profiles-list` | `GET /sensors/profiles/{sensor_type}` | blocked | - | Outside approved Tenable One v1 modules. |
| `profiles-details` | `GET /sensors/profiles/{sensor_type}/{profile_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `profiles-update` | `PUT /sensors/profiles/{sensor_type}/{profile_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `profiles-delete` | `DELETE /sensors/profiles/{sensor_type}/{profile_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `profiles-clone` | `POST /sensors/profiles/{sensor_type}/{profile_uuid}/clone` | blocked | - | Outside approved Tenable One v1 modules. |
| `profiles-feed-versions` | `GET /sensors/profiles/feed_versions` | blocked | - | Outside approved Tenable One v1 modules. |
| `recast-rules-create` | `POST /v1/recast/rules` | blocked | - | Outside approved Tenable One v1 modules. |
| `recast-rules-search` | `POST /v1/recast/rules/search` | blocked | - | Outside approved Tenable One v1 modules. |
| `recast-rules-details` | `GET /v1/recast/rules/{rule_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `recast-rules-update` | `PUT /v1/recast/rules/{rule_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `recast-rules-delete` | `DELETE /v1/recast/rules/{rule_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `recast-rules-filters-list` | `GET /v1/recast/rules/filters` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanners-list` | `GET /scanners` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanners-details` | `GET /scanners/{scanner_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanners-edit` | `PUT /scanners/{scanner_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanners-delete` | `DELETE /scanners/{scanner_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanners-get-scanner-key` | `GET /scanners/{scanner_id}/key` | blocked | - | Credential/key administration outside approved business scope; never exposed. |
| `scanners-get-aws-targets` | `GET /scanners/{scanner_id}/aws-targets` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanners-get-scans` | `GET /scanners/{scanner_id}/scans` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-config-details` | `GET /scanners/config` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-config-edit` | `PUT /scanners/config` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-groups-create` | `POST /scanner-groups` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-groups-list` | `GET /scanner-groups` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-groups-details` | `GET /scanner-groups/{group_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-groups-edit` | `PUT /scanner-groups/{group_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-groups-delete` | `DELETE /scanner-groups/{group_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-groups-list-scanners` | `GET /scanner-groups/{group_id}/scanners` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-groups-add-scanner` | `POST /scanner-groups/{group_id}/scanners/{scanner_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-groups-delete-scanner` | `DELETE /scanner-groups/{group_id}/scanners/{scanner_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-scanner-groups-list-routes` | `GET /scanner-groups/{group_id}/routes` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-scanner-groups-update-routes` | `PUT /scanner-groups/{group_id}/routes` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-profile-assign-bulk` | `POST /scanners/scanners/bulkAssignToProfile` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-profile-remove-bulk` | `DELETE /scanners/scanners/bulkAssignToProfile` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanner-task-status` | `GET /scanners/request-status/{request_status_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-scanners-directive` | `POST /scanners/{scanner_uuid}/directives` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-scanners-directive-bulk` | `POST /scanners/bulk/directives` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanners-control-scans` | `POST /scanners/{scanner_id}/scans/{scan_uuid}/control` | blocked | - | Outside approved Tenable One v1 modules. |
| `scanners-toggle-link-state` | `PUT /scanners/{scanner_id}/link` | blocked | - | Outside approved Tenable One v1 modules. |
| `server-status` | `GET /server/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `server-properties` | `GET /server/properties` | blocked | - | Outside approved Tenable One v1 modules. |
| `tags-create-tag-category` | `POST /tags/categories` | v1-write | `tag category create` | Approved business mutation; security fields excluded; gated write. |
| `tags-list-tag-categories` | `GET /tags/categories` | v1-read | `tag category list` | Approved investigation or supporting read. |
| `tags-tag-category-details` | `GET /tags/categories/{tag_category_uuid}` | v1-read | `tag category show` | Approved investigation or supporting read. |
| `tags-edit-tag-category` | `PUT /tags/categories/{tag_category_uuid}` | v1-write | `tag category update` | Approved business mutation; security fields excluded; gated write. |
| `tags-delete-tag-category` | `DELETE /tags/categories/{tag_category_uuid}` | v1-write | `tag category delete` | Approved business mutation; security fields excluded; gated write. |
| `tags-create-tag-value` | `POST /tags/values` | v1-write | `tag value create` | Approved business mutation; security fields excluded; gated write. |
| `tags-list-tag-values` | `GET /tags/values` | v1-read | `tag value list` | Approved investigation or supporting read. |
| `tags-tag-value-details` | `GET /tags/values/{tag_value_uuid}` | v1-read | `tag value show` | Approved investigation or supporting read. |
| `tags-update-tag-value` | `PUT /tags/values/{tag_value_uuid}` | v1-write | `tag value update` | Approved business mutation; security fields excluded; gated write. |
| `tags-delete-tag-value` | `DELETE /tags/values/{tag_value_uuid}` | v1-write | `tag value delete` | Approved business mutation; security fields excluded; gated write. |
| `tags-delete-tag-values-bulk` | `POST /tags/values/delete-requests` | v1-write | `tag value bulk-delete` | Approved business mutation; security fields excluded; gated write. |
| `tags-assign-asset-tags` | `POST /tags/assets/assignments` | v1-write | `tag assignment add / tag assignment remove` | Approved business mutation; security fields excluded; gated write. |
| `tags-list-asset-tags` | `GET /tags/assets/{asset_uuid}/assignments` | v1-read | `tag assignment list` | Approved investigation or supporting read. |
| `tags-list-exclusions` | `GET /tags/values/{tag_value_uuid}/exclusions` | v1-read | `tag exclusion list` | Approved investigation or supporting read. |
| `tags-list-asset-filters` | `GET /tags/assets/filters` | v1-read | `tag asset-filter list` | Approved investigation or supporting read. |
| `target-groups-list` | `GET /target-groups` | blocked | - | Outside approved Tenable One v1 modules. |
| `target-groups-create` | `POST /target-groups` | blocked | - | Outside approved Tenable One v1 modules. |
| `target-groups-details` | `GET /target-groups/{group_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `target-groups-edit` | `PUT /target-groups/{group_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `target-groups-delete` | `DELETE /target-groups/{group_id}` | blocked | - | Outside approved Tenable One v1 modules. |

### vulnerability-management.json

| Operation ID | Method/path | Disposition | Planned command | Reason |
|---|---|---|---|---|
| `assets-list-assets` | `GET /assets` | blocked | - | Outside approved Tenable One v1 modules. |
| `assets-asset-info` | `GET /assets/{asset_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `assets-bulk-update-acr` | `POST /api/v2/assets/bulk-jobs/acr` | blocked | - | Outside approved Tenable One v1 modules. |
| `assets-bulk-move` | `POST /api/v2/assets/bulk-jobs/move-to-network` | blocked | - | Outside approved Tenable One v1 modules. |
| `assets-bulk-delete` | `POST /api/v2/assets/bulk-jobs/delete` | blocked | - | Outside approved Tenable One v1 modules. |
| `assets-import` | `POST /import/assets` | blocked | - | Outside approved Tenable One v1 modules. |
| `assets-list-import-jobs` | `GET /import/asset-jobs` | blocked | - | Outside approved Tenable One v1 modules. |
| `assets-import-job-info` | `GET /import/asset-jobs/{asset_import_job_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-v3-asset-attributes-create` | `POST /api/v3/assets/attributes` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-v3-asset-attributes-list` | `GET /api/v3/assets/attributes` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-v3-asset-attributes-update` | `PUT /api/v3/assets/attributes/{attribute_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-v3-asset-attributes-delete` | `DELETE /api/v3/assets/attributes/{attribute_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-v3-asset-attributes-assign` | `PUT /api/v3/assets/{asset_id}/attributes` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-v3-asset-attributes-assigned-list` | `GET /api/v3/assets/{asset_id}/attributes` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-v3-asset-attributes-assigned-delete` | `DELETE /api/v3/assets/{asset_id}/attributes` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-v3-asset-attributes-single-update` | `PUT /api/v3/assets/{asset_id}/attributes/{attribute_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-v3-asset-attributes-single-delete` | `DELETE /api/v3/assets/{asset_id}/attributes/{attribute_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `editor-details` | `GET /editor/{type}/{id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `editor-list-templates` | `GET /editor/{type}/templates` | blocked | - | Outside approved Tenable One v1 modules. |
| `editor-template-details` | `GET /editor/{type}/templates/{wizard_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `editor-plugin-description` | `GET /editor/policy/{policy_id}/families/{family_id}/plugins/{plugin_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `editor-audits` | `GET /editor/{type}/{object_id}/audits/{file_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `export-assets-v1` | `POST /assets/export` | blocked | - | Outside approved Tenable One v1 modules. |
| `export-assets-v2` | `POST /assets/v2/export` | blocked | - | Outside approved Tenable One v1 modules. |
| `exports-assets-export-status` | `GET /assets/export/{export_uuid}/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `exports-assets-export-status-recent` | `GET /assets/export/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `exports-assets-download-chunk` | `GET /assets/export/{export_uuid}/chunks/{chunk_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `exports-assets-export-cancel` | `POST /assets/export/{export_uuid}/cancel` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-exports-compliance-create` | `POST /compliance/export` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-exports-compliance-status` | `GET /compliance/export/{export_uuid}/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `exports-compliance-status-list` | `GET /compliance/export/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-exports-compliance-download` | `GET /compliance/export/{export_uuid}/chunks/{chunk_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-exports-compliance-cancel` | `POST /compliance/export/{export_uuid}/cancel` | blocked | - | Outside approved Tenable One v1 modules. |
| `exports-vulns-request-export` | `POST /vulns/export` | blocked | - | Outside approved Tenable One v1 modules. |
| `exports-vulns-export-status` | `GET /vulns/export/{export_uuid}/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `exports-vulns-export-status-recent` | `GET /vulns/export/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `exports-vulns-download-chunk` | `GET /vulns/export/{export_uuid}/chunks/{chunk_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `exports-vulns-export-cancel` | `POST /vulns/export/{export_uuid}/cancel` | blocked | - | Outside approved Tenable One v1 modules. |
| `combinations-create` | `POST /exposure-response/combinations` | v1-write | `combination create` | Approved business mutation; security fields excluded; gated write. |
| `combinations-list` | `GET /exposure-response/combinations` | v1-read | `combination list` | Approved investigation or supporting read. |
| `combinations-details` | `GET /exposure-response/combinations/{combination_id}` | v1-read | `combination show` | Approved investigation or supporting read. |
| `combinations-update` | `PUT /exposure-response/combinations/{combination_id}` | v1-write | `combination update` | Approved business mutation; security fields excluded; gated write. |
| `combinations-delete` | `DELETE /exposure-response/combinations/{combination_id}` | v1-write | `combination delete` | Approved business mutation; security fields excluded; gated write. |
| `combinations-timelines-list` | `GET /api/v3/combinations/timeline` | blocked | - | Outside approved Tenable One v1 modules. |
| `initiatives-create` | `POST /exposure-response/initiatives` | v1-write | `initiative create` | Approved business mutation; security fields excluded; gated write. |
| `initiatives-list` | `GET /exposure-response/initiatives` | v1-read | `initiative list` | Approved investigation or supporting read. |
| `initiatives-details` | `GET /exposure-response/initiatives/{initiative_id}` | v1-read | `initiative show` | Approved investigation or supporting read. |
| `initiatives-update` | `PUT /exposure-response/initiatives/{initiative_id}` | v1-write | `initiative update` | Approved business mutation; security fields excluded; gated write. |
| `initiatives-delete` | `DELETE /exposure-response/initiatives/{initiative_id}` | v1-write | `initiative delete` | Approved business mutation; security fields excluded; gated write. |
| `initiatives-filter-details` | `GET /api/v3/initiatives/{initiative_id}/filter` | blocked | - | Outside approved Tenable One v1 modules. |
| `initiatives-share` | `POST /api/v3/initiatives/{initiative_id}/share/{user_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `file-upload` | `POST /file/upload` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-filters-agents-list` | `GET /filters/scans/agents` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-filters-assets-list` | `GET /filters/workbenches/assets` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-filters-assets-list-v2` | `POST /filters/workbenches/assets` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-filters-credentials-list` | `GET /filters/credentials` | blocked | - | Outside approved Tenable One v1 modules. |
| `vm-filters-reports-list` | `GET /filters/reports/export` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-filters-scan-list` | `GET /filters/scans/reports` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-filters-scan-history-list` | `GET /filters/scans/reports/history` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-filters-vulnerabilities-workbench-list` | `GET /filters/workbenches/vulnerabilities` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-filters-vulnerabilities-workbench-list-v2` | `POST /filters/workbenches/vulnerabilities` | blocked | - | Outside approved Tenable One v1 modules. |
| `combinations-filters-list` | `GET /exposure-response/combinations/allowed/filters` | v1-read | `combination filters` | Approved investigation or supporting read. |
| `folders-create` | `POST /folders` | blocked | - | Outside approved Tenable One v1 modules. |
| `folders-list` | `GET /folders` | blocked | - | Outside approved Tenable One v1 modules. |
| `folders-edit` | `PUT /folders/{folder_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `folders-delete` | `DELETE /folders/{folder_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-plugins-list` | `GET /plugins/plugin` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-plugins-details` | `GET /plugins/plugin/{id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-plugins-families-list` | `GET /plugins/families` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-plugins-family-details-id` | `GET /plugins/families/{id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-plugins-family-details-name` | `POST /plugins/families/_byName` | blocked | - | Outside approved Tenable One v1 modules. |
| `policies-create` | `POST /policies` | blocked | - | Outside approved Tenable One v1 modules. |
| `policies-list` | `GET /policies` | blocked | - | Outside approved Tenable One v1 modules. |
| `policies-copy` | `POST /policies/{policy_id}/copy` | blocked | - | Outside approved Tenable One v1 modules. |
| `policies-import` | `POST /policies/import` | blocked | - | Outside approved Tenable One v1 modules. |
| `policies-export` | `GET /policies/{policy_id}/export` | blocked | - | Outside approved Tenable One v1 modules. |
| `policies-details` | `GET /policies/{policy_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `policies-configure` | `PUT /policies/{policy_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `policies-delete` | `DELETE /policies/{policy_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-remediation-goals-create` | `POST /remediation/goal` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-remediation-goals-delete` | `PATCH /remediation/goal` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-remediation-goals-search` | `POST /remediation/goal/search` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-remediation-goals-details` | `GET /remediation/goal/{goaluuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-remediation-goals-update` | `PUT /remediation/goal/{goaluuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-remediation-projects-create` | `POST /remediation` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-remediation-projects-delete` | `PATCH /remediation` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-remediation-projects-search` | `POST /remediation/search` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-remediation-projects-details` | `GET /remediation/{projectUuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-remediation-projects-update` | `PUT /remediation/{projectUuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-scans-remediation-create` | `POST /scans/remediation` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-scans-remediation-list` | `GET /scans/remediation` | blocked | - | Outside approved Tenable One v1 modules. |
| `vm-reports-create` | `POST /reports/export` | blocked | - | Outside approved Tenable One v1 modules. |
| `vm-reports-status` | `GET /reports/export/{report_uuid}/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `vm-reports-download` | `GET /reports/export/{report_uuid}/download` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-create` | `POST /scans` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-list` | `GET /scans` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-details` | `GET /scans/{scan_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-configure` | `PUT /scans/{scan_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-delete` | `DELETE /scans/{scan_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-list-by-agent-group` | `GET /scan-configs/references/by-agent-group/{agent_group_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-launch` | `POST /scans/{scan_id}/launch` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-pause` | `POST /scans/{scan_id}/pause` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-resume` | `POST /scans/{scan_id}/resume` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-stop` | `POST /scans/{scan_id}/stop` | blocked | - | Outside approved Tenable One v1 modules. |
| `vm-scans-stop-force` | `POST /scans/{schedule_uuid}/force-stop` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-export-request` | `POST /scans/{scan_id}/export` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-export-list` | `GET /scans/exports` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-export-status` | `GET /scans/{scan_id}/export/{file_id}/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-export-download` | `GET /scans/{scan_id}/export/{file_id}/download` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-history` | `GET /scans/{scan_id}/history` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-history-details` | `GET /scans/{scan_id}/history/{history_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-delete-history` | `DELETE /scans/{scan_id}/history/{history_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-host-details` | `GET /scans/{scan_uuid}/hosts/{host_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-plugin-output` | `GET /scans/{scan_uuid}/hosts/{host_id}/plugins/{plugin_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-attachments` | `GET /scans/{scan_id}/attachments/{attachment_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-get-latest-status` | `GET /scans/{scan_id}/latest-status` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-read-status` | `PUT /scans/{scan_id}/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-vm-scans-progress-get` | `GET /scans/{scan_id}/progress` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-schedule` | `PUT /scans/{scan_id}/schedule` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-copy` | `POST /scans/{scan_id}/copy` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-scans-credentials-convert` | `POST /scans/{scan_id}/credentials/{credentials_id}/upgrade` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-import` | `POST /scans/import` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-scans-count` | `GET /scans/count` | blocked | - | Outside approved Tenable One v1 modules. |
| `scans-timezones` | `GET /scans/timezones` | blocked | - | Outside approved Tenable One v1 modules. |
| `io-scans-check-auto-targets` | `POST /scans/check-auto-targets` | blocked | - | Outside approved Tenable One v1 modules. |
| `shared-collections-create` | `POST /shared-collections` | blocked | - | Outside approved Tenable One v1 modules. |
| `shared-collections-list` | `GET /shared-collections` | blocked | - | Outside approved Tenable One v1 modules. |
| `shared-collections-details` | `GET /shared-collections/{shared_collection_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `shared-collections-update` | `PUT /shared-collections/{shared_collection_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `shared-collections-delete` | `DELETE /shared-collections/{shared_collection_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `shared-collections-details-by-name` | `POST /shared-collections/_byName` | blocked | - | Outside approved Tenable One v1 modules. |
| `shared-collections-job-status` | `GET /shared-collections/request-status/{request_status_id}` | blocked | - | Outside approved Tenable One v1 modules. |
| `shared-collections-config-add` | `POST /shared-collections/{shared_collection_id}/scan-configs` | blocked | - | Outside approved Tenable One v1 modules. |
| `shared-collections-config-list` | `GET /shared-collections/{shared_collection_id}/scan-configs` | blocked | - | Outside approved Tenable One v1 modules. |
| `shared-collections-configs-remove` | `DELETE /shared-collections/{shared_collection_id}/scan-configs` | blocked | - | Outside approved Tenable One v1 modules. |
| `vulnerabilities-import` | `POST /import/vulnerabilities` | blocked | - | Outside approved Tenable One v1 modules. |
| `vulnerabilities-import-v2` | `POST /api/v2/vulnerabilities` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-vulnerabilities` | `GET /workbenches/vulnerabilities` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-vulnerability-info` | `GET /workbenches/vulnerabilities/{plugin_id}/info` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-vulnerability-output` | `GET /workbenches/vulnerabilities/{plugin_id}/outputs` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-assets` | `GET /workbenches/assets` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-assets-vulnerabilities` | `GET /workbenches/assets/vulnerabilities` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-asset-info` | `GET /workbenches/assets/{asset_id}/info` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-assets-activity` | `GET /workbenches/assets/{asset_uuid}/activity` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-asset-vulnerabilities` | `GET /workbenches/assets/{asset_id}/vulnerabilities` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-asset-vulnerability-info` | `GET /workbenches/assets/{asset_id}/vulnerabilities/{plugin_id}/info` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-asset-vulnerability-output` | `GET /workbenches/assets/{asset_id}/vulnerabilities/{plugin_id}/outputs` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-assets-delete` | `DELETE /workbenches/assets/{asset_uuid}` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-export-request` | `GET /workbenches/export` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-export-status` | `GET /workbenches/export/{file_id}/status` | blocked | - | Outside approved Tenable One v1 modules. |
| `workbenches-export-download` | `GET /workbenches/export/{file_id}/download` | blocked | - | Outside approved Tenable One v1 modules. |
