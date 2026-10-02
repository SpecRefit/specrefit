# SpecRefit

SpecRefit is a local-first workspace for inspecting and, in future, adapting OpenAPI contracts through reproducible rules. One shared processing implementation serves the browser and Electron viewer. Transformation, CLI and build integrations remain planned.

**Status: read-only viewer preview, not a product release.** Open YAML/JSON contracts, browse operations by tag, search/filter, inspect parameters, request bodies, responses and security, follow schemas and recursive references, and supply missing reference files. Representative OpenAPI 3.0.4, 3.1.2 and 3.2.0 fixtures are tested; this is not a complete OpenAPI/JSON Schema validator. Read the [support boundaries and evidence](docs/architecture/viewer.md) before relying on partial inspection. Editing, transformations, comparison, export, a product CLI and native installers are not implemented.

## Start here

- [AGENTS.md](AGENTS.md): instructions for contributors and coding agents, including testing and safety requirements.
- [Product requirements](docs/requirements/product.md): the agreed product behavior and scope.
- [Architecture](docs/architecture/overview.md): module boundaries, proposed technology and unresolved decisions.
- [Configuration and execution](docs/architecture/configuration-and-execution.md): rules, references, deterministic output and contract comparisons.
- [ROADMAP.md](ROADMAP.md): sequencing, acceptance criteria and current next steps.
- [Decisions](docs/architecture/decisions.md): accepted choices, provisional proposals and questions still requiring a decision.
- [Project handoff](docs/project-handoff.md): repository locations, branding, hosting and how to resume development.

Read these documents before implementing features. They are intended to make a fresh clone sufficient to resume development without access to the original design conversation.

## Intended workflow

1. Supply an OpenAPI contract and its referenced documents.
2. Inspect operations, inputs, outputs, schemas and diagnostics.
3. Configure transformations and exceptions; inspect an explanatory change report and file diffs.
4. Save the configuration as YAML or JSON under a name of your choice.
5. Write the adapted contract to separate output files, or bundle it into one specification.
6. Reapply the same configuration through the editor, CLI or a build integration.
7. Compare successive source contract versions after applying the same rules.

Source documents remain protected. SpecRefit outputs ordinary OpenAPI documents that Fabrikt or another downstream tool can consume without knowing SpecRefit was involved.

## Repositories and identity

- Product: [SpecRefit/specrefit](https://github.com/SpecRefit/specrefit).
- Website: [SpecRefit/specrefit.github.io](https://github.com/SpecRefit/specrefit.github.io), published at [specrefit.dev](https://specrefit.dev).
- Planned optional browser editor address: `play.specrefit.dev`; no editor is deployed there yet.
- Intended Maven group: `io.github.specrefit`; publishing infrastructure and artifact coordinates are not set up by this repository.

The website is independently maintained. Product modules belong together in this repository and are intended to be released in coordinated versions.

## Development status

On the owner's Windows workstation, run all commands below **inside Ubuntu WSL**. Node is a development prerequisite only; the Electron distribution includes its own runtime. The installed tools persist on D:, but a shell's `export PATH` does not persist. Repeat these exports in a new Ubuntu shell, or use the explicit PowerShell invocation documented in [AGENTS.md](AGENTS.md).

```bash
cd /mnt/d/GitHub/specrefit
export PATH="/mnt/d/devtools/node/node-v24.21.0-linux-x64/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH=/mnt/d/devtools/playwright
export electron_config_cache=/mnt/d/devtools/electron-cache
```

One-time setup for a fresh checkout (development dependencies and explicit runtime/browser downloads need network access):

```bash
npm ci --ignore-scripts --cache /mnt/d/devtools/npm-cache
node node_modules/electron/install.js
npx playwright install chromium firefox webkit
```

Ubuntu prerequisites include Xvfb and unzip. When Playwright reports missing system libraries, the owner installs them explicitly with `sudo /mnt/d/devtools/node/node-v24.21.0-linux-x64/bin/node node_modules/playwright/cli.js install-deps`. Do not run builds/tests with Windows Node as a fallback. Other development machines may use their own Linux Node 24 installation and cache paths.

Start the browser viewer:

```bash
npm run build
npm start
```

Open [the local viewer](http://127.0.0.1:4173). This development server serves static application assets on loopback; it has no contract upload, processing or proxy endpoint. Choose **Explore an example**, **Open contract files**, or **Open a folder**. Folder selection preserves relative paths. Select the correct **Entry document** if needed. **Diagnostics** offers a file picker for each missing document, assigning the supplied file to the exact requested URI. Mappings are session-only in this preview. Closing/reloading discards the session; originals are never modified.

On wide screens, the operation list and details scroll independently. Selecting an operation keeps your place in the list and opens its details at the top. On narrow screens, selection brings the details into view.

The production browser files are in `dist/web`; they can be served as static assets. No hosted editor has been deployed. Electron opens the same built files locally:

```bash
npm run desktop
```

Verified checks (WSL, 2026-10-02):

```bash
npm run check          # TypeScript checks
npm test               # 30 engine/semantic/security cases
npm run test:browser   # 21 cases in Chromium, Firefox and WebKit; includes Node parity
npm run test:desktop   # Electron parity and sandbox checks; package test skipped unless enabled
npm run package:desktop
SPECREFIT_TEST_PACKAGE=1 npm run test:desktop
```

`package:desktop` creates a Linux x64 development bundle at `artifacts/specrefit-linux-x64/`, including Electron, application files, Apache-2.0 and third-party notices. Launch its `electron` executable; the package test starts it without Node on PATH. This is a WSL packaging experiment, **not** native Windows/macOS support or clean-machine acceptance. Windows/macOS packages, installers, signing, auto-update design and release distribution remain open.

No generated contract output exists yet. Cross-runtime checks compare complete inspection results and retained source text, not transformed contract bytes. Configuration/rule tests, CLI/source-output protection integration, editing/export E2E, archive/fetch security, native acceptance, coverage import and SonarQube remain future work. See [ROADMAP.md](ROADMAP.md).

## License

Copyright 2026 SpecRefit contributors.

SpecRefit source code and documentation are licensed under the [Apache License, Version 2.0](LICENSE) (`Apache-2.0`). See the license for its permissions, conditions and warranty disclaimer. Third-party components retain their own licenses and required notices.
