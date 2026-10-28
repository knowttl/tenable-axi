# Contributing agents

Use Node.js 22.12 or later and pnpm through Corepack.
The authoritative commands are in `package.json`: `corepack pnpm run build`, `corepack pnpm run lint`, `corepack pnpm test`, and `corepack pnpm run spec:check`.
`.no-mistakes.yaml` separates preparation, testing and linting; see [releases](CONTRIBUTING.md#releases) for hosted publication checks.
Do not add a hosted test workflow.

## Testing

Tests exercise real observable behaviour through the CLI entry point or the transport against the fake Tenable upstream and synthetic fixtures.
No tautological tests: never assert a stub or mock returns what it was given, re-test what TypeScript or zod already guarantee, snapshot implementation details, or test private helpers directly.
Each test names one behaviour and covers boundaries and failures.
Validation runs only affected tests plus the fixed baseline, per `.no-mistakes.yaml` and `scripts/test-changes.mjs`; shared infrastructure changes run the full suite.
See [Change recipe and tests](docs/design.md#change-recipe-and-tests) for the contract.

## Boundaries

Follow [the design](docs/design.md) for credentials, closed transport and write guards.
Inventory evidence never enables executable commands.
Keys use SecretRefs, the origin is exactly `https://cloud.tenable.com`, and writes require configured scope, preview, exact confirmation and a durable redacted journal.
Never use live tenants or credentials in automated tests.
Keep this public repository free of credentials, customer data, private paths and internal infrastructure details; use synthetic fixtures.
