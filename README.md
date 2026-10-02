<p align="center">
  <a href="https://specrefit.dev/">
    <img src="docs/assets/specrefit-logo.png" alt="SpecRefit" width="360">
  </a>
</p>

SpecRefit is a local-first workspace for inspecting OpenAPI contracts, previewing reproducible transformations and exporting the reviewed files. One shared processing implementation serves the browser and Electron editor. CLI and build integrations remain planned.

**Status: [0.1.0 released](https://github.com/SpecRefit/specrefit/releases/tag/v0.1.0) — local inspection, transformation and export.** Open YAML/JSON contracts, browse operations by tag, search/filter, inspect parameters, request bodies, responses and security, follow schemas and recursive references, and supply missing reference files. Representative OpenAPI 3.0.4, 3.1.2 and 3.2.0 fixtures are tested; this is not a complete OpenAPI/JSON Schema validator. Read the [support boundaries and evidence](docs/architecture/viewer.md) before relying on partial inspection. Select media types and extract inline schemas into named shared models, with ordered rules and exact output previews. See [transformation behavior and limits](docs/architecture/transformations.md). Export reviewed files directly or as a browser ZIP for multiple files. Comparison, a product CLI and native installers are not implemented.

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

Source documents remain protected. SpecRefit outputs ordinary OpenAPI documents that [Fabrikt](https://github.com/fabrikt-io/fabrikt) or another downstream tool can consume without knowing SpecRefit was involved.

## Repositories and identity

- Product: [SpecRefit/specrefit](https://github.com/SpecRefit/specrefit).
- Website: [SpecRefit/specrefit.github.io](https://github.com/SpecRefit/specrefit.github.io), published at [specrefit.dev](https://specrefit.dev).
- Browser playground address: `play.specrefit.dev`; deployment setup and verification are tracked in [playground publication](docs/architecture/playground.md).
- Maven groupId: `dev.specrefit`; the owner confirmed Maven Central namespace verification on 2026-10-03. Artifact IDs and publication infrastructure remain to be implemented.

The website is independently maintained. Product modules belong together in this repository and are intended to be released in coordinated versions.

## Development status

Development requires Git, Node.js 24 and npm. Run workstation builds/tests in Linux or WSL; native Windows/macOS packaging is verified on CI runners. Node is a development prerequisite only; the Electron distribution includes its own runtime. Run the commands below from the repository root, with Node and npm available on PATH. Machine-specific installation paths and cache settings belong in the ignored `DEVELOPMENT.local.md`, not in this README.

One-time setup for a fresh checkout (development dependencies and explicit runtime/browser downloads need network access):

```bash
npm ci --ignore-scripts
node node_modules/electron/install.js
npx playwright install chromium firefox webkit
```

Linux desktop tests require Xvfb, unzip and the browser/Electron system libraries. Playwright can install the supported distribution's browser libraries with `npx playwright install-deps`; installing OS packages requires administrator access. Archiving uses GNU tar/gzip on Linux, system tar on Windows and ditto on macOS. See [native packaging and acceptance boundaries](docs/architecture/desktop-packaging.md).

Start the browser viewer:

```bash
npm run build
npm start
```

Open [the local viewer](http://127.0.0.1:4173). This development server serves static application assets on loopback; it has no contract upload, processing or proxy endpoint. Choose **Explore an example**, **Open contract files**, or **Open a folder**. Folder selection preserves relative paths. Select the correct **Entry document** if needed. **Diagnostics** offers a file picker for each missing document, assigning the supplied file to the exact requested URI. Mappings are session-only in this preview. Closing/reloading discards the session; originals are never modified.

The **Theme ◐** button switches between light and dark, matching the website. On opening, the editor follows your system preference and continues following changes until you switch manually. Reloading returns to the system preference. On wide screens, the operation list and details scroll independently. Selecting an operation keeps your place in the list and opens its details at the top. On narrow screens, selection brings the details into view.

The production browser files are in `dist/web`; they can be served as static assets. Successful main builds publish those tested files to [the playground](https://play.specrefit.dev), with the [deployment boundaries and acceptance checks](docs/architecture/playground.md). Electron opens the same built files locally:

```bash
npm run desktop
```

Build and test commands:

```bash
npm run check          # TypeScript checks
npm test               # Inspection and transformation regression cases
npm run test:version   # Git-tag and development-version cases
npm run test:development # Development artifact/publication checks
npm run test:packaging # Complete native download-set validation
npm run test:browser   # Browser workflows and exact Node output parity in three browser engines
npm run test:desktop   # Electron parity and sandbox checks; package test skipped unless enabled
npm run package:desktop
SPECREFIT_TEST_PACKAGE=1 npm run test:desktop
npm run archive:development # Host-native archive, manifest and checksums; web archive on Linux
npm run test:desktop-archive # Extract and test the actual download with an empty PATH
```

Pull requests targeting `main`, pushes to `main` and pushed `v*` tags run the [Build workflow](.github/workflows/build.yml) with Node 24.21.0. Browser/engine checks run on Ubuntu 24.04, including Chromium, Firefox and WebKit. PR/main builds additionally package and test on Linux x64, Windows x64, macOS Apple Silicon and macOS Intel. The required `Build` check aggregates all applicable jobs and validates the complete matching artifact set; it must succeed on an up-to-date PR alongside code-owner approval. No path filters skip documentation-only PRs. Clean-machine and downloaded-app security prompts remain separate acceptance work.

Build versions come from Git: a clean `v0.1.0` tag yields `0.1.0`, while untagged/PR builds use `0.0.0-dev+g<commit>` and local changes add `.dirty`. Fetch tags before building. The browser header and packaged desktop use the same generated version; the root manifest's `0.0.0-dev` is only a development placeholder. Main CI explicitly forces the development channel. See [versioning and release channels](docs/architecture/versioning.md) for exact behavior.

Successful main builds automatically publish complete development downloads under [Development preview](https://github.com/SpecRefit/specrefit/releases/tag/development). This pipeline adds Windows x64 and macOS Apple Silicon/Intel packages to browser assets and Linux x64, with one manifest and checksums, after all native checks pass. One rolling prerelease replaces the previous preview; GitHub Latest points to the latest versioned release. See [development build behavior and verification](docs/architecture/development-builds.md). The first versioned release, [0.1.0](https://github.com/SpecRefit/specrefit/releases/tag/v0.1.0), includes the same five package targets, rebuilt and verified from its version tag. See the [release procedure and evidence](docs/architecture/stable-releases.md). Installers, CLI and Maven Central publication remain future work.

`package:desktop` creates the current native host's package at `artifacts/specrefit-<platform>-<arch>/`, including Electron, application files, Apache-2.0 and third-party notices. Extract the complete download and launch `SpecRefit.exe` on Windows, `SpecRefit.app` on macOS or `SpecRefit` on Linux. Windows builds are unsigned; macOS has an ad-hoc signature only, without Developer ID or notarization. OS security policy may block these development packages. See [launch instructions, CI evidence and limitations](docs/architecture/desktop-packaging.md). No installer or separately installed Node runtime is required.

Transformation previews generate the exact contract output used by export. Cross-runtime checks compare output file names, contract bytes and ZIP bytes as well as inspection results. Electron protects imported source identities when saving files. Full project configuration, CLI, archive import/fetch security, native acceptance, coverage import and SonarQube remain future work. See [ROADMAP.md](ROADMAP.md).

### Preview transformations

Choose media types in an operation's request or response and add a selection rule. Open an inline schema to extract a shared model with a suggested, editable name. In **Rules and preview**, reorder or remove rules and run **Preview these rules** to review the changes and exact resulting files. Copy the rules JSON to save it externally; paste it back to replay against the same logical input locations. Originals are never written. Under **Output**, enable **Bundle external references into one file** and choose YAML or JSON. This also works without transformation rules. See [bundling behavior and boundaries](docs/architecture/bundling.md).

After reviewing, choose **Export reviewed output**. A single YAML/JSON file downloads or saves directly. For multiple files, the browser downloads a ZIP preserving the folder structure; extract it into a separate output folder. The desktop app asks for an output folder and writes the reviewed files there directly. It checks all destinations against source paths and file identities before writing and permits replacement of non-source outputs. A failure during a multi-file save reports how many files were saved; it never reports a partial export as successful. Absolute references and documents mapped across URI origins require bundling first. See [export behavior, source protection and limitations](docs/architecture/export.md). Configuration-file export remains planned.

## Built in collaboration with ChatGPT Codex

SpecRefit is being developed in collaboration with OpenAI's ChatGPT Codex, contributing to design, implementation, tests and documentation. Human direction, product decisions and code review guide the work. This project explores how that collaboration can turn ideas into working software quickly.

## License

Copyright 2026 SpecRefit contributors.

SpecRefit source code and documentation are licensed under the [Apache License, Version 2.0](LICENSE) (`Apache-2.0`). See the license for its permissions, conditions and warranty disclaimer. Third-party components retain their own licenses and required notices.
