# Architecture direction

Status: agreed boundaries with a bounded read-only viewer implementation. See [viewer evidence](viewer.md) for selected dependencies, verified runtime behavior and remaining feasibility work. The broader proposed module layout is not an inventory of delivered modules.

## Repository boundary

The product uses one repository because engine, configuration, editor and integrations must evolve together and demonstrate identical output in coordinated versions. Separate responsibilities justify modules; they do not currently justify separate repositories or release coordination overhead. The existing website repository remains separate because its content changes do not require a product release.

## Proposed layout

```text
apps/
  web/                 Browser entry point and browser input/output integration
  desktop/             Desktop packaging and narrow privileged platform boundary
  cli/                 Arguments, input acquisition, reports and exit status
packages/
  engine/              Contract model, rule execution, semantic validation
  config/              Configuration parsing, validation and version handling
  document-io/         In-memory document parsing/serialization and comment retention
  comparison/          Source and transformed-output comparisons and explanations
  editor/              Shared visual workspace and review components
  platform-io/         Platform-specific acquisition and safe persistence adapters
integrations/
  maven/               Thin host integration with the versioned CLI
tests/
  fixtures/            Source documents, configurations and reviewed expected output
  conformance/         Cross-version, cross-runtime and output-equivalence checks
  end-to-end/          User and build workflows
docs/
  architecture/        Boundaries and decisions
  requirements/        Agreed product behavior
```

Currently `packages/engine` owns in-memory document parsing, references, diagnostics and operation inspection; `packages/editor` owns the shared DOM interface. `apps/web` supplies the page and bounded worker, and `apps/desktop` loads the same built assets in sandboxed Electron. The browser file picker is shared by both wrappers. No privileged filesystem bridge is needed for this read-only slice. The remaining modules above do not exist yet. Create modules as code gives them a reason to exist; do not create placeholder packages solely to match the diagram. Logical modules need not all become independently published packages.

## Dependency direction

Platform adapters gather a document set; configuration parsing yields validated settings; the engine produces transformed documents, diagnostics and a trace of changes. In-memory serialization creates the actual output bytes used by preview, comparisons and export. Platform adapters alone persist those bytes.

`document-io` means document bytes and syntax, not OS file access. It must work in a browser without Node or Electron APIs. `platform-io` isolates access to disk, uploads, archives and explicitly requested retrieval; its browser path must not pull privileged desktop code into the web bundle.

The editor renders results and changes configuration; it never implements transformation rules. The CLI is another entry point to the same behavior. Comparison runs the same processing pipeline for both input sets rather than creating a second transformation implementation. Build integrations invoke the versioned CLI and translate host options and diagnostics without changing contract semantics.

## Technology proposal and feasibility gate

The viewer uses TypeScript, npm with a committed lockfile, `yaml` for syntax preservation and parsing, native DOM rendering, esbuild, Node's test runner and Playwright. Electron is the accepted desktop direction; its Linux bundled-runtime experiment has evidence. A complete OpenAPI/JSON Schema validator and a Node.js-based product CLI packaging mechanism have not been selected. See [the bounded adoption decision](viewer.md); this does not close the broader feasibility gate.

The proposal favors one implementation usable in browser and desktop/CLI. The costs include desktop distribution size, regular Electron/Chromium/Node security maintenance and runtime packaging for each supported platform. Native CLI packaging and offline integration distribution must be demonstrated rather than assumed.

Before settling the stack, prove browser-compatible parsing and transformation of OpenAPI 3.0/3.1/3.2, reference cycles, multi-file structure, unknown-field preservation, YAML comments and stable byte serialization. Evaluate existing libraries against those requirements and document gaps. Change the proposed technology if evidence warrants it, with a recorded decision and user discussion where the architecture materially changes.

## Security and trust boundaries

Contracts, configurations and imported archives are untrusted data. Treat descriptions and examples as data, never executable page content. Separate intended project access from arbitrary path traversal. Define resource limits and cancellation for parsing, archive expansion, reference traversal and transformations.

Desktop should use sandboxing, context isolation and a narrow validated bridge to privileged functionality. Do not expose generic filesystem access, process execution or unrestricted IPC to contract-rendering code. Browser processing has no privileged backend fallback.

Optional retrieval needs explicit allowed locations, redirect and credential-handling policies. Internal reference hosts are legitimate: a blanket ban on private-network resources would contradict the product requirements. User intent and controlled scope must distinguish intentional internal access from unintended fetching. Store credentials separately from the project configuration; the exact mechanism remains undecided.

Configuration migrations, update verification, package signing, supported OS/CPU versions and release artifact integrity need designs before releases. SonarQube, dependency/license review, secret checks and behavioral security tests should complement one another. A GitHub Actions PR build gate runs type checks, engine tests and the viewer build; broader CI coverage and those services remain open.

The first transformation preview now also lives in packages/engine/transform.ts, with the existing worker and editor exposing it. It has no platform I/O. See [exact behavior, conformance evidence and remaining boundaries](transformations.md); no second UI transformation implementation or new dependency was added.
