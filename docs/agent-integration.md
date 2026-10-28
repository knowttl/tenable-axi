# Agent integration

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

See the [generated skill](../skills/tenable-axi/SKILL.md) for the complete command index.
