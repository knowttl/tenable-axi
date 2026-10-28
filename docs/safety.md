# Safety and permissions

tenable-axi is read-only by default.
Environment profiles cannot enable writes.
Only the exact origin `https://cloud.tenable.com` is supported.

## Write gates

Writes require a file profile with `writes.allowWrites: true` and exact operation IDs in `writes.operations`, including for previews.
There is no environment allowlist gate.
For example, allow only `inventory-export-assets` to preview or create asset exports.
Run a write without `--execute` to inspect its redacted preview.
After reviewing the target and effect, repeat with `--execute --confirm '<exact preview confirmation>'`.
`--dry-run` is explicit preview and excludes `--execute`.
`TENABLE_AXI_READ_ONLY=1` or `true` blocks every mutation regardless of configured policy.
The durable private journal records redacted intent before a single send.
Unknown outcomes include audit IDs and read-back guidance; reconcile them before retrying.
Writes never replay automatically.
State re-reads narrow races but do not provide atomic comparison where the API has no conditional writes.

| Family | Exact configured operation IDs | Details |
| --- | --- | --- |
| Inventory exports | `inventory-export-assets`, `inventory-export-findings` | [Inventory exports](behavior.md#inventory-exports) |
| Attack exports | `apa-export-attack-path`, `apa-export-attack-technique`, `apa-export-mitre-heatmap` | [Attack exports](behavior.md#attack-exports) |
| Exposure Response | `initiatives-create/update/delete`, `combinations-create/update/delete` (one exact ID per verb) | [Exposure Response](behavior.md#exposure-response) |
| Platform tags | Exact operation ID from the ledger for each category, value or assignment mutation | [Platform tags](behavior.md#platform-tags) |

## Upstream permissions

CLI configuration never grants Tenable permissions or entitlements.
HTTP 403 returns `PERMISSION_DENIED` with “Not licensed or not permitted for this key” and documented privilege advice.
Inventory needs `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ`.
Inventory exports need `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.EXPORT`.
Attack exports need `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE`.
Connector logs have elevated permissions; their denial does not imply ordinary inventory users need Administrator.
See the [complete permission ledger](design.md#complete-operation-ledger) and [command reference](commands.md).

## Credential boundaries

Credentials use environment/file SecretRefs and private file checks; see [configuration](configuration.md).
Credential minting, users, roles and access-control administration stay blocked, including nested security fields in allowed payloads.
No arbitrary HTTP execution, alternate origin or TLS bypass is exposed.
Downloads validate, redact and atomically publish to a new output path without overwrite.
See [behavior](behavior.md) for operation-specific payload, continuation and download limits.
