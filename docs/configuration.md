# Configuration

Run `tenable-axi config path` to locate configuration and state.
Linux/macOS uses absolute XDG bases or `~/.config/tenable-axi/config.json` and `~/.local/state/tenable-axi`.
Windows uses absolute `APPDATA` and `LOCALAPPDATA`, falling back to `AppData/Roaming` and `AppData/Local` under the home directory, with a `tenable-axi` subdirectory.

## Named profiles

Save this synthetic profile at the reported config path and supply the referenced environment variables through your secret manager:

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

```sh
tenable-axi auth status --profile example
tenable-axi doctor --profile example
tenable-axi asset list --profile example --limit 10
```

`auth status` checks locally without printing key values; `doctor` performs bounded module reads.
A configured home reads up to five live exposure cards.
No repository-local credential configuration is discovered automatically.

## Selection and environment

`--config` overrides `TENABLE_AXI_CONFIG`.
Profile selection is `--profile`, then `TENABLE_AXI_PROFILE`, then a complete environment profile, then `defaultProfile`, then a sole configured profile.
Explicitly selected file profiles ignore environment profile fields.
Environment profiles require both `TENABLE_AXI_ACCESS_KEY` and `TENABLE_AXI_SECRET_KEY`.
If supplied, `TENABLE_AXI_ORIGIN` must equal `https://cloud.tenable.com` exactly.
Any of these three environment profile fields triggers validation when no named profile is selected; partial profiles fail instead of mixing credentials.
Environment profiles cannot enable writes.

The [README environment table](../README.md#configuration) lists all tool-read environment settings, including hook installation variables.
`TENABLE_AXI_READ_ONLY` accepts case-insensitive `1`/`true` to force read-only, or `0`/`false`/unset to retain configured policy.
Other values fail closed.
`TENABLE_AXI_WRITE_LOG` selects a private journal instead of the default state-directory `writes.log`.

## File security

Config files must be owned regular files without group/other write access; use `chmod 600 <config-path>` on Unix.
SecretRefs also accept `{"file":"/absolute/path"}` to a protected secret file with no group/other permission bits.
Windows uses protected DACLs; secret file references refuse UNC and device paths.
No secrets belong in arguments, chat or configuration JSON.
Only the exact commercial origin is supported; there is no login, credential minting, arbitrary HTTP or TLS bypass.
See [safety](safety.md) before configuring writes.
