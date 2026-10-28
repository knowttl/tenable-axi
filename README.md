# tenable-axi

Investigate Tenable One exposure and run explicitly guarded writes

[![npm version](https://img.shields.io/npm/v/@knowttl/tenable-axi)](https://www.npmjs.com/package/@knowttl/tenable-axi) [![License](https://img.shields.io/github/license/knowttl/tenable-axi)](LICENSE) [![Node.js](https://img.shields.io/node/v/@knowttl/tenable-axi)](https://nodejs.org/) [![npm provenance](https://img.shields.io/badge/npm-provenance-blue)](https://www.npmjs.com/package/@knowttl/tenable-axi#provenance) [![AXI](https://img.shields.io/badge/AXI-agent%20experience-blue)](https://github.com/knowttl/axi)

[Why](#why-this-exists) · [Quickstart](#quickstart) · [Agents](#use-with-your-agent) · [Coverage](#what-it-covers) · [Safety](#safety) · [Configuration](#configuration) · [Output](#output-and-exit-codes) · [Troubleshooting](#troubleshooting) · [Contributing](#contributing) · [Security](#security) · [License](#license)

## Why this exists

Tenable One spans inventory, attack paths and business workflows with different routes and permissions.
Agents and the humans running them need bounded evidence instead of large responses and guessed API calls.
tenable-axi exposes reviewed commands, validates responses and returns compact TOON with next-step hints.
Reads stay bounded, and writes require explicit scope, a preview and exact confirmation.

## Quickstart

Requires Node.js 22.12 or later.
Install globally, or run `npx -y @knowttl/tenable-axi` without installing:

```sh
npm install --global @knowttl/tenable-axi
tenable-axi
```

An unconfigured home stays offline and prints this excerpt:

```text
status: not configured
```

Supply `TENABLE_AXI_ACCESS_KEY` and `TENABLE_AXI_SECRET_KEY` through your secret manager.
Then check local credentials and read up to ten assets:

```sh
tenable-axi auth status
tenable-axi asset list --limit 10
```

For named profiles or file SecretRefs, run `tenable-axi config path` and follow [configuration](https://github.com/knowttl/tenable-axi/blob/main/docs/configuration.md).
Only `https://cloud.tenable.com` is supported; licensing and upstream permissions still apply.

## Use with your agent

```sh
tenable-axi setup hooks
npx skills add knowttl/tenable-axi --skill tenable-axi
```

Hooks inject local profile, origin and write posture at session start; the skill supplies command discovery on demand.
Both are optional, grant no permissions and work independently.
Restart the agent session after installing hooks.
The [compact agent guide](https://github.com/knowttl/tenable-axi/blob/main/skills/tenable-axi/SKILL.md) supplies investigation examples, output bounds, read allowlists and failure notes so agents can start without running help.
To remove hooks, delete only `tenable-axi-hook` entries in Claude's `settings.json` and Codex's `hooks.json`, plus OpenCode's `plugins/axi-tenable-axi-hook.js`.
See [agent integration](https://github.com/knowttl/tenable-axi/blob/main/docs/agent-integration.md) for active directories, project scope and removal.

## What it covers

Start investigations from the [agent guide](https://github.com/knowttl/tenable-axi/blob/main/skills/tenable-axi/SKILL.md); use a leaf command's `--help` to recover from a failed or unfamiliar command.
The [generated command reference](https://github.com/knowttl/tenable-axi/blob/main/docs/commands.md) lists every leaf, flag and example.

| Group | Purpose | Access | Reference |
| --- | --- | --- | --- |
| `home`, `card` | Profile posture and exposure cards | Read | [Cards](https://github.com/knowttl/tenable-axi/blob/main/docs/commands.md#card-list) |
| `asset` | Search inventory and inspect assets | Read | [Assets](https://github.com/knowttl/tenable-axi/blob/main/docs/commands.md#asset-list) |
| `finding` | Search findings and count severity/sensor totals | Read | [Findings](https://github.com/knowttl/tenable-axi/blob/main/docs/commands.md#finding-list) |
| `software` | Search software and available properties | Read | [Software](https://github.com/knowttl/tenable-axi/blob/main/docs/commands.md#software-list) |
| `attack-path`, `attack-technique` | Investigate attack evidence | Read | [Attack paths](https://github.com/knowttl/tenable-axi/blob/main/docs/commands.md#attack-path-list) |
| `connector logs` | Inspect connector sync failures | Read | [Logs](https://github.com/knowttl/tenable-axi/blob/main/docs/commands.md#connector-logs) |
| `tag list/properties` | Search Exposure Management tags | Read | [Tag search](https://github.com/knowttl/tenable-axi/blob/main/docs/commands.md#tag-list) |
| `tag category/value/assignment/exclusion/asset-filter` | Inspect and manage platform tags | Read/write | [Platform tags](https://github.com/knowttl/tenable-axi/blob/main/docs/behavior.md#platform-tags) |
| `initiative`, `combination` | Manage Exposure Response workflows | Read/write | [Exposure Response](https://github.com/knowttl/tenable-axi/blob/main/docs/behavior.md#exposure-response) |
| `export` | Create jobs, check status and download results | Read/write | [Exports](https://github.com/knowttl/tenable-axi/blob/main/docs/behavior.md#inventory-exports) |
| `auth`, `profile`, `config`, `doctor` | Inspect setup and module access | Local/read | [Doctor](https://github.com/knowttl/tenable-axi/blob/main/docs/commands.md#doctor) |
| `setup hooks`, `hook` | Install integrations and read local context | Local | [Integration](https://github.com/knowttl/tenable-axi/blob/main/docs/agent-integration.md) |

## Safety

Writes are read-only by default.
A file profile must enable `writes.allowWrites` and allow each exact operation ID in `writes.operations`, including for previews.
Preview first, then pass `--execute --confirm '<exact preview confirmation>'` to send once.
`TENABLE_AXI_READ_ONLY=true` forces read-only even when the profile allows writes.
There is no `TENABLE_AXI_ALLOW_*` environment gate; configured operation allowlists control scope.
A durable redacted journal records intent before sending; reconcile unknown outcomes before retrying.
Credentials use environment/file SecretRefs, never inline secrets or arguments.
Credential minting, users, roles, access-control administration and arbitrary HTTP stay blocked.
See [write safety](https://github.com/knowttl/tenable-axi/blob/main/docs/safety.md) and the [permission ledger](https://github.com/knowttl/tenable-axi/blob/main/docs/design.md#complete-operation-ledger).

## Configuration

| Setting | Purpose | Default |
| --- | --- | --- |
| Linux/macOS config | Profile JSON | `~/.config/tenable-axi/config.json` |
| Windows config | Profile JSON | `%APPDATA%\tenable-axi\config.json` |
| Linux/macOS state | Private journal directory | `~/.local/state/tenable-axi` |
| Windows state | Private journal directory | `%LOCALAPPDATA%\tenable-axi` |
| `TENABLE_AXI_CONFIG` | Config file, overridden by `--config` | Platform config path |
| `TENABLE_AXI_PROFILE` | Named profile, overridden by `--profile` | Environment profile, configured default, or sole profile |
| `TENABLE_AXI_ACCESS_KEY`, `TENABLE_AXI_SECRET_KEY` | Complete environment credential pair | Unset |
| `TENABLE_AXI_ORIGIN` | Environment profile origin; only the exact commercial origin is valid | `https://cloud.tenable.com` |
| `TENABLE_AXI_READ_ONLY` | Force read-only with `1` or `true` | Unset; profile policy applies |
| `TENABLE_AXI_WRITE_LOG` | Private journal path | State directory's `writes.log` |
| `XDG_CONFIG_HOME`, `XDG_STATE_HOME` | Absolute Unix config/state bases | `~/.config`, `~/.local/state` |
| `APPDATA`, `LOCALAPPDATA` | Absolute Windows config/state bases | `~/AppData/Roaming`, `~/AppData/Local` |
| `CLAUDE_CONFIG_DIR`, `CODEX_HOME` | Hook configuration directories | `~/.claude`, `~/.codex` |
| `PATH` / `Path`, `PATHEXT` | Hook executable lookup and Windows extensions | Empty path; `.COM;.EXE;.BAT;.CMD` |

User OpenCode setup uses `XDG_CONFIG_HOME` or `~/.config`.
SecretRefs may name additional environment variables explicitly.
See [configuration](https://github.com/knowttl/tenable-axi/blob/main/docs/configuration.md) for precedence, file security and a minimal profile.

## Output and exit codes

Stdout uses compact TOON; bare `--version`, `-v` and `-V` print the package version.
`--fields` selects properties and `--full` removes text truncation without expanding row or transport bounds.
Ordinary lists default to 100 rows; `--all` remains bounded at 10,000.
Resume a returned `--cursor` with the same profile, filters, fields and sort.
Inspect `complete` and `reason` before treating a result as exhaustive.
See [behavior](https://github.com/knowttl/tenable-axi/blob/main/docs/behavior.md) for collection-specific limits and downloads.

| Code | Meaning |
| --- | --- |
| 0 | Success, including previews and verified no-ops |
| 1 | Configuration, authentication, permission, transport or operation failure |
| 2 | CLI usage validation error |

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| `PERMISSION_DENIED` / HTTP 403 | Check licensing and the operation's privilege; run `doctor` for module-level advice. |
| `CONFIG_INVALID` with environment credentials | Set both keys and use only the supported origin; partial environment profiles fail closed. |
| `CONFIG_INSECURE` | Use an owned regular file with mode 600 on Unix or a protected Windows DACL. |
| Writes refused | Check the file profile's operation allowlist and forced read-only setting. |
| Cursor rejected after collection changes | Restart without the cursor and retain the original selectors. |

## Contributing

See [CONTRIBUTING.md](https://github.com/knowttl/tenable-axi/blob/main/CONTRIBUTING.md) for offline verification, documentation generation and releases, and [AGENTS.md](https://github.com/knowttl/tenable-axi/blob/main/AGENTS.md) for agent contribution rules.

## Security

Report vulnerabilities using [SECURITY.md](https://github.com/knowttl/tenable-axi/blob/main/SECURITY.md).

## License

[MIT](LICENSE).
