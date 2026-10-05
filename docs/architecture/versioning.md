# Build versions and release channels

Accepted direction, 2026-10-02: a Git tag is the source of the release version. Browser, desktop and the future CLI use the same product version. GitHub Releases carries development downloads from main; Maven Central remains the planned channel for the future Maven integration. The first stable release is now authorized; signing and registry credentials remain future work. See [development builds](development-builds.md) for the owner's subsequently authorized automatic publication.

## Implemented version derivation

`scripts/version.mjs` runs only in build tooling, outside the shared engine. A clean checkout at a tag such as `v0.1.0` produces `0.1.0`; `v0.2.0-beta.1` produces `0.2.0-beta.1`. Tags must contain a valid [SemVer 2.0](https://semver.org/) version after the `v` prefix. Annotated and lightweight tags are supported; annotated tags are preferred for intentional releases. Never move or reuse a published release tag.

An untagged commit produces `0.0.0-dev+g<12-character-commit-id>`. Local tracked changes or untracked files add `.dirty`. This deliberately does not guess the next release number. Development builds are for identification, not release ordering; SemVer build metadata does not affect precedence. The complete commit ID and dirty flag are also recorded. Pull-request builds always use a development version, even if their commit has a release tag.

Only tags on the checked-out commit count. A tag on an ancestor is not the version of newer source. Multiple matching release tags on a local checkout cause an error instead of choosing arbitrarily. A GitHub tag build selects its triggering tag explicitly and rejects invalid tags, a different checked-out commit or local changes. A locally modified tagged checkout is labeled as development. Build from a Git clone with tags fetched; a source archive without Git metadata is unsupported. There is no time-dependent version component or product network lookup.

The root `package.json` and lockfile retain `0.0.0-dev` as a development placeholder. Release builds do not edit or commit these files. The build embeds the derived version into the browser assets and writes `dist/web/version.json`. The header displays that version; its tooltip includes the commit identity. Desktop packaging copies the same metadata and writes the derived version to its generated application manifest. Packaging rejects metadata from a different version/commit/dirty state and asks for a rebuild. This does not fingerprint every edit within an already-dirty working tree; rebuild after changing source. Native installer version conventions remain part of future packaging work.

## Tag validation and future publication

The Build workflow runs for PRs to `main`, pushes to `main` and pushed `v*` tags. It fetches full history/tags and performs the documented checks. Invalid release tags fail the build. Main builds explicitly select the development channel, ignoring stable tags for version derivation, and a separate main-only job publishes verified development downloads. The build job remains read-only. SemVer tag builds and PRs do not publish releases; Maven publication is not implemented.

Native package resource fields use the numeric major/minor/patch core; development packages therefore use 0.0.0 in those OS fields. The application package, app.getVersion(), UI and download manifest retain the complete Git-derived version. Native PR/main builds must all pass the required Build gate; tag runs now also require all native checks and verified archive assembly. See [native packaging](desktop-packaging.md).

When distributable packages are ready, the intended release process is: merge a reviewed PR, choose the SemVer release number, create an annotated tag on the intended clean `main` commit, then run the tag's checks and build the matching packages. The owner requested 0.1.0 on 2026-10-03; its [release procedure](stable-releases.md) uses verified tag downloads uploaded to a draft before manual publication as Latest. Maven groupId is dev.specrefit; the owner confirmed Maven Central namespace verification on 2026-10-03. Publication still needs artifact IDs, authentication/signing and version-mapping design when the Maven integration exists. Do not infer that a successful tag build proves native platform acceptance or authorizes automatic publication today.

## Hosted playground presentation

On `play.specrefit.dev`, separate build-time metadata identifies the nearest reachable published stable release. A clean checkout at that release displays its version; subsequent commits display a Development build banner with the baseline version, commit count and a linked 12-character commit hash. With no reachable stable release, the banner says so. Dirty and PR builds remain development. Prerelease, invalid, unrelated and unpublished tags cannot establish a hosted stable baseline. CI supplies the published stable tag list from GitHub; local builds without that input use local tags. The browser performs no release lookup or update polling.

`scripts/playground-version.mjs` writes `dist/web/playground-version.json` and embeds the same metadata in the application. This presentation does not change artifact versions, native package metadata or the shared engine. Desktop and locally served assets retain their existing version display. Publishing a stable GitHub release automatically dispatches a fresh Build on main; only a successful complete Build may deploy the refreshed playground. This refresh does not republish development downloads or roll main back to an older release. See [playground publication](playground.md).

The version fixture suite also covers release ancestry, distance, published-tag filtering and release-trigger workflow guards. Browser tests cover release/development/no-release presentation, host scoping and narrow light/dark layouts. A real release-publication event can only be verified after the workflow is merged and a stable release is published.

## Verification

`npm run test:version` creates isolated temporary Git fixture repositories under ignored `.cache` and checks stable/prerelease tags, commit identity, dirty and untracked changes, PR versions, invalid/mismatched tags, ambiguity, stale package metadata and missing Git metadata. It never creates release tags in the product repository. Existing browser and packaged Electron tests check their displayed/runtime version against the generated metadata. On the owner's workstation all checks run in WSL.
