# Roadmap

This roadmap sequences implementation; it does not remove the requirements in [product.md](docs/requirements/product.md). There are no delivery dates or claimed implementation milestones beyond the repository documentation foundation.

## Current state

- [x] Agree product scope, reproducibility constraints and repository boundaries.
- [x] Record requirements, architecture direction, development instructions and open decisions in the product repository.
- [x] Select Apache License 2.0 and add its official text to LICENSE.
- [ ] Validate the proposed technical stack.
- [ ] Implement product modules, build/test commands and CI.
- [ ] Deliver a usable product release.

The separate landing page is already published at [specrefit.dev](https://specrefit.dev). It is not an application release.

## 1. Feasibility and foundational decisions

The next development task is a bounded prototype, not a production parser or an empty package tree.

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
