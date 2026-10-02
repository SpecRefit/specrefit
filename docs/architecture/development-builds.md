# Development previews from main

Successful main builds update one rolling **Development preview**, a GitHub prerelease at [the fixed preview address](https://github.com/SpecRefit/specrefit/releases/tag/development). The owner changed the earlier per-commit/Latest policy on 2026-10-02: keep only the current preview and reserve GitHub Latest for stable releases. Maven Central remains future work.

## Build and publication

The Build workflow runs on main pushes, PRs and version tags. Main builds force the development channel; PRs and version tags do not publish previews. The required job checks types, engine/version/publication behavior, browser parity in Chromium/Firefox/WebKit and packaged Electron startup. Archives contain all currently implemented packages, a manifest and SHA-256 checksums. Clean build metadata must match the workflow commit.

The publication job has contents-write permission and is serialized. Before mutation it verifies local filenames, sizes, hashes and commit identity. It only operates on the dedicated `development` prerelease and tag; it never reads or changes stable Latest. Older builds cannot replace a newer preview, including a newer interrupted draft. Diverged history, immutable releases and a non-prerelease occupying the preview tag fail before mutation.

There is one release object. During replacement it becomes a draft so users cannot download a mixed or incomplete file set. Matching assets are retained, obsolete or changed assets removed, and missing files uploaded. GitHub sizes and digests must match the complete inventory before publication. The dedicated `development` tag moves to the exact commit, then the release becomes public with `prerelease=true` and `make_latest=false`. Stable version tags never move. An already complete build is a no-op; interrupted drafts are found through authenticated release listing and resumed.

GitHub does not offer an atomic multi-asset replacement. The preview is briefly unavailable during upload; a failed upload/tag update/publication leaves it hidden until retry succeeds. Build failures before publication preserve the existing public preview. This availability tradeoff avoids publicly serving a mixture of builds and keeps only one preview instead of accumulating release history. Retained CI artifacts can aid recovery.

Permanent links:

- Preview page: `https://github.com/SpecRefit/specrefit/releases/tag/development`
- Browser archive: `https://github.com/SpecRefit/specrefit/releases/download/development/specrefit-web.tar.gz`
- Linux archive: `https://github.com/SpecRefit/specrefit/releases/download/development/specrefit-desktop-linux-x64.tar.gz`
- Future stable release: `https://github.com/SpecRefit/specrefit/releases/latest` (no stable release exists yet).

## Artifacts and dependencies

The browser archive contains static files; serve its `web/` directory. The experimental Linux x64 desktop archive includes Electron/Node and notices, but still requires graphical/system libraries. Windows/macOS, CLI and Maven packages join the manifest only after implementation and verification; no placeholder packages are published. Archive ordering, owners and timestamps are normalized and executable modes retained. No native clean-machine acceptance is implied.

The existing pinned GitHub-maintained upload/download artifact actions are MIT-licensed and run only in CI, transferring archives through GitHub storage with seven-day CI retention. Published preview assets are separate. The publisher uses Node built-in HTTP and hashing APIs, with no new dependency or product telemetry. Browser processing remains local.

## Verification and migration

`npm run test:development` uses a controlled in-memory GitHub service to cover inventory validation, rolling replacement, obsolete assets, interrupted drafts, checksum failures, tag movement, stale builds, idempotent reruns and protection of stable/immutable/diverged releases. Tests create no public releases. `npm run archive:development` creates real archives after browser/desktop metadata verification. All workstation builds and automated checks run in WSL.

Migration is explicitly authorized by the owner: retain the newest verified downloads as the single `development` prerelease, remove the older per-commit development releases and their development-only tags, and update the website links. The old Latest policy is superseded. Publication workflow changes still require owner merge; do not bypass the review rule. Verify the first main publication after merge.

Migration completed on 2026-10-02: release 402148637 now uses development as a prerelease, preserving the verified 3e3f68661ade downloads. The older release and both old development-only tags were removed. GitHub's Latest endpoint returns 404, as expected with no stable release. Future automated replacement still awaits the publisher PR merge.
