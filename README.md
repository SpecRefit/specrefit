# SpecRefit

SpecRefit is a planned local-first workspace for inspecting, validating and adapting OpenAPI contracts through reproducible rules. The same processing engine will serve a browser editor, a desktop application, a standalone CLI and build integrations.

**Status: design and repository foundation. No application, engine, plugin or downloadable release exists yet.** This repository currently records the agreed requirements and development plan; it does not claim that any planned feature works.

## Start here

- [AGENTS.md](AGENTS.md): instructions for contributors and coding agents, including testing and safety requirements.
- [Product requirements](docs/requirements/product.md): the agreed product behavior and scope.
- [Architecture](docs/architecture/overview.md): module boundaries, proposed technology and unresolved decisions.
- [Configuration and execution](docs/architecture/configuration-and-execution.md): rules, references, deterministic output and contract comparisons.
- [ROADMAP.md](ROADMAP.md): sequencing, acceptance criteria and current next steps.
- [Decisions](docs/architecture/decisions.md): accepted choices, provisional proposals and questions still requiring a decision.

Read these documents before implementing features. They are intended to make a fresh clone sufficient to resume development without access to the original design conversation.

## Intended workflow

1. Supply an OpenAPI contract and its referenced documents.
2. Inspect operations, inputs, outputs, schemas and diagnostics.
3. Configure transformations and exceptions; inspect an explanatory change report and file diffs.
4. Save the configuration as YAML or JSON under a name of your choice.
5. Write the adapted contract to separate output files, or bundle it into one specification.
6. Reapply the same configuration through the editor, CLI or a build integration.
7. Compare successive source contract versions after applying the same rules.

Source documents remain protected. SpecRefit outputs ordinary OpenAPI documents that Fabrikt or another downstream tool can consume without knowing SpecRefit was involved.

## Repositories and identity

- Product: [SpecRefit/specrefit](https://github.com/SpecRefit/specrefit).
- Website: [SpecRefit/specrefit.github.io](https://github.com/SpecRefit/specrefit.github.io), published at [specrefit.dev](https://specrefit.dev).
- Planned optional browser editor address: `play.specrefit.dev`; no editor is deployed there yet.
- Intended Maven group: `io.github.specrefit`; publishing infrastructure and artifact coordinates are not set up by this repository.

The website is independently maintained. Product modules belong together in this repository and are intended to be released in coordinated versions.

## Development status

There are no build, test or installation commands yet. Do not infer working commands or install a toolchain from this README. The next task is the bounded technical feasibility work in [ROADMAP.md](ROADMAP.md), followed by a tested implementation skeleton. Update this section with verified commands when that skeleton exists.

No project license has been selected yet. Public repository visibility does not grant an open-source license. Resolve this before distributing releases or presenting the project as licensed open source.
