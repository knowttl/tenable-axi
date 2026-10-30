# Contributing

Keep changes focused and describe the problem, resulting behavior, scope, and verification in the pull request.
Follow [the design](docs/design.md); capability evidence does not enable an executable command.
See [README](README.md) for the introduction and [behavior](docs/behavior.md) for the operator contract.

## TypeScript conventions

Use the runtime required by [package.json](package.json), TypeScript with strict checking, ESM, and pnpm with the committed lockfile.
Use `axi-sdk-js` for the CLI boundary and `@toon-format/toon` for stdout encoding.
Keep JSON internally and decode untrusted responses with zod at the boundary.
Validate selected response fields according to the [output contract](docs/design.md#architecture-and-module-depth), tolerate extra upstream fields, and keep command input schemas strict.
Use precise names, caller-shaped domain functions, and one authoritative command catalogue.
Prefer functions that hide a complete responsibility over wrappers that merely forward calls.
Do not add arbitrary HTTP execution or bypasses for credentials, origins, or write policy.
Match existing style and avoid adjacent refactors.
Do not edit generated files or changelogs by hand.

## Verification

Automated tests must work offline with synthetic credentials and our own fixtures and fakes.
Deny external network access and isolate HOME, XDG directories, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, and filesystem state.
Use the fake transport for domain tests and the fake HTTPS Tenable for critical packaged-CLI journeys.
Follow the canonical test-quality rules in [AGENTS.md](AGENTS.md#testing).
Never require a live tenant, customer data, or a real credential for a test.
T1 configures `.no-mistakes.yaml` following vectra-axi's separated prepare/test/lint command pattern.
Run only tests affected by the change plus a small fixed baseline.
`corepack pnpm test` always builds and typechecks, then `scripts/test-changes.mjs` selects tests related to files changed since the merge base with `origin/main`, including tracked working-tree changes and untracked files.
The fixed baseline always includes `test/packaged-cli.test.ts`; `scripts/test-changes.mjs` defines any additional safety baselines.
Package, lockfile, TypeScript/Vitest configuration, test support, scripts, pinned specifications and `.no-mistakes.yaml` changes run the full suite.
The selector prints its mode and fails if it cannot compute the merge base or find the required CLI baseline.
No hosted pull-request test CI is configured; `.no-mistakes.yaml` declares `no_ci: true`.
Hosted publication checks are described under [releases](#releases).
Run the [development commands](#development-and-testing) before review.
After catalogue changes, follow the [documentation generation commands](#development-and-testing).
Repeat changed async, clock, and I/O tests to detect leaks and order dependence.
Live acceptance is a separate, explicitly authorized manual activity described in T13.

`inventory/specs.json` pins the unmodified bytes under `specs/`.
`docs/design.md` owns the reviewed operation dispositions and planned commands.
After an explicit specification review, run `corepack pnpm run build` and `corepack pnpm run spec:generate` to regenerate the inventory and declarations, then run `spec:check` offline.
Never edit `src/generated/` or `inventory/capabilities.json` by hand.

`src/response-diagnostics.ts` and `test/fixtures/response-diagnostics-vectors.json` are byte copies from [beyondtrust-axi](https://github.com/knowttl/beyondtrust-axi/tree/8a8626a9e1b15d2e23ef484a69176f216d757e7c), guarded by `test/response-diagnostics-contract.test.ts` against `test/fixtures/response-diagnostics-sha256.json`.
Update the canonical helper there and copy it with the vectors and hash manifest here.

## Public repository hygiene

Never commit credentials, authentication headers, tenant responses, customer identifiers, private paths, or internal infrastructure details.
Use public source links and synthetic examples.
Review staged changes for secrets and unintended files before committing.
Keep each full Markdown sentence on its own line.
Use a plain dash instead of an em dash.
Do not add agent co-author trailers automatically.

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

See [verification](#verification) for offline isolation and test selection.
The [capability map](docs/design.md#capability-map) defines planned v1 scope; the generated [inventory](inventory/capabilities.json) records every pinned operation's classification and does not enable execution.
After catalogue changes, rebuild and run `corepack pnpm run docs:generate` to regenerate the command reference and skill.
Tests and manual CLI checks use temporary HOME/XDG directories and synthetic fixtures, with no live tenant or real credentials.
Pull requests are validated locally; hosted checks run only during [release publication](#releases).


## Releases

Release-please owns versions, tags, release notes and changelog updates.
The release workflow publishes only when release-please creates a release, after build, lint, offline fake tarball tests, spec and documentation checks.
It publishes the verified tarball with npm provenance through OIDC trusted publishing, with no stored npm token.
Trusted publishing uses `knowttl/tenable-axi` and `.github/workflows/release-please.yml`.
Live acceptance is separate from offline verification and requires explicit authorization.
