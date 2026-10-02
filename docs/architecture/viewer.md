# First viewer: scope and evidence

## Accepted scope (owner, 2026-10-02)

Deliver a usable read-only OpenAPI viewer before transformation workflows. Inspect YAML and JSON in OpenAPI 3.0, 3.1 and 3.2, operations grouped by tag with search/filter, operation descriptions, parameters, request bodies, responses and security, navigable schemas/references (including recursion), multi-file input and targeted missing-file supply. Partial inspection and location-specific diagnostics are required. Unknown fields remain inspectable. Semantic correctness requires tests beyond successful parsing.

Editing, rules, comparison and export remain product requirements, outside this viewer slice. The full feasibility milestone remains open until transformation, comment movement, bundling, deterministic contract output and runtime-inclusive CLI/Maven experiments have evidence. Viewer evidence must not be presented as completion of those experiments.

Electron is the accepted desktop direction for Windows/macOS/Linux. Share the editor and engine with the browser. Distribution and native OS support require evidence; selecting Electron does not establish those claims.

Use the approved website's blue/teal identity, generous space, clear hierarchy, plain language and details on demand. Support keyboard navigation, readable contrast and scalable text. The website and organization profile are references, not part of this implementation's writable scope.

Implementation takes place in executing chats on ordinary `codex/` branches, without worktrees. Coordinate access to the shared checkout. Product and material architecture decisions remain in the central decision chat. Make cohesive reviewable commits and submit a PR; do not bypass code-owner review or merge it. Preserve the owner's existing uncommitted handoff correction about the resolved avatar issues.

## Dependency evaluation plan

Evaluate a generic syntax-preserving YAML/JSON document library rather than adopting an OpenAPI model that may omit unknown fields or new specification constructs. Keep reference and inspection semantics in the shared engine. A viewer is not a complete OpenAPI or JSON Schema validator; diagnostics must make that distinction explicit.

Candidate metadata checked from the npm registry on 2026-10-02 before installation:

| Candidate | Purpose / license | Maintenance / compatibility / offline and network behavior |
| --- | --- | --- |
| `yaml` 2.9.1 | In-memory YAML 1.2 syntax tree, JSON-compatible values and source locations; ISC | Published 2026-09-11, no runtime dependencies, maintained browser and Node entry points. No acquisition APIs or telemetry. Test comments, bounded alias handling, duplicate keys, JSON strictness and deterministic syntax serialization before adoption. |
| `esbuild` 0.28.2 | Bundle browser/worker assets; MIT | Published 2026-08-08, Node >=18 development tool with platform-specific optional native binaries. Installation can download its matching binary; building is offline. No production runtime inclusion. |
| `typescript` 7.0.2 | Static checks; Apache-2.0 | Published 2026-07-08, maintained compiler with platform-specific packages. Development only; not runtime validation. Registry access at installation; offline checks. |
| `@playwright/test` 1.63.0 | Real browser and Electron integration tests; Apache-2.0 | Published 2026-09-04; transitives `playwright` and `playwright-core` at the same version, Apache-2.0. Explicit browser installation downloads binaries; tests use fixed local files and loopback serving, never live contract references. Development only. |
| `electron` 44.5.1 | Bundled Chromium/Node desktop host; MIT plus bundled third-party notices | Published 2026-09-30. Node types, `@electron/get` and zip extraction are development/packaging dependencies. Downloader uses explicit network acquisition during installation; application must not invoke it, auto-update, fetch references or send telemetry. Review complete locked transitive graph and bundled notices before distribution. |

These are evaluation candidates, not proof of suitability. `@apidevtools/swagger-parser` 13.1.0 was also inspected: it adds AJV, draft-04/schema packages and a reference parser. Its bundled OpenAPI schema coverage and reference acquisition defaults would need additional validation; the viewer does not need automatic reference retrieval or schema validation, so it is not added at this stage. This is not a claim that it is unsuitable for future validation work.

Primary references: [YAML library](https://eemeli.org/yaml/), [OpenAPI 3.2](https://spec.openapis.org/oas/v3.2.0.html), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Playwright browsers](https://playwright.dev/docs/browsers).

## Bounded adoption decision and dependency review

Adopt TypeScript, `yaml`, npm, esbuild and native DOM rendering for the viewer based on the checks below. No frontend framework is needed for this read-only interface. This is a product inspection module using an established parser, not a separately reusable parser project. The engine owns document interpretation and never imports platform APIs; the editor owns presentation and the explicit file-picker adapter. Both browser and Electron run the same compiled worker. A ten-second worker deadline keeps parsing off the UI thread; starting another inspection terminates its predecessor.

The complete lockfile was inspected after installation with lifecycle scripts disabled. Registry packages have integrity hashes and resolve to the npm registry. The only production library is `yaml` 2.9.1 (ISC), with no transitives. Development transitives are `@electron/get` 5.1.0, `debug` 4.4.3, `ms` 2.1.3, `env-paths` 3.0.0, `progress` 2.0.3, `@types/node` 24.19.1, `undici` 7.30.0 and `undici-types` 7.24.6 (MIT); `graceful-fs` 4.2.11 and `semver` 7.8.5 (ISC); `sumchecker` 3.0.1 (Apache-2.0); `@electron-internal/extract-zip` 1.0.5 (BSD-2-Clause); Playwright/core (Apache-2.0); esbuild platform binaries (MIT); TypeScript platform binaries (Apache-2.0). `@types/node` is also a direct development dependency. These permissive licenses are compatible with Apache-2.0 use with their notices retained; they do not change the product license. Some small utility transitives have older releases; keep them covered by lockfile and security review rather than assuming recent publication is proof of safety.

Electron's installer and Playwright browser downloads are explicit development steps; their downloader/extractor modules are not shipped in the application. esbuild's postinstall is unnecessary when npm installs its matching optional binary; documented setup disables lifecycle scripts. The built web directory carries the full yaml license. The desktop bundle preserves Electron's LICENSE and LICENSES.chromium.html and includes the product license and web notices. No dependency telemetry/update client is invoked by product code. Electron denies network requests, new windows, navigation and permissions; the renderer has sandbox/context isolation and no Node/preload/IPC privileges. The web CSP prevents connections, executable contract content and remote assets. Contract descriptions are plain text, including Markdown/HTML source.

`npm audit --json` reported zero known advisories for the locked dependency tree on 2026-10-02. This is a point-in-time check, not security certification. Keep Electron/Chromium/Node and tooling under regular maintainer review; the application never checks for updates automatically.

## Evidence (WSL Ubuntu 24.04, 2026-10-02)

Commands are recorded in [README.md](../../README.md#development-status). No native Windows or macOS build/test was run.

| Check | Observed result / limit |
| --- | --- |
| `npm run check` and `npm run build` | Passed; browser and worker bundle without platform APIs. |
| `npm test` | 27 passing cases. Versions 3.0.4, 3.1.2, 3.2.0 in JSON/YAML; semantic operation/parameter/security/reference behavior, comments, extensions, malformed input and safety bounds. |
| `npm run test:browser` | 15 passing cases across Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6. Seven fixed input sets per engine compare complete inspection results to Node. Upload/mapping, keyboard activation/focus, recursion/back navigation, honest unresolved-body status, hostile HTML as text and a 390px layout also pass. |
| `npm run test:desktop` | Shared Electron UI/worker result equals Node; renderer sandbox and absence of Node globals verified. |
| `npm run package:desktop`, then `SPECREFIT_TEST_PACKAGE=1 npm run test:desktop` | Linux x64 development distribution built; both desktop cases pass, including launch with no Node on PATH. Not a clean-machine or native multi-OS acceptance result. |
| Visual inspection | Welcome, operation, schema and narrow layouts rendered and inspected from real-browser screenshots; Electron screenshot inspected separately. Generated evidence remains under ignored `artifacts/`. |
| Source preservation | Decoded UTF-8 source text is retained without rewriting, unknown fields retained in generic trees. Original files are never modified; no binary roundtrip is claimed. YAML syntax-tree roundtrip retains the fixture's comments/extensions with stable serialization. No edit/move/bundle preservation claim. |

No generated contract output exists, so browser/Node/Electron parity here is inspection equivalence, not the roadmap's transformed-output byte equality. No product CLI or Maven experiment has been completed. No native support matrix, signed installer, release, hosted deployment, SonarQube thresholds or CI workflow is introduced by this slice.

## Implemented behavior and explicit limits

- Operations: tag groups, text/method/tag filtering, standard methods, OpenAPI 3.2 QUERY/additionalOperations, webhooks and callbacks. Path-level parameters combine with operation-level overrides by name/location; operation security overrides global security, including an empty array. Security alternatives are OR; schemes inside one alternative are AND. Media types, schemas, response headers/links, server values and every original operation field are inspectable. This is not a request execution client.
- References: local/relative documents and explicitly supplied HTTP(S) document URIs, JSON Pointer fragments including escaped/percent-encoded tokens, recursion without expansion, duplicate basenames, missing documents/targets and iterative supply. No basename guessing, implicit fetching or path-based filesystem reads. Duplicate canonical document identities are rejected. URI queries, credentials, non-HTTP(S) schemes and mixed OpenAPI version families are diagnosed rather than interpreted.
- Schemas: full generic field inspection and navigation, including composition/constraints, booleans, nullable/type fields, required properties and reference siblings; no example validation or schema flattening. Named anchors, `$id` resource scope, dynamic references and custom dialect evaluation remain unsupported and diagnosed. Do not resolve references under `$id` against the wrong document base. Discriminator mapping semantics, arbitrary vocabulary keywords and complete dialect validation are not evaluated. Additional fields remain accessible in Files/source even when no specialized view exists.
- Input: multiple files or folders, exact missing-location assignment, explicit entry selection. No ZIP import, reference fetching or persisted project/configuration mappings yet. UTF-8 file text only; originals are not rewritten or exported. A malformed/unsafe file is source-only while other interpretable files remain available. Duplicate keys, aliases, complex/non-string YAML mapping keys and integers outside JavaScript's exact integer range are rejected for interpretation; quote response status keys. Diagnostics identify document/pointer and source location when available; generic parse failures fall back to the start of the document.
- Safety bounds: 64 files, 2 MB each, 8 MB total, 100,000 value/traversal nodes, depth 80, callback nesting 20, and a ten-second worker timeout. These are conservative preview limits, not claims of exhaustive denial-of-service resistance. The viewer has no output persistence code, so source/config identity protection for future export still needs implementation and filesystem-link tests.
- Accessibility evidence covers native controls, focus indicators, keyboard selection and narrow layout; comprehensive screen-reader, zoom and accessibility acceptance remain open. Descriptions display as safe plain text. Application wording is English, following the existing website.

Next engineering work is broader dialect/reference conformance and native packaging acceptance, alongside the outstanding feasibility experiments. Any material product/architecture change remains a decision for the central chat. The preview can be reviewed and used within these limits; it must not be marketed as full OpenAPI conformance or a completed product release.
