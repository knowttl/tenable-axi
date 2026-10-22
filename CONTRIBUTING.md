# Contributing

Keep changes focused and describe the problem, resulting behavior, scope, and verification in the pull request.
Follow [the design](docs/design.md); capability evidence does not enable an executable command.
The T1 scaffold ships local home/help/version commands and pinned API evidence; endpoint commands remain planned.

## TypeScript conventions

Use Node.js 22, TypeScript with strict checking, ESM, and pnpm with a committed lockfile once the scaffold lands.
Use `axi-sdk-js` for the CLI boundary and `@toon-format/toon` for stdout encoding.
Keep JSON internally and decode untrusted responses with zod at the boundary.
Require rendered fields, tolerate extra upstream fields, and keep command input schemas strict.
Use precise names, caller-shaped domain functions, and one authoritative command catalogue.
Prefer functions that hide a complete responsibility over wrappers that merely forward calls.
Do not add arbitrary HTTP execution or bypasses for credentials, origins, or write policy.
Match existing style and avoid adjacent refactors.
Do not edit generated files or changelogs by hand.

## Verification

Automated tests must work offline with synthetic credentials and our own fixtures and fakes.
Deny external network access and isolate HOME, XDG directories, and filesystem state.
Use the fake transport for domain tests and the fake HTTPS Tenable for critical packaged-CLI journeys.
Mock only real boundaries such as HTTP, clock, randomness, and platform ACL operations.
Prove practical observable behavior through the CLI and transport against the fake Tenable upstream.
Do not add tautological mock-echo checks, checks already covered by the compiler, or implementation snapshots.
Never require a live tenant, customer data, or a real credential for a test.
T1 configures `.no-mistakes.yaml` following vectra-axi's separated prepare/test/lint command pattern.
Run only tests affected by the change plus a small fixed baseline.
`corepack pnpm test` always builds and typechecks, then `scripts/test-changes.mjs` selects tests changed since the merge base with `origin/main`, including working-tree changes.
The fixed baseline is `test/packaged-cli.test.ts`, plus `test/write-safety.test.ts` and `test/redaction.test.ts` once present.
Package, lockfile, TypeScript/Vitest configuration, test support, scripts, pinned specifications and `.no-mistakes.yaml` changes run the full suite.
The selector prints its mode and fails if it cannot compute the merge base or find the required CLI baseline.
No hosted test CI is configured; `.no-mistakes.yaml` declares `no_ci: true`.
Once implemented, run build, lint, tests, spec drift checks, and generated documentation and skill checks before review.
Repeat changed async, clock, and I/O tests to detect leaks and order dependence.
Live acceptance is a separate, explicitly authorized manual activity described in T13.

```sh
corepack pnpm install --frozen-lockfile --ignore-scripts --config.confirm-modules-purge=false
corepack pnpm run build
corepack pnpm run lint
corepack pnpm test
corepack pnpm run spec:check
```

`inventory/specs.json` pins the unmodified bytes under `specs/`.
`docs/design.md` owns the reviewed operation dispositions and planned commands.
After an explicit specification review, run `corepack pnpm run build` and `corepack pnpm run spec:generate` to regenerate the inventory and declarations, then run `spec:check` offline.
Never edit `src/generated/` or `inventory/capabilities.json` by hand.

## Public repository hygiene

Never commit credentials, authentication headers, tenant responses, customer identifiers, private paths, or internal infrastructure details.
Use public source links and synthetic examples.
Review staged changes for secrets and unintended files before committing.
Keep each full Markdown sentence on its own line.
Use a plain dash instead of an em dash.
Do not add agent co-author trailers automatically.
