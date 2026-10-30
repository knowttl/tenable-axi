# Contributing agents

Use Node.js 22.12 or later and pnpm through Corepack.
The authoritative commands are in `package.json`: `corepack pnpm run build`, `corepack pnpm run lint`, `corepack pnpm test`, and `corepack pnpm run spec:check`.
`.no-mistakes.yaml` separates preparation, testing and linting; see [releases](CONTRIBUTING.md#releases) for hosted publication checks.
Do not add a hosted test workflow.

## Testing

Tests exercise real observable behaviour through the CLI entry point or the transport against the fake Tenable upstream and synthetic fixtures.
Each test names one behaviour and covers boundaries and failures.

Canonical source: knowttl/bstack revision feeccb1e6f1ae119bf4c74277c8bad328b05afe8, skills/verification/references/testing.md.
<!-- BEGIN canonical test-quality rules -->
**Test quality.** Write and review every test against these rules.
Tests are never required first; a change is verified end to end against the behaviour the user expects.

1. Trust upstream invariants: do not test states that types, schemas or database constraints already rule out.
   Test invalid input only at the boundary that validates it.
2. Assert outcomes from an agreed source (spec, domain rule, ground-truth fixture), never values copied from what the code returns today.
3. Mock only true external boundaries, with schema-valid or recorded payloads.
   Never mock in-process code.
   Delete tests that only check how a mock was set up or called, unless that call is the requirement.
4. Test through the public interface: no private helpers, internal state or internal call counts.
5. Every assertion must be able to fail when the behaviour breaks: no existence-, type- or constant-only assertions.

Exempt: validation-boundary tests, contract tests against an agreed schema or recording, and regression tests that cite the bug they reproduce.
<!-- END canonical test-quality rules -->

Validation runs only affected tests plus the fixed baseline, per `.no-mistakes.yaml` and `scripts/test-changes.mjs`; shared infrastructure changes run the full suite.
See [Change recipe and tests](docs/design.md#change-recipe-and-tests) for the contract.

## Boundaries

Follow [the design](docs/design.md) for credentials, closed transport and write guards.
Inventory evidence never enables executable commands.
Keys use SecretRefs, the origin is exactly `https://cloud.tenable.com`, and writes require configured scope, preview, exact confirmation and a durable redacted journal.
Never use live tenants or credentials in automated tests.
Keep this public repository free of credentials, customer data, private paths and internal infrastructure details; use synthetic fixtures.
