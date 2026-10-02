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

## Evidence

Pending implementation. Do not interpret the scope or dependency table as implemented support.
