# Configuration and execution contract

This document records behavioral constraints. It deliberately does not invent a public configuration schema or CLI syntax before the implementation design has been reviewed.

## Configuration

YAML and JSON represent the same validated configuration model. Users select any filename and location; `specrefit.yaml` is a convenience default. Discovery precedence, extension-independent format detection and CLI argument names are open decisions.

The configuration captures the start document, project-relative document mappings, rules in explicit order, per-rule missing-target policy, saved exceptions and output settings. Define an explicit configuration schema version before the first usable release; keep that concept distinct from the product version and the OpenAPI document version. Reject unsupported configuration semantics clearly rather than guessing. Migrations must not silently change behavior.

Never include credentials. Saving editor decisions must leave enough information for the CLI to reproduce them without UI state. Edits to configuration itself are explicit user actions, not generated contract output.

## Input identity and references

Represent an input as document content plus stable logical location, with a designated entry document and a mapping between external locations and supplied documents. Preserve relative reference bases and fragment semantics. A physical local path is an adapter concern; the same logical input set must be representable through browser uploads.

Traversal discovers unresolved references until all needed documents are available or diagnostics block the requested operation. Handle cycles without unbounded expansion and distinguish documents with equal basenames. Exact canonicalization and identity algorithms are design work, not specified implementations.

Retrieval occurs before or around input acquisition, never as a hidden engine side effect. Determinism is conditional on identical complete input bytes, not identical URLs. Record content fingerprints and an input inventory in execution metadata when that mechanism is designed, without leaking secrets or turning environment paths into contract output.

## Transformations

A reproducible edit needs a structural target, an expected precondition and an intended change. Line numbers are diagnostic hints only. Unambiguous targets survive line movement; ambiguous renames or moves require user intervention. An already-satisfied postcondition is reported as such. Exceptions and missing-target policy are serialized with the rule.

Rules execute in stored order. Trace each change to its rule and document location. Do not flag every sequential edit as a conflict; distinguish intentional composition from incompatible requirements. Exact conflict classification remains to be designed and tested.

The first two transformations now preview explicit media-type selection and inline schema extraction. The owner requires selecting one or several advertised media keys, deterministic suggested model names with saved overrides, and idempotent replay. Exact matching and conservative handling of shared references are implemented within the [documented preview boundaries](transformations.md). Complete project configuration and broad-rule exceptions remain open. Reviewed-output export is implemented within the [documented persistence boundaries](export.md). General bundling previews are implemented within the [documented boundaries](bundling.md). Do not silently invent content or claim that a server supports an authentication or media type it does not advertise.

## Deterministic output and safe persistence

For the same engine version, complete logical input set, configuration and output settings, generated file paths and bytes must be identical in browser, desktop and CLI on all supported platforms. Fix ordering, newline conventions, encoding, reference rewriting and serializer behavior centrally. Do not inject current time, machine paths or locale-dependent values into generated contracts.

Create the in-memory result once for a given input/configuration state. Preview its actual bytes and change trace; write the reviewed result rather than recomputing with potentially changed inputs. If inputs change, invalidate the preview and recompute.

Multi-file output preserves document organization and source format by default. Explicit format selection may change names and references; detect output name collisions. Bundled output preserves schema semantics and recursive relationships, with internal references as needed. The preview exposes an explicit YAML/JSON bundle choice, initially selecting YAML for comment retention. The selected format is persisted with the rules.

Before writes, verify that no destination aliases an input document or active configuration. Existing non-source outputs may be replaced. Plan and validate the complete output set before persistence, then implement failure-safe replacement appropriate to the platform. Atomic replacement of several files is not universally available; define recovery behavior and do not promise cross-filesystem transactions. Browser export has different persistence mechanisms but the same source-protection and output semantics.

## Diagnostics and comparisons

Diagnostic records need a stable code, severity, document location, explanation, effect on processing and remediation where possible. Rule-related records identify the rule. Malformed or incomplete input may allow partial inspection but not a misleading successful export. Define CLI exit status and JSON report schemas before integrations rely on them.

An update comparison runs contract X and contract Y, each with its own complete reference set, through the same engine version and configuration. Show source differences, transformed differences and rule applicability changes. Semantic reports explain changes and their causes; text diffs show precise output. If either side blocks, mark its output unavailable or incomplete explicitly.

Comparing different engine/configuration versions and storing a general historical run database are not part of the agreed initial comparison scope. Do not build those incidentally.

## Implemented preview rule model

The initial version 1 rule list and exact matching/extraction behavior are documented in [transformations.md](transformations.md). This bounded in-memory preview model is implemented separately from the still-open complete project configuration and CLI syntax. It includes ordered explicit targets, expected values/types, saved extraction names and missing-target policy. Contract-wide external-reference bundling is implemented as an output option after the rules; see [scope and limitations](bundling.md).
