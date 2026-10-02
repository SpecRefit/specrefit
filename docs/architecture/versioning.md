# Build versions and release channels

Accepted direction, 2026-10-02: a Git tag is the source of the release version. Browser, desktop and the future CLI use the same product version. Planned distribution channels are GitHub Releases for desktop/CLI downloads and Maven Central for the future Maven integration. Publishing, signing and registry credentials are not implemented by the versioning change.

## Implemented version derivation

`scripts/version.mjs` runs only in build tooling, outside the shared engine. A clean checkout at a tag such as `v0.1.0` produces `0.1.0`; `v0.2.0-beta.1` produces `0.2.0-beta.1`. Tags must contain a valid [SemVer 2.0](https://semver.org/) version after the `v` prefix. Annotated and lightweight tags are supported; annotated tags are preferred for intentional releases. Never move or reuse a published release tag.

An untagged commit produces `0.0.0-dev+g<12-character-commit-id>`. Local tracked changes or untracked files add `.dirty`. This deliberately does not guess the next release number. Development builds are for identification, not release ordering; SemVer build metadata does not affect precedence. The complete commit ID and dirty flag are also recorded. Pull-request builds always use a development version, even if their commit has a release tag.

Only tags on the checked-out commit count. A tag on an ancestor is not the version of newer source. Multiple matching release tags on a local checkout cause an error instead of choosing arbitrarily. A GitHub tag build selects its triggering tag explicitly and rejects invalid tags, a different checked-out commit or local changes. A locally modified tagged checkout is labeled as development. Build from a Git clone with tags fetched; a source archive without Git metadata is unsupported. There is no time-dependent version component or product network lookup.

The root `package.json` and lockfile retain `0.0.0-dev` as a development placeholder. Release builds do not edit or commit these files. The build embeds the derived version into the browser assets and writes `dist/web/version.json`. The header displays that version; its tooltip includes the commit identity. Desktop packaging copies the same metadata and writes the derived version to its generated application manifest. Packaging rejects metadata from a different version/commit/dirty state and asks for a rebuild. This does not fingerprint every edit within an already-dirty working tree; rebuild after changing source. Native installer version conventions remain part of future packaging work.

## Tag validation and future publication

The Build workflow runs for PRs to `main`, pushes to `main` and pushed `v*` tags. It fetches full history/tags, performs a clean locked dependency installation, type checks, engine tests, versioning tests and the viewer build. Invalid release tags fail the build. The job has no release-upload or package-publishing permission and does not publish a GitHub Release or Maven artifact.

When distributable packages are ready, the intended release process is: merge a reviewed PR, choose the SemVer release number, create an annotated tag on the intended clean `main` commit, then run the tag's checks and build the matching packages. A future publication workflow can attach verified desktop/CLI artifacts to GitHub Releases. Maven Central publication will need its own namespace, authentication/signing and version-mapping design when the Maven integration exists. Do not infer that a successful tag build proves native platform acceptance or authorizes automatic publication today.

## Verification

`npm run test:version` creates isolated temporary Git fixture repositories under ignored `.cache` and checks stable/prerelease tags, commit identity, dirty and untracked changes, PR versions, invalid/mismatched tags, ambiguity, stale package metadata and missing Git metadata. It never creates release tags in the product repository. Existing browser and packaged Electron tests check their displayed/runtime version against the generated metadata. On the owner's workstation all checks run in WSL.
