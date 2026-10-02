# SpecRefit — contributor and agent instructions

## Purpose and required reading

SpecRefit adapts OpenAPI contracts with reproducible rules using one shared engine across browser, desktop, CLI and build integrations. It is independent of Fabrikt. Read [README.md](README.md), [product requirements](docs/requirements/product.md), [architecture](docs/architecture/overview.md), [execution design](docs/architecture/configuration-and-execution.md), [decisions](docs/architecture/decisions.md) and [ROADMAP.md](ROADMAP.md) before the first development task in a new clone or chat.

These files replace reliance on chat history. Preserve accepted requirements unless the user explicitly changes them. Clearly distinguish agreed requirements, proposed implementation details and implemented behavior. Do not claim that roadmap items exist. Challenge choices with concrete reasons; agreement with the user is not a substitute for engineering judgment.

## Current repository state

A read-only viewer preview now exists: shared in-memory TypeScript inspection, a browser editor and an Electron wrapper. Verified commands and current evidence are in README.md and docs/architecture/viewer.md. The complete feasibility milestone, transformations, CLI and native acceptance remain open. Do not confuse inspection parity with deterministic transformed output. Create modules only when they have real responsibilities and code.

## Non-negotiable boundaries

- A single shared engine owns transformation semantics. Never reimplement rules in the UI, CLI or a plugin.
- The same engine version, configuration, source bytes, resolved reference bytes and output settings must produce byte-identical output files through every interface and supported OS. Execution reports may contain explicitly separated non-deterministic metadata, but generated contracts must not.
- Engine code cannot directly access the network, filesystem, Electron APIs or browser file APIs. Platform adapters supply documents and persist results.
- Browser contract processing is entirely local, without a SpecRefit processing or proxy server. No telemetry, tracking scripts, required account or automatic update/network checks.
- Desktop and CLI include the runtime they need; do not require users to install developer tools or runtimes. Dependencies already inherent to a host integration, such as Maven and its JVM, remain host prerequisites.
- Protect every source document, including reference documents, and the active configuration from output writes. Checking path strings alone is insufficient; account for resolved paths, aliases, symlinks, hard links and filesystem-specific identity where available. Existing non-source output files may be replaced safely.
- Preserve unknown fields and extensions. Preserve YAML comments where reliably associated with retained or moved content. Never silently discard unsupported constructs or guess ambiguous rule targets.
- Validate hostile input at runtime. TypeScript static types, if chosen, are not input validation.
- Keep credentials out of configurations, generated contracts, logs, fixtures and commits. Network retrieval is an explicit optional input step with controlled access, separate from transformation.

## Architecture and dependency choices

The product's source code and documentation use Apache License 2.0 (`Apache-2.0`), selected by the owner on 2026-10-02. Preserve the unmodified license text in LICENSE, include it in distributions and set the correct SPDX license identifier in package metadata when manifests are introduced. Preserve required third-party notices and check dependency license compatibility. Do not relicense the project without an explicit user decision.

TypeScript and `yaml` are adopted for the bounded viewer based on the evidence in docs/architecture/viewer.md; Electron is the owner's accepted desktop direction. Node.js-based CLI packaging remains provisional. Broader transformation, comment movement, bundling and deterministic serialization still require feasibility evidence before extending these choices. A standalone shared parser project is not in scope.

Before adding a dependency, record its purpose, license, maintenance status, browser/runtime compatibility, offline behavior and any network or telemetry behavior. Prefer established libraries when suitable; do not rebuild a parser merely to avoid dependencies. A library must not silently narrow the agreed OpenAPI support. Review transitive dependencies and keep runtime dependencies proportionate. No license decision for this project may be inferred from a library's license.

## Testing policy

Tests must establish behavior, not merely repeat implementation details. For production changes, run the relevant tests and required repository checks before claiming completion. Add reproducible regression cases for defects. Documentation-only changes need link, consistency and diff checks, not a fabricated application build.

The owner requested a mandatory successful PR build on 2026-10-02. `.github/workflows/build.yml` runs locked dependency installation, type checks, engine tests and the viewer build for every PR to `main`, including documentation-only PRs. Keep the `Build` job name aligned with the required GitHub status check. Preserve the existing code-owner review rule. README.md describes the commands and the remaining CI coverage limits.

Once implementation begins, provide documented commands for these layers:

1. Focused engine tests for targeting, preconditions, exceptions, explicit rule order, diagnostics and deterministic output.
2. Shared conformance fixtures for OpenAPI 3.0, 3.1 and 3.2, JSON and YAML, comments and extensions, multiple files, relative references, external-URI mappings, cycles and duplicate basenames.
3. Cross-runtime tests that compare output file names and bytes for identical inputs in real supported browser engines and the CLI engine. Desktop integration must also prove it uses the same behavior.
4. Integration tests for the CLI, configuration loading, dry-run, source protection, safe replacement of existing output and missing-input diagnostics.
5. End-to-end editor tests for import, supplying missing references, inspection, editing, preview, exceptions, export and comparing successive contract versions. Include keyboard use and actionable diagnostics.
6. Security tests for unsafe paths and links, archive traversal, malformed input, resource exhaustion, cyclic references and parser alias expansion; also test optional fetch controls and redaction when introduced. Browser and Electron interfaces must not execute contract-supplied content.
7. Native packaging and clean-machine checks on Windows, macOS and Linux, including startup without separately installed runtimes, portable operation, offline use and no unsolicited network traffic.

Expected-output fixtures are reviewed contracts. Do not regenerate them to hide an unexpected failure. Explain intentional changes, inspect the complete fixture diff and rerun with regeneration disabled. Tests must not rely on live remote references; use fixed local fixtures and controlled network servers where network behavior itself is tested.

SonarQube is under consideration and the project should support its analysis and coverage import. It complements behavioral tests, dependency review and security testing; a quality gate or coverage percentage is not proof of correct transformation behavior. Agree thresholds when implementing the tooling instead of inventing arbitrary targets now.

## Workstation and Git constraints

- On the owner's Windows workstation, run all builds and automated tests exclusively in WSL. Do not fall back to Windows build/test execution. If WSL is unavailable, report the blocker.
- The owner installed Linux Node.js 24.21.0 (npm 11.19.0), Xvfb and unzip in Ubuntu WSL on 2026-10-02. Node lives at `/mnt/d/devtools/node/node-v24.21.0-linux-x64/bin`. For repeatable non-interactive execution from PowerShell, use `wsl -d Ubuntu --exec env PATH=/mnt/d/devtools/node/node-v24.21.0-linux-x64/bin:/usr/local/bin:/usr/bin:/bin bash -c '<command>'`. This selects Linux tools without inheriting Windows npm. A terminal-only `export PATH` does not persist; verify tool paths and versions in each new environment. If WSL system prerequisites are missing, give the owner installation instructions instead of installing them automatically.
- Browser binaries are at `/mnt/d/devtools/playwright`; set `PLAYWRIGHT_BROWSERS_PATH` to that location when running browser tests. Electron's download cache is `/mnt/d/devtools/electron-cache`. The owner installed WebKit system prerequisites on 2026-10-02. README.md records the verified build/test/start commands.
- Native multi-OS acceptance remains required: use appropriate CI runners or separately agreed test environments. WSL success alone is not evidence of native Windows or macOS compatibility. Obtain agreement before introducing a local exception to the WSL rule.
- Work on ordinary branches in the shared D: checkout; the owner explicitly ruled out worktrees for this implementation workflow. Coordinate executing chats to avoid concurrent branch changes/writes. Keep project checkouts and heavy development outputs on D where practical.
- Prefer `codex/` for new implementation branches. Keep history focused; use amend where appropriate for an existing task commit. Do not rewrite another person's commits or force-push shared history without authorization; use a lease when an authorized rewrite is necessary.
- Before committing, inspect status, the complete relevant diff and whitespace checks. Never stage unrelated changes or secrets.
- Do not publish packages, purchase services, add telemetry, change product requirements, or choose a legal license as incidental implementation work. Obtain the relevant user decision first. The initial repository creation and documentation publication are authorized.

## Documentation and handoff

Release versions derive from `v`-prefixed SemVer Git tags; untagged/PR builds carry commit-based development versions. Keep version logic in build tooling, never the shared engine. Do not manually bump the root development placeholder to make a release. See docs/architecture/versioning.md and README.md for `npm run test:version`, dirty/tag behavior, generated metadata and planned publication channels. Creating a versioning workflow does not authorize publishing a release.

Keep prose soft-wrapped. Update requirements when the user changes behavior; update decisions with the rationale and status of architectural choices. Update the roadmap with actual completion evidence and the next actionable task. Record new verified build/test commands in README.md and reference them here. A fresh chat must be able to distinguish what exists, what is agreed and what remains unresolved.

At task completion, report what changed, what was tested, any limitations and remaining decisions. Do not silently treat partial support as complete. Avoid unnecessary scaffolding, speculative features and tests for purely cosmetic or documentation-only changes.
