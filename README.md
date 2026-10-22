# tenable-axi

An AXI command-line tool for Tenable One, under construction.
The scaffold uses TypeScript on Node.js 22 and will be published as `@knowttl/tenable-axi`.
Local home, help and version commands work offline; no Tenable endpoint commands are implemented yet and no npm release is available.

See the [design](docs/design.md) for v1 scope, credentials, write policy, verification, and implementation slices.
See [contributing](CONTRIBUTING.md) for development conventions.

```sh
corepack pnpm install --frozen-lockfile --ignore-scripts --config.confirm-modules-purge=false
corepack pnpm run build
node bin/tenable-axi.js --help
node bin/tenable-axi.js --version
corepack pnpm test
corepack pnpm run lint
corepack pnpm run spec:check
```

Tests run offline in an isolated HOME and XDG environment.
`pnpm test` always builds and typechecks, then runs affected tests plus the packaged CLI baseline; shared validation inputs trigger the full suite.
See `.no-mistakes.yaml` and `scripts/test-changes.mjs` for the authoritative validation setup.
There is no hosted test CI.
The pinned inventory classifies all 360 upstream operations as 31 approved reads, 19 approved writes and 310 blocked operations; approval describes planned v1 scope and does not enable execution.

Licensed under the [MIT License](LICENSE).
