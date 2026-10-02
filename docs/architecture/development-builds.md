# Development downloads from main

The owner authorized automatic development builds after merges to `main` on 2026-10-02. These are development downloads, not stable product releases. The newest complete set is available through GitHub Releases' `/releases/latest` address. Maven Central publication remains future work.

## CI dependency review

Before adding the workflow steps, GitHub's maintained `actions/upload-artifact` v4 and `actions/download-artifact` v5 were reviewed through their official repository metadata (MIT; active repositories). They are pinned to full commit hashes. Their bundled dependencies run only on CI runners and transfer build archives to/from GitHub Actions storage. They are not product runtime dependencies and add no product telemetry. Upload retention is seven days; published GitHub Release assets are separate and remain available. Existing checkout/setup-node dependencies retain their earlier review. The publishing script uses Node's built-in HTTP and hashing APIs, without another package dependency.

## Build and publication

The existing Build workflow runs on each push to `main` (including squash merges), PRs to `main` and `v*` tags. Main builds explicitly select `SPECREFIT_BUILD_CHANNEL=development`, so even a commit with a stable version tag produces a development version for this channel. PRs exercise packaging and archiving without publication rights. SemVer tag builds retain their existing version validation and do not publish development downloads.

Build runs type checks, engine/version/publication tests, builds the browser assets, installs the Electron runtime and required Linux runner libraries, packages desktop, and tests both the development Electron app and the runtime-inclusive Linux package. It then creates `specrefit-web.tar.gz`, `specrefit-desktop-linux-x64.tar.gz`, `manifest.json` and `SHA256SUMS`. The desktop output directory is recreated to exclude stale files. Archives preserve executable modes and normalize ordering, owners and timestamps. Release builds require clean version metadata matching the workflow commit; local dirty archives are useful for inspection but cannot be published.

Only successful main builds hand archives to a separate publication job using GitHub Actions artifact storage. The build job has read-only repository permissions; only the main-only publication job has contents-write permission. Publication verifies the complete file set, commit identity, sizes and local SHA-256 hashes before contacting GitHub. Every package listed in the generated manifest is uploaded, with the manifest and checksum list. Future implemented packages join the same handoff directory and inventory; a missing package that is required by a future build job must fail that job, not silently disappear from the inventory.

Each build uses its own `develop-<full-commit-id>` tag and a clearly named **Development build** release. These tags are outside the `v*` stable-version namespace. Assets are uploaded to a draft, then GitHub's uploaded sizes and digests are checked before publication with `make_latest=true`. Published assets are not overwritten on reruns: their digests must match. Interrupted drafts can resume. Failed uploads/checks leave the previous latest untouched. Each main push gets its own workflow run; newer merges do not cancel it. Publication jobs are serialized with GitHub concurrency queueing (`queue: max`, up to 100 pending jobs). Before promoting Latest, the publisher compares commit ancestry with the existing development download. An older build finishing later still gets its own published downloads but cannot replace a newer Latest. Diverged history fails safely. Failed builds are not published.

GitHub [does not allow drafts or prereleases to be Latest](https://docs.github.com/en/rest/releases/releases#create-a-release). The download container therefore uses `prerelease=false`, while the artifact version remains `0.0.0-dev+g<commit>` and the title/body explicitly say development, not stable. This implements the owner's requested `/releases/latest` behavior. A future stable publication workflow must explicitly coordinate this Latest policy rather than assuming Latest means stable.

The permanent entry point is [latest downloads](https://github.com/SpecRefit/specrefit/releases/latest). Once the first main publication succeeds, fixed filenames also support `/releases/latest/download/specrefit-web.tar.gz` and `/releases/latest/download/specrefit-desktop-linux-x64.tar.gz`. No development release is published from the implementation PR before review/merge. Main builds after merging this workflow activate publication automatically.

## Current artifacts and limits

- Browser archive: extract `web/` and serve its contents through a static HTTP server. Contract processing remains local to the browser; this archive is not a hosted deployment.
- Linux x64 desktop archive: extract and run `specrefit-linux-x64/electron`. It includes Electron/Node and license notices, but still needs Linux graphical/system libraries. CI runs on Ubuntu 24.04; this is an experimental development distribution, not clean-machine or broad native acceptance.
- Windows/macOS desktop, CLI and Maven packages do not yet exist. There are no placeholder downloads or Maven Central uploads. Each real package will need its platform build and verification before it joins the manifest.

Versioning and downloads do not add product telemetry or automatic updates. Browser tests remain local checks for now. Stable releases, signing, native installers and Maven Central remain separate future work.

## Verification

`npm run test:development` checks manifest completeness, checksum integrity, missing/extra/wrong-commit/dirty inputs, traversal rejection, all-assets-before-latest ordering, failed uploads, superseded commits, published reruns and draft recovery using a controlled in-memory GitHub service. No test creates a public release. `npm run archive:development` verifies browser/desktop version agreement and creates the actual archives. WSL runs validate real packaging and Electron startup; the PR's required Build job verifies the same packaging path on a GitHub runner. Live publication is first exercised after the owner merges to main and must be checked in that workflow run before claiming download availability.
