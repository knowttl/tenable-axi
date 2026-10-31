# Catalog verification for issue 34

The tested artifact is `@knowttl/tenable-axi` 0.1.5, packed from this change's source rather than downloaded from the registry.
The reproduction baseline is source revision `8d035bfca2237dee46a89bc042b42d15c43d06a0`.
Record the final implementation revision with `git rev-parse HEAD` alongside validation output when commissioning a particular install.
No release was cut for this verification.

## Offline verification

Run `corepack pnpm test`, `corepack pnpm run lint`, `corepack pnpm run spec:check` and `corepack pnpm run docs:check`.
The test command builds first and selects affected tests plus the packaged CLI, write-safety and redaction baseline.
`test/packaged-cli.test.ts` packs the artifact and its pinned dependencies, installs them with `npm install --offline --ignore-scripts`, and invokes the installed executable in isolated configuration.
The pre-fix packaged reproduction failed because home lacked `bin` and root, card, tag, auth and setup errors omitted the rejected flag.

The regression checks cover unconfigured identity, installation relocation, spaces and shell metacharacters in paths, home-prefix boundaries, and representative command help and unknown flags.
Configured, empty and failed-authentication home checks run installed modules against the CA-verified fake HTTPS Tenable with synthetic credentials.
The installed transport retains its own error classes at that boundary.
Configured card checks verify projected scores, upstream totals, the five-card window, continuation hints and cursor recovery, and text truncation with `--full` recovery.
The exposure suite also verifies denied reads, malformed responses and later-page failures retaining valid rows with a failing exit status.
These failures must never be recorded as empty successful collections.

The packaged integration tests verify explicit opt-in setup, executable session hooks, repeated setup and relocation repair.
Ordinary commands and help create no integrations.
The skill installer was exercised offline using cached `skills@1.7.4`, the local repository source, `--skill tenable-axi --agent codex --global --copy` and an isolated home.
It discovered and installed the advertised skill successfully.
The advertised remote `npx skills add knowttl/tenable-axi --skill tenable-axi` fetch remains pending because verification is offline.

## Read-only commissioning procedure - pending

This procedure has not been run against a real tenant.
Run it only in a separately authorized commissioning session with an existing read-only profile and appropriate Tenable entitlement.
Keep credentials and tenant output out of the public repository and review record.

1. Record the installed package version, source revision and absolute executable location.
   Invoke all three version flags and representative leaf `--help` commands.
2. Run home with isolated, unconfigured settings.
   Verify `bin` and the description precede setup guidance, and no network call occurs.
3. Select the authorized read-only profile and run home.
   Verify the executable identity, at most five cards, scores, upstream total when supplied, `complete` and continuation hints against the tenant UI for the same scope.
4. Follow `card show --id <id>` for a returned card and the exact continuation hint for remaining cards.
   Confirm no duplicated or missing cards and compare the total with the same tenant view.
   Where text is truncated, repeat the same read with `--full` and confirm that row bounds remain unchanged.
5. Check a known empty read scope and confirm an explicit successful empty result.
   Using a separately authorized denied or expired profile, confirm structured authentication or permission failure, executable identity on home, exit 1 and no invented zero count.
   If a later page fails, retain partial rows and confirm `complete: false`, an error and exit 1.
6. Run `--axi-review-unknown` at root and after `card list`, `tag list`, `asset list` and `auth status`.
   Confirm each names the rejected flag, lists only the applicable valid flags, exits 2 and performs no authentication or service call.
7. In a disposable agent configuration, exercise the advertised remote skill installation and explicit `setup hooks` route.
   Confirm the skill is discoverable and a fresh session executes only the local hook context read.
   Remove the disposable configuration afterward.

Live reads, entitlement checks, real session-host loading and remote skill fetching remain pending catalog exceptions until independently recorded.
