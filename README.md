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
- Browser playground address: `play.specrefit.dev`; deployment setup and verification are tracked in [playground publication](docs/architecture/playground.md).
- Intended Maven group: `io.github.specrefit`; publishing infrastructure and artifact coordinates are not set up by this repository.

The website is independently maintained. Product modules belong together in this repository and are intended to be released in coordinated versions.

## Development status

Development requires Git, Node.js 24 and npm in a Linux environment. Windows contributors can use WSL. Node is a development prerequisite only; the Electron distribution includes its own runtime. Run the commands below from the repository root, with Node and npm available on PATH. Machine-specific installation paths and cache settings belong in the ignored `DEVELOPMENT.local.md`, not in this README.

One-time setup for a fresh checkout (development dependencies and explicit runtime/browser downloads need network access):

```bash
npm ci --ignore-scripts
node node_modules/electron/install.js
npx playwright install chromium firefox webkit
```

Linux desktop tests require Xvfb, unzip and the browser/Electron system libraries. Playwright can install the supported distribution's browser libraries with `npx playwright install-deps`; installing OS packages requires administrator access. Development archiving additionally uses GNU tar and gzip. Native Windows/macOS packaging is not implemented yet.

Start the browser viewer:

```bash
npm run build
npm start
```

Open [the local viewer](http://127.0.0.1:4173). This development server serves static application assets on loopback; it has no contract upload, processing or proxy endpoint. Choose **Explore an example**, **Open contract files**, or **Open a folder**. Folder selection preserves relative paths. Select the correct **Entry document** if needed. **Diagnostics** offers a file picker for each missing document, assigning the supplied file to the exact requested URI. Mappings are session-only in this preview. Closing/reloading discards the session; originals are never modified.

On wide screens, the operation list and details scroll independently. Selecting an operation keeps your place in the list and opens its details at the top. On narrow screens, selection brings the details into view.

The production browser files are in `dist/web`; they can be served as static assets. Successful main builds publish those tested files to [the playground](https://play.specrefit.dev), with the [deployment boundaries and acceptance checks](docs/architecture/playground.md). Electron opens the same built files locally:

```bash
npm run desktop
```

Build and test commands:

```bash
npm run check          # TypeScript checks
npm test               # 30 engine/semantic/security cases
npm run test:version   # Git-tag and development-version cases
npm run test:development # Development artifact/publication checks
npm run test:browser   # 21 cases in Chromium, Firefox and WebKit; includes Node parity
npm run test:desktop   # Electron parity and sandbox checks; package test skipped unless enabled
npm run package:desktop
SPECREFIT_TEST_PACKAGE=1 npm run test:desktop
npm run archive:development # Browser/Linux archives, manifest and checksums
```

Pull requests targeting `main`, pushes to `main` and pushed `v*` tags run the [Build workflow](.github/workflows/build.yml) on GitHub's Ubuntu 24.04 runner with Node 24.21.0: `npm ci --ignore-scripts`, `npm run check`, `npm test`, `npm run test:version`, `npm run test:development`, then `npm run build`. PR/main runs also package and test Electron before archiving the development downloads. The `Build` check must succeed on an up-to-date PR before merging, alongside the existing code-owner approval rule. There are no path filters that skip documentation-only PRs. Chromium, Firefox and WebKit tests also run in the required Build job. Native multi-OS acceptance remains separate; a green build does not establish those results.

Build versions come from Git: a clean `v0.1.0` tag yields `0.1.0`, while untagged/PR builds use `0.0.0-dev+g<commit>` and local changes add `.dirty`. Fetch tags before building. The browser header and packaged desktop use the same generated version; the root manifest's `0.0.0-dev` is only a development placeholder. Main CI explicitly forces the development channel. See [versioning and release channels](docs/architecture/versioning.md) for exact behavior.

Successful main builds automatically publish complete development downloads under [GitHub Releases / latest](https://github.com/SpecRefit/specrefit/releases/latest), verified by the first successful main publication. Current downloads are browser assets and an experimental Linux x64 desktop bundle, plus a manifest and checksums. Windows/macOS/CLI/Maven artifacts join only when implemented. These are development builds, not stable releases; GitHub's prerelease flag cannot be combined with Latest. See [development build behavior and verification](docs/architecture/development-builds.md). Stable releases and Maven Central publication remain future work.

`package:desktop` creates a Linux x64 development bundle at `artifacts/specrefit-linux-x64/`, including Electron, application files, Apache-2.0 and third-party notices. Launch its `electron` executable; the package test starts it without Node on PATH. This is an experimental Linux package, **not** native Windows/macOS support or clean-machine acceptance. Windows/macOS packages, installers, signing, auto-update design and stable release distribution remain open.

No generated contract output exists yet. Cross-runtime checks compare complete inspection results and retained source text, not transformed contract bytes. Configuration/rule tests, CLI/source-output protection integration, editing/export E2E, archive/fetch security, native acceptance, coverage import and SonarQube remain future work. See [ROADMAP.md](ROADMAP.md).

## License

Copyright 2026 SpecRefit contributors.

SpecRefit source code and documentation are licensed under the [Apache License, Version 2.0](LICENSE) (`Apache-2.0`). See the license for its permissions, conditions and warranty disclaimer. Third-party components retain their own licenses and required notices.
