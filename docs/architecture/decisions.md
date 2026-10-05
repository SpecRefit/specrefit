# Decision register

Baseline recorded 2026-10-02. This register summarizes decisions; the linked requirements and architecture documents define their details. Add dates and rationale when decisions change instead of relying on chat history.

## Hosted release identity (2026-10-05)

Accepted and implemented for the hosted playground: separate release-presentation metadata from artifact versions, because main downloads intentionally remain development artifacts even at a stable tag. CI filters reachable SemVer tags against published non-prerelease GitHub releases. Stable publication dispatches the existing Build workflow on main, retaining all native/browser gates and the main-only Pages environment. The dispatch deploys the playground but does not republish development downloads. This avoids extra browser requests and avoids relying on an old workflow run still being rerunnable. The release-event integration awaits a subsequent real stable publication; fixtures cover the guards and metadata behavior.

## Contract-wide media preference (2026-10-05)

The owner requested a single preference across all request/response content and clarified that JSON was only an example: all advertised types must be options, a sole offered type must remain, and multipart often needs preservation. Use exact user-selected keys discovered by the shared engine, with all choices initially selected, including multipart. For multiple offerings, keep the intersection with the preferences; without a match, keep the original offerings. Represent the choice as one ordered `select-contract-media` rule so it can be replayed and composed with extraction. Shared content is explicitly within this rule's scope; ordinary targeted rules keep their narrower safeguards. See [behavior and verification](transformations.md#contract-wide-media-preference). Broader selector scopes and per-operation exceptions remain future work.

## Desktop local reference input (2026-10-05)

The owner clarified that opening a local desktop entry must resolve local relative component files automatically. Implement this in a native input adapter that uses shared-engine reference discovery, with a bounded worker and the existing source-identity protection. Automatic reads stay inside each selected file's directory tree, including resolved link targets; other locations remain explicit selections. This scope prevents a contract from reading arbitrary files or making network requests. Browser file selection remains unchanged. The existing build bundles the adapter and parser dependencies into the desktop distribution, without adding dependencies. See [behavior, limits and regression evidence](desktop-input.md).

## First versioned release (2026-10-03)

The owner requested 0.1.0 as the first GitHub release. Rebuild all browser/native downloads from the actual annotated version tag and verify them through the same required Build gate; never relabel development archives. Retain the verified set for deliberate draft upload and publication as Latest. Keep main's rolling Development preview separate. This initial 0.x release covers the existing feature slice, not completion of all requirements or production OS acceptance. See [release procedure](stable-releases.md).

The owner selected Maven groupId `dev.specrefit` and confirmed its namespace is verified by Maven Central on 2026-10-03, superseding the intended `io.github.specrefit` group. Artifact IDs, integration implementation and publication credentials/signing remain future work.

## Accepted

On 2026-10-02 the owner authorized a first read-only viewer slice and accepted Electron as the desktop direction. See [viewer scope and evidence](viewer.md) for the exact agreed scope, implementation workflow and dependency evaluation. This sequences delivery without removing editing, transformation, comparison or export requirements. Library adoption remains evidence-driven.

| Decision | Rationale |
| --- | --- |
| One product repository, separate existing website repository | Coordinate behavior and versions across product modules without coupling website edits to releases. |
| Apache License 2.0 for product source code and documentation (2026-10-02) | The owner accepts commercial and closed-source derivatives under the license conditions; explicit patent provisions support broad reuse. See [LICENSE](../../LICENSE). |
| Independent product, no shared parser project or Fabrikt changes | Adapt ordinary OpenAPI input for any downstream consumer. |
| One shared processing implementation | Same version and complete inputs must yield byte-identical outputs through all interfaces. |
| Browser, desktop, CLI and thin build integrations | Equivalent processing with platform-appropriate input mechanisms. |
| Entirely local processing, no telemetry or required account | Safe standalone operation including offline environments. |
| Bundled runtimes, desktop installer and portable distribution | No separately installed developer runtime for product users. |
| Explicit update checks and offline packages | No unsolicited network access or silent toolchain changes. |
| OpenAPI 3.0, 3.1 and 3.2, early future-version work | Version-aware behavior without silently reducing newer semantics. |
| Multi-file inputs, missing-reference upload/mapping and optional explicit retrieval | Real contract structures are a baseline requirement; no forced pre-bundling. |
| Flexible YAML/JSON configuration filenames | Equal capabilities across formats and compatibility with project preferences. |
| Ordered rules, saved exceptions and structural edit preconditions | Every editor choice must be replayable without line-number dependence. |
| Source and configuration protection; replaceable non-source outputs | Repeated processing must not modify its inputs. |
| Bundled or multi-file output, optional YAML/JSON selection | Fit downstream tools without sacrificing source organization. |
| Preserve unknown information and YAML comments where reliable | Avoid discarding useful contract context. |
| Partial inspection, blocking errors only when needed for reliable processing | Imperfect contracts should remain understandable without misleading exports. |
| Semantic reports plus Git-style diffs and CLI dry-run | Explain changes and review actual generated bytes. |
| Compare contract X/Y using identical rules and engine | Expose the practical impact of supplier updates and rule failures. |
| Documentation as durable context | Development must resume from a clone without the original chat. |

The owner requested a required successful PR build on 2026-10-02. GitHub Actions runs type checks, engine tests and the viewer build on Ubuntu 24.04/Node 24.21.0 using locked dependencies. The `Build` status is required alongside code-owner approval, with the branch up to date. Broader browser/desktop/native CI coverage remains open; this gate does not replace it.

Git-tag versioning was accepted on 2026-10-02: clean `v`-prefixed SemVer tags determine the coordinated product version, and development builds identify their commit. Implementation and boundaries are recorded in [versioning.md](versioning.md). GitHub Releases is the planned desktop/CLI download channel; Maven Central is the planned channel for the future Maven integration. Publishing workflows and native installer version mappings remain future work.

On 2026-10-02 the owner superseded the per-commit/Latest development policy: keep one rolling Development preview prerelease under the development tag, replacing its downloads after successful main builds. Reserve Latest for stable releases. Remove the previous development releases and update website links. See [development previews](development-builds.md) for replacement, recovery and migration behavior. Stable and Maven Central publication remain separately authorized future work.

## Provisional implementation proposals

- TypeScript and `yaml` are now adopted only for the bounded viewer; Electron is accepted and has a Linux runtime-bundling experiment. The broader transformation representation and Node.js-based CLI distribution remain provisional. See [viewer evidence and limitations](viewer.md).
- The module layout in [overview.md](overview.md). Refine based on implementation without weakening its dependency boundaries.
- SonarQube-compatible analysis and coverage reporting. The owner is strongly considering SonarQube; edition, deployment and quality thresholds are not selected.
- Maven is the first named build integration; .NET and others may follow. No .NET plugin is currently implemented or separately specified.

## Outstanding decisions

- Contribution guidance and third-party notice handling under the selected Apache License 2.0. The product license itself is decided.
- Full OpenAPI/JSON Schema validator, transformation-time document representation, product CLI packaging and supported production OS/browser versions. The viewer's parser, native DOM editor, npm, test tools and Node 24 development runtime are recorded in [viewer.md](viewer.md).
- Configuration schema, rule target syntax, collision/conflict policy details, format discovery, diagnostic/report schemas and CLI syntax.
- Concrete supported OS/browser/CPU versions, runtime packaging, signed artifacts, release process and update verification.
- Credentials for optional fetching, safe retrieval scope/redirects, resource limits and archive policy.
- SonarQube setup and thresholds; CI runner matrix and supply-chain checks.
- Output destination conventions and failure recovery across multiple writes. The bundle preview offers an explicit YAML/JSON choice, initially YAML for comment retention.
- Detailed semantics and timing for authentication preference rules, model merging and reference cleanup. These were exploratory product ideas and must not be assumed safe or fully specified.

## Superseded directions

A separately reusable parser intended to be shared with Fabrikt is no longer a project objective. Requiring a single pre-bundled input to accelerate development was explicitly rejected. External network retrieval was initially outside scope, then accepted as optional explicit input acquisition; it remains outside the engine and cannot require a web processing/proxy server.

## Reviewed export and next desktop distribution (2026-10-03)

Export the exact existing preview through platform adapters. Single files save directly; multiple files use a ZIP download in browsers and a chosen output directory in Electron. Use pinned MIT-licensed fflate for deterministic browser archives, with the [dependency review and persistence limits](export.md). Native saving preflights every destination, protects original/current source identities and replaces each file through staging. Multi-file failures report the completed count and remain explicitly incomplete; there is no cross-file rollback guarantee.

The owner agreed to Windows and macOS packaging together after export. Development macOS builds will be unsigned and unnotarized because no Apple Developer account is available. Signing/notarization and production OS support remain future decisions; do not claim native acceptance from WSL evidence.

## Hosted preview and website (2026-10-02)

Native desktop packaging implementation (2026-10-03): use the reviewed Electron Packager build dependency and stage only application assets. Target Windows x64 and separate macOS arm64/x64 packages on native CI, alongside Linux x64. macOS uses certificate-free ad-hoc signatures for launchability, without Developer ID/notarization; this implements the owner's no-account development path. The required Build gate must include every native job and complete artifact assembly. See [packaging design and acceptance evidence](desktop-packaging.md).

The owner requested the playground and development download availability on the website. Publish the tested browser viewer from successful main builds to GitHub Pages at play.specrefit.dev, keeping all contract processing local. Browser checks join the required Build gate. See [publication boundaries](playground.md); stable download channels must be separated before stable releases are introduced.

## First transformations (2026-10-02)

The owner authorized media selection and inline schema extraction in one PR. Use exact user-selected media keys, deterministic suggested names with saved overrides, ordered rules and explicit preconditions. The shared engine generates actual preview bytes; UI wrappers do not implement transformation semantics. The existing yaml syntax tree is used for retained-format preview serialization and comment movement, without new dependencies. [Scope and evidence](transformations.md) distinguish this slice from full configuration, export, bundling, duplicate-model merging and CLI support.

## Bundling and system appearance (2026-10-02)

The owner authorized implementing the general external-reference output option next. The shared engine now produces a single YAML/JSON preview after ordered rules, with deterministic component names, internal recursive references and explicit blocking of unsupported relocation semantics. See [bundling scope](bundling.md). Existing yaml syntax nodes preserve associated comments; no new dependency or privileged file API was introduced. Safe export remains separate. For appearance, the owner chose the website's simple Theme ◐ toggle instead of a selection menu. The editor starts with the system preference and follows OS changes until manually switched. The override lasts for the page session; reload follows the system again. No browser storage or network request is involved.
