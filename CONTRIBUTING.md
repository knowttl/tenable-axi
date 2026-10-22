# Contributing

Keep changes focused and describe the problem, resulting behavior, scope, and verification in the pull request.
Follow [the design](docs/design.md); capability evidence does not enable an executable command.
This initial slice contains documentation and repository metadata only.

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
Never require a live tenant, customer data, or a real credential for a test.
Once implemented, run build, lint, tests, spec drift checks, and generated documentation and skill checks before review.
Repeat changed async, clock, and I/O tests to detect leaks and order dependence.
Live acceptance is a separate, explicitly authorized manual activity described in T13.

## Public repository hygiene

Never commit credentials, authentication headers, tenant responses, customer identifiers, private paths, or internal infrastructure details.
Use public source links and synthetic examples.
Review staged changes for secrets and unintended files before committing.
Keep each full Markdown sentence on its own line.
Use a plain dash instead of an em dash.
Do not add agent co-author trailers automatically.
