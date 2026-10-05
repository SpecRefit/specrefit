# Product requirements

Status: agreed product requirements captured from the design discussion on 2026-10-02. These are requirements, not an inventory of implemented features. [ROADMAP.md](../../ROADMAP.md) sequences delivery without reducing the intended product functionality.

## Purpose and independence

SpecRefit lets developers understand supplied OpenAPI specifications and adapt them to their projects through explicit, repeatable rules. Users should not need to understand the raw YAML/JSON layout to inspect operations, requests, responses, schemas, references and security requirements.

SpecRefit is independent of Fabrikt and other generators. It produces ordinary adapted OpenAPI files for downstream consumers. No Fabrikt modification or shared parser project is required. Suitable existing libraries are welcome, subject to license, security, maintainability, offline and platform suitability.

## Interfaces and distribution

- The browser editor, desktop app and CLI have equivalent contract-processing capabilities and output semantics. Different input mechanisms are allowed where platforms impose access constraints.
- Browser processing happens entirely on the user's machine. There is no server that receives or processes contracts, and no reference-fetching proxy operated by SpecRefit.
- Desktop targets Windows, macOS and Linux. Provide installation packages and portable use without a mandatory installation step. Supported OS versions and architectures remain to be defined; enterprise execution policy is outside the application's control.
- Desktop and CLI include their runtime. Local processing requires no separately installed developer tool, account or internet access.
- A suitable browser is a prerequisite for the web editor. Maven and other build integrations naturally require their host environment but must not require a separately installed SpecRefit runtime.
- No telemetry or tracking. No automatic network requests at startup except the hosted playground's same-origin freshness check, explicitly requested on 2026-10-05 to prevent stale cached application code. Desktop updates are checked only on an explicit user action and can also be installed offline from a package. CLI and integrations use deliberately selected versions and do not silently upgrade.
- One coordinated product version identifies compatible components. The same version and fully specified inputs must produce identical generated files across interfaces. Plugins contain integration logic rather than alternative transformation implementations.

## OpenAPI and document preservation

- Support OpenAPI 3.0, 3.1 and 3.2. Exact specification patch versions and interpretation must be documented as implementation is introduced.
- Prepare to support future OpenAPI versions early. Experimental support must be labelled; declare stable support only after verification. Do not silently interpret a newer construct as an older version's construct.
- Preserve the input OpenAPI version by default. Conversion between specification versions is a separate potential capability, not an implicit part of transformation.
- Multiple input files are a first-class requirement, not something users must eliminate by pre-bundling.
- Preserve fields and extensions such as `x-...` unless a rule deliberately changes them. Unknown information must not be silently dropped by a typed model.
- Preserve YAML comments where they can remain reliably associated with content. Moving or editing a node should retain its comments where meaningful; removed nodes and ambiguous associations need explicit handling and loss diagnostics. Comment correctness cannot be inferred from preserving the text.
- Exact whitespace and original formatting are not required to remain unchanged. Standard JSON cannot preserve comments; report that limitation when applicable. Do not encode comments as invented contract fields.

## Inputs and references

- Supply a start document and all required referenced documents. Preserve original document locations and relative path structure; matching solely by basename is unsafe.
- The editor shows missing references, lets the user provide the corresponding files and discovers further missing references recursively after each addition.
- Selecting a local desktop contract must automatically supply its local relative reference files through the desktop adapter (owner clarification, 2026-10-05). The initial implementation limits automatic reads to the selected file's directory tree; references outside that scope remain explicit file selections. Browser input restrictions and optional network retrieval are separate concerns.
- Support project input through multiple files with structure, including directory and ZIP import. Users can explicitly map a missing reference location to a supplied document.
- Save reference-location-to-local-document mappings in the project configuration. Store project paths relative to the configuration where practical so projects can move between machines.
- Optional explicit external retrieval is desirable and belongs outside the processing engine. Desktop/CLI can fetch where authorized and technically possible. Browser fetching is subject to browser restrictions; when unavailable, users upload the documents instead.
- The user is responsible for supplying accessible resources and any needed authorization. SpecRefit is responsible for explaining what is missing and correctly resolving relationships among the supplied documents.
- A remote URL alone does not establish reproducibility: comparison and processing require fixed document content, including referenced documents.

## Configuration and rules

- `specrefit.yaml` is a default name, not a required name. Users may choose the path and filename.
- Support YAML and JSON configurations with equivalent semantics and validation.
- Configuration includes the start document, reference mappings, ordered rules, saved exceptions and output choices. Keep secrets out of configuration.
- Apply rules in explicitly stored order. The editor exposes and allows changing this order; every interface follows it. Ordering may legitimately make later rules depend on earlier results. Explain incompatible or conflicting choices instead of silently resolving ambiguity.
- A rule aimed at a specific missing target is an error by default; users can configure a warning per rule. Broad rules such as preferring JSON where it is available may legitimately leave nonmatching operations unchanged.
- Review-time exclusions are persisted as exceptions, never hidden one-run UI state. Recompute preview after a rule or exception changes.
- Direct contract edits must be reproducible transformations. Target document structure, not line numbers, and record the expected prior value or structure and intended result.
- Line movements do not invalidate an edit. Removed, renamed, ambiguous or incompatibly changed targets require diagnostics according to the rule policy. Recognize an already-applied result. Do not guess identity after an ambiguous file move or rename.

## Validation, preview and output

- Open and inspect imperfect input as far as possible. Distinguish warnings from errors that make a requested operation unreliable. Block export when a needed reference or other condition prevents trustworthy output; do not reject every imperfect contract wholesale.
- Diagnostics identify the location, cause, impact and possible remediation. Use consistent classification in the editor and CLI. A partial analysis is never presented as a complete valid export.
- Preview uses the actual engine result that will be written, not a parallel simulation. Provide a semantic report explaining what changed and which rule caused it, plus Git-style per-file text diffs with context and unified/side-by-side views. No Git repository is required.
- A CLI dry-run performs the same transformation and checks without writing generated output. Exact report-output options will be designed with the CLI.
- Output must never overwrite any input document, referenced input or active configuration. Existing non-input output files can be replaced. Guard actual file identity and aliases, not only spelling of paths. Avoid partially replacing an output set on validation failure.
- Save a single output document directly. For multiple documents, the browser offers a ZIP preserving their folder structure; the standalone desktop app writes the files directly into the selected output folder (clarified by the owner on 2026-10-03). Report incomplete multi-file saves explicitly.
- Offer both retained document structure and bundling into a single specification. Bundling may retain internal references; it must not infinitely expand recursive schemas.
- Users can choose YAML or JSON output independently of input format. Default multi-file output preserves each source document's format. Rewrite reference paths when output filenames change.

## Comparing contract updates

Compare old source contract X and new source contract Y using the same configuration and engine version. Include the complete referenced-document content for each input set. This feature is for changes in the supplied contract, not initially for comparing engine or rule versions.

Provide three connected views: source changes, changes between transformed outputs and a report of rules/exceptions that still apply, are already satisfied or require attention. Explain why a source change does not appear in transformed output when a rule removes or normalizes it.

If processing Y blocks, show available analysis and the blocking reasons without treating partial output as a valid new contract. Both editor and CLI expose the feature. The CLI provides human-readable and machine-readable JSON reporting for build automation.

## Quality and product experience

For the hosted playground specifically, show the published release version when its source is that release. After newer commits, visibly identify a development build with the commit hash and release baseline. Automatically rebuild the current main playground after stable GitHub release publication, without requiring another commit (owner request, 2026-10-05). Resolve release information during the build. The owner subsequently requested that every new playground page load obtain the latest deployed application without a hard refresh: check only the same-origin build identity before mounting, refresh stale HTML and use matching content-addressed assets. Do not silently start stale code if that check fails; show an actionable retry. Do not poll, send contract data or interrupt an already open editing session. Desktop artifact versioning and offline operation remain unchanged.

The owner authorized an initial read-only viewer on 2026-10-02: grouped/searchable operations, complete operation inspection, schema/reference navigation including recursive models, multi-file input, targeted missing-reference supply, and actionable diagnostics with partial inspection. The [viewer scope](../architecture/viewer.md) records the agreed experience and evidence. Editing, transformation, comparison and export remain required later. Electron is the agreed desktop direction with a shared browser/desktop editor and processing implementation; native compatibility is subject to verification.

Safety, useful diagnostics, maintainability and usable workflows are product requirements. Shared code alone is not proof of parity: compare actual outputs across runtimes. Verify distributions on clean supported operating systems without developer tools. Include keyboard accessibility and meaningful errors in UI acceptance.

The editor follows the system light/dark appearance preference on opening, including changes until the user switches manually (owner request, 2026-10-02). Match the website's simple Theme ◐ light/dark toggle rather than a three-way selection menu. The manual choice lasts for the current page session; reopening follows the system again. Controls, diagnostics and contract previews must remain readable in both themes.

The first end-to-end implementation scenario is inspecting a multi-file contract, preferring JSON where offered, previewing changes, saving configuration and exporting or repeating through the CLI. This is development sequencing, not permission to remove other agreed requirements. Authentication preference transformations, model merging and reference cleanup were exploratory ideas; they need separate semantic design before becoming transformation commitments. Listing security requirements for inspection is within scope.

## Explicit media selection and schema extraction (2026-10-02)

Contract-wide media preference was clarified on 2026-10-05. Offer all exact request/response media types actually present in the supplied specification; JSON is an example, not a fixed default or special category. Users can select one or several preferences. A request or response offering just one type always retains it. When several are offered, retain all selected types that match; when none match, retain the entire original content map. Multipart starts selected and is removed only by explicit deselection where another selected type is offered. Include shared definitions and external reference documents in the explicit whole-contract scope. Initially all offered types are selected to avoid silently dropping capabilities. This setting changes advertised media options, not the JSON/YAML format of output files.

The user selects one or several advertised media types to retain; JSON variants are not automatically grouped. Inline schemas can be extracted into named shared components. Propose a deterministic name from operation context, allow user editing, and persist the chosen name and target precondition in the rule. Reapplying an already completed extraction must be a no-op; a conflicting existing name must not be overwritten or silently merged. Automatic duplicate-model merging remains separate design work. Provide a general output option to bundle all external references into one document, independent of these transformations. See [implemented preview and limits](../architecture/transformations.md).
