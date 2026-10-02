# External-reference bundling preview

The owner authorized the general bundling output option after the first two transformations. It is implemented in the shared engine and the browser/Electron preview, independently of the rule list. Reviewed bundles can now be downloaded or saved through the [export workflow](export.md). CLI execution remains future work.

## Workflow and configuration

Open **Rules and preview → Output → Bundle external references into one file**, choose YAML or JSON, then run **Preview these rules**. An empty rule list is valid. The preview contains the exact resulting file, with differences against the entry document. Output settings are saved in the same experimental version 1 rules JSON. Changing settings, input or rules invalidates the preview. Original files are never written.

The optional configuration field is `output: { bundle: true, format: "yaml" }` (or `"json"`). Omitted output settings preserve the previous multi-file behavior. With `bundle: false`, format is inactive and each document retains its source format. YAML is initially selected in the UI to retain comments; both choices are explicit and persisted. Bundling runs after the ordered transformations, never as a rule. The logical result is named `specrefit-bundled.yaml` or `specrefit-bundled.json` beside the entry URI. This is an in-memory output identity, not a filesystem write or source-protection implementation.

## Reference relocation

`packages/engine/bundle.ts` consumes validated inspection and uses the existing yaml syntax tree. No dependency, filesystem API or network capability was added. All resources must be supplied through existing file import/mappings.

The engine copies required external definitions to the appropriate component map, including schemas, responses, parameters, headers, bodies, examples, links, security schemes and callbacks. OpenAPI 3.1/3.2 path items use `components.pathItems`; 3.0 path items use the ordinary extension `x-specrefit-bundled`, referenced with standard JSON Pointers. OpenAPI 3.2 media references use `components.mediaTypes`. Encoding headers are included in reference discovery. This follows the [OpenAPI structural reference model](https://spec.openapis.org/oas/v3.1.2.html#structural-interoperability); consumers need ordinary JSON Pointer resolution, no SpecRefit runtime.

Targets are ordered by canonical document URI and JSON Pointer using ordinal comparison, independent of upload order, locale or OS. The last pointer segment or document stem suggests a component name. Unsafe name characters become underscores; occupied names get deterministic `_2`, `_3`, etc. Existing components are never overwritten or merged. A target referenced several times is copied once. Overlapping targets share their outermost copied definition. Original entry components and unknown fields remain intact; unrelated content from external documents is not imported. External definitions keep unknown fields within their copied subtree.

Every recognized reference is rewritten to an internal fragment, including references back to the entry, between external documents, and into copied subtrees. Pointer escaping and URI percent encoding are handled separately. Self and mutual recursion stay references. Reference siblings are retained rather than flattened. `$ref` strings inside examples, defaults, enum values or extensions remain ordinary data. Unrecognized reference positions outside such data block bundling instead of silently leaving unresolved dependencies.

The serialized result is inspected again using only the single output file. Diagnostics or non-local recognized references block the result. Repeating a bundle with the same supplied inputs gives identical bytes; bundling the resulting file again also gives identical bytes in the tested formats. Replaying source-targeted transformation rules against a renamed bundled output is not promised: those rules still target the original input locations and preconditions.

## Preservation and boundaries

YAML node and mapping-key comments accompany imported definitions; comments inside retained nodes stay there. Comments outside a selected definition are not guessed to belong to it, and the preview warns about that boundary. JSON output warns that YAML comments cannot be retained. YAML uses a fixed serializer width; JSON uses two spaces and a final LF. Exact source formatting is not promised.

Existing inspection limitations still block transformation, including missing inputs, schema `$id`, custom dialects, dynamic references and unsupported anchors. Bundling additionally blocks discriminator mappings/names, named schema anchors, `operationRef` links, ambiguous object types, moved relative server/example/documentation/authentication URLs, and imported OpenAPI operations with document-level server/security context. These require semantic relocation beyond ordinary `$ref` rewriting. Resolve the reported ambiguity or retain multiple files; no partial bundle is returned. Relative references embedded in human-readable descriptions and arbitrary extension data are preserved as text, not interpreted or fetched. Bundling does not download external examples, documentation or server content.

The existing input/output inspection limits apply, with at most 2048 distinct imported definitions and the editor's ten-second worker timeout. This remains bounded preview support, not complete OpenAPI validation or exhaustive resource-exhaustion protection. Native multi-OS acceptance and packaged CLI parity remain open.

## Verification

`npm test` includes bundling cases for three version families and both formats, recursive and overlapping references, duplicate basenames, collisions with existing names, supplied external URI mappings, back-references, escaped fragments, boolean schemas, comment placement, extension/example data, missing inputs, unsupported constructs, transformation composition, deterministic upload order and byte-idempotent rebundling.

`npm run test:browser` compares actual worker results with Node and exercises the no-rules bundling control, saved output settings, missing-input blocking, keyboard use and stale-preview invalidation in Chromium, Firefox and WebKit. `npm run test:desktop` compares both bundle formats through the real Electron worker with Node. The browser suite also checks system appearance at startup, live changes without losing the preview, the website-style Theme ◐ keyboard toggle, session overrides and returning to system appearance on reload.

Local WSL verification on 2026-10-02: type check/build, 61 engine cases, 10 version cases, 12 publication cases, 36 browser cases and both Electron cases passed, including runtime-bundled Linux startup. The dark-theme screenshot was inspected. Native Windows/macOS acceptance remains unverified. The PR Build gate repeats the suite against the committed source.
