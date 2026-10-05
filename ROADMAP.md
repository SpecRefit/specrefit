# Roadmap

This roadmap sequences implementation; it does not remove the requirements in [product.md](docs/requirements/product.md). Version 0.1.0 delivers the first inspection, transformation and export slice; it does not complete all product requirements.

## Current state

- [x] Publish [0.2.0](https://github.com/SpecRefit/specrefit/releases/tag/v0.2.0) as stable Latest after [tag Build 37272119716](https://github.com/SpecRefit/specrefit/actions/runs/37272119716), with all seven asset sizes and SHA-256 digests verified before publication. [Release notes](docs/releases/0.2.0.md) describe the improvements since 0.1.0; [publication evidence and the reusable runbook](docs/architecture/stable-releases.md) support continuation in a fresh chat.

- [x] Implement hosted cache freshness before editor startup, content-addressed assets and actionable failures, with stale-page regression cases; see [cache behavior and rollout limits](docs/architecture/playground.md#cache-freshness). Live hosted acceptance passed with 0.2.0; see [release evidence](docs/architecture/stable-releases.md#020).
- [x] Implement hosted release identification and a development banner with commit identity; see [versioning behavior and verification](docs/architecture/versioning.md#hosted-playground-presentation). The actual 0.2.0 release event, full main rebuild and live version display were verified; see [release evidence](docs/architecture/stable-releases.md#020).
- [x] Agree product scope, reproducibility constraints and repository boundaries.
- [x] Record requirements, architecture direction, development instructions and open decisions in the product repository.
- [x] Select Apache License 2.0 and add its official text to LICENSE.
- [ ] Validate the proposed technical stack.
- [x] Implement the first shared viewer engine/editor with documented WSL build/test commands.
- [x] Derive coordinated browser/desktop build versions from SemVer Git tags, with commit-based development labels and tag-build validation. See [versioning](docs/architecture/versioning.md). The first versioned release is recorded below.
- [x] Verify the mandatory GitHub Actions PR build gate (type checks, engine tests and viewer build); [first successful run](https://github.com/SpecRefit/specrefit/actions/runs/37057588856). The active main ruleset requires the GitHub Actions `Build` check on an up-to-date branch and retains code-owner approval.
- [ ] Complete and verify CI and native OS acceptance.
- [x] Verify the first automatic main development publication: [successful run](https://github.com/SpecRefit/specrefit/actions/runs/37061962174) and [development preview](https://github.com/SpecRefit/specrefit/releases/tag/development). Windows/macOS packages are now implemented; CLI/Maven packages remain future work.
- [x] Deploy and verify the read-only playground at play.specrefit.dev; browser checks now run in CI. See [deployment evidence](docs/architecture/playground.md).
- [x] Verify rolling preview replacement, including all desktop platforms, in [the successful main run](https://github.com/SpecRefit/specrefit/actions/runs/37075535078). Stable Latest remains separate.
- [x] Implement explicit media selection and inline schema extraction with shared-engine previews; see [scope and tests](docs/architecture/transformations.md).
- [x] Implement general external-reference bundling previews in YAML/JSON, with shared-runtime parity and system light/dark appearance; see [scope and tests](docs/architecture/bundling.md). Broader reference semantics remain open.
- [x] Export exact reviewed files: direct single-file saving, browser ZIP downloads for multiple files and protected native directory export. See [source protection, failure recovery and tests](docs/architecture/export.md); this does not establish native Windows/macOS acceptance.
- [x] Implement portable Windows x64 and macOS Apple Silicon/Intel packaging alongside Linux, with required native runner checks and complete artifact assembly. [Packaging evidence and limits](docs/architecture/desktop-packaging.md) distinguish CI coverage from manual downloaded-package acceptance and installers.
- [x] Deliver the first bounded product release, 0.1.0; remaining roadmap requirements stay open.
- [x] Publish [0.1.0](https://github.com/SpecRefit/specrefit/releases/tag/v0.1.0) after its [successful tag build](https://github.com/SpecRefit/specrefit/actions/runs/37075840504), with five verified archives plus manifest/checksums. See [release evidence](docs/architecture/stable-releases.md) and [scope/notes](docs/releases/0.1.0.md).
- [x] Implement compact operation/filter navigation and a non-wrapping version header for [issue #13](https://github.com/SpecRefit/specrefit/issues/13), with browser and native-window regression coverage described in [viewer evidence](docs/architecture/viewer.md). This follows 0.1.0 and does not alter its published assets.

The separate landing page is already published at [specrefit.dev](https://specrefit.dev). It is not an application release.

Desktop local reference discovery now loads dependencies inside the selected file's directory tree, using the shared engine and native source protection. See [behavior and regression coverage](docs/architecture/desktop-input.md). This is separate from future optional network retrieval and broader schema/reference semantics. The next planned product work remains saved project configuration and CLI replay.

Contract-wide request/response media preference is now implemented as one ordered rule, with actual advertised types as choices, preservation of single/no-match content and explicit multipart retention. See [scope and regression coverage](docs/architecture/transformations.md#contract-wide-media-preference). Broader selection scopes, exceptions and full project configuration remain open.

## First viewer slice — 2026-10-02

The owner authorized read/inspect before transformations. Implemented: local YAML/JSON import, folder structure, grouped/searchable operations, parameters with inheritance, bodies/responses/security, schemas and recursive JSON Pointer references, exact missing-document supply, source inspection and diagnostics. Engine checks cover representative 3.0.4/3.1.2/3.2.0 fixtures. Large-contract regressions cover over 12 MB and 1,200 operations; the owner-supplied GitHub REST contract also opens in all three tested browsers. Browser/Node and Electron/Node inspection parity is verified; the Linux development distribution includes its runtime. See [exact evidence and support boundaries](docs/architecture/viewer.md) and [commands](README.md#development-status).

The viewer deliberately reports unimplemented schema scope/anchor and dialect behavior rather than guessing. ZIP import, persisted project mappings, complete validation, broader transformations, CLI and clean-machine acceptance remain open. Next actions: full project configuration and CLI replay; broaden reference/dialect coverage and verify downloaded native packages manually. See [playground publication](docs/architecture/playground.md) for deployment and download channel boundaries. Review approval remains required and must not be bypassed.

## 1. Feasibility and foundational decisions

Windows and macOS desktop packaging is implemented together, including bundled runtimes, separate Intel/Apple Silicon Mac builds and native CI checks. See [packaging evidence](docs/architecture/desktop-packaging.md) for the first PR's required checks. macOS development artifacts use certificate-free ad-hoc signatures, without Developer ID or notarization. The next implementation step is full project configuration and CLI replay; installers and manual downloaded-package acceptance remain open.

This milestone remains open. The viewer provides evidence for browser parsing, shared inspection, fixed multi-file references, source retention and an Electron Linux runtime bundle. The first transformation slice provides bounded media selection/extraction and transformed-byte parity evidence; bundled preview output now has bounded evidence; full project configuration and packaged CLI parity remain open.

- Evaluate libraries for all three OpenAPI families, browser compatibility, syntax/comment preservation, licensing, maintenance and offline behavior.
- Use fixed multi-file fixtures with relative references, recursive schemas, duplicate basenames, unknown extensions and YAML comments.
- Apply a small explicit JSON-preference transformation and produce retained-structure and bundled output.
- Run the same implementation in a real browser and CLI; compare exact output file paths and bytes for identical inputs. Exercise both JSON and YAML serialization.
- Verify the feasibility of distributing a CLI with its runtime and using that distribution from a thin Maven integration without a separately installed Node.js runtime.
- Record evidence, gaps and the selected stack in an architectural decision. Discuss any material architecture change rather than quietly weakening requirements.
- Define contribution guidance consistent with the selected Apache License 2.0 and review third-party license/notice requirements before releases.

Acceptance: documented runnable commands, reviewed fixtures, demonstrated cross-runtime equality, explicit findings on comment preservation and reference handling, and a defensible library/runtime choice. Do not label the full product supported on the basis of this prototype alone.

## 2. Shared processing foundation

- Define configuration schema/version handling, diagnostics, rule targeting/preconditions, output settings and execution metadata.
- Establish the engine/platform boundary and a document representation that retains unknown information and reliably associated comments.
- Implement multi-file reference discovery and mapping, cycles, missing-resource diagnostics and validated project imports.
- Implement deterministic serialization, safe output planning and protection of source/configuration identities.
- Establish focused tests, conformance fixtures, verified development commands and CI. Prepare SonarQube analysis/coverage integration when its setup is agreed.

Acceptance: all supported input families have representative passing fixtures, invalid input produces actionable diagnostics, and engine processing cannot make network or disk calls.

## 3. First complete user workflow

- Inspect operations, inputs, outputs, schemas, references and diagnostics in the shared editor.
- Apply JSON preference with scope, explicit ordering, exceptions and missing-target policy.
- Preview a semantic explanation and exact file diffs, then export multi-file or bundled YAML/JSON.
- Save/reload custom-named YAML/JSON configuration and repeat through the CLI, including dry-run.
- Deliver the same workflow through browser and desktop wrappers; do not fork engine logic.

Acceptance: a real multi-file project can be imported, reviewed, adapted, saved and reproduced via CLI with identical output and intact sources. This milestone is a development slice; it does not justify claiming completion of all remaining requirements.

## 4. Reapplication and contract updates

- Add reproducible structural edits with expected preconditions and already-applied detection.
- Compare source contract X/Y using the same rules and engine, including all reference documents.
- Connect source diffs, transformed diffs and rule applicability reports in the editor.
- Provide readable and JSON comparison reports via CLI for automation.

Acceptance: moved lines do not break rules; ambiguous or changed targets are explained without guessing; blocked output cannot be mistaken for a successful comparison/export.

## 5. Distribution, integrations and release readiness

- Complete Windows/macOS/Linux installers, portable desktop packages and runtime-inclusive CLI distributions.
- Add a thin version-pinned Maven integration and document the protocol other integrations can use.
- Complete explicitly requested external retrieval, secure mappings and offline workflows; browser upload remains a supported alternative.
- Implement explicit update checks, offline updates and appropriate artifact verification/signing after the release design is agreed.
- Validate clean-machine startup, no unsolicited network traffic, source protection, cancellation, resource limits, keyboard accessibility and useful error recovery.
- Run native multi-OS packaging/integration checks and real-browser conformance checks. Owner-workstation builds/tests stay in WSL; native acceptance runs in suitable CI or agreed environments.

Acceptance: the released feature set has evidence on every declared platform, includes no separately required SpecRefit runtime, and has honest support/security documentation. Evaluate all agreed product requirements before calling the product complete.

## Later evolution

Track new OpenAPI specifications early, label experimental support and promote it only with conformance evidence. Design authentication selection, schema/model merging and reference-cleanup transformations separately because they may alter contract meaning. Add further build integrations when their user workflows are specified. Do not introduce an independent parser product or a backend processing service as incidental scope.

## Updating this file

Mark work complete only with actual implementation and verification evidence, referenced by test commands, decision documents or commits as appropriate. At the end of substantial tasks, update the next actionable work and unresolved blockers. Keep promises, proposals and delivered functionality distinguishable.
