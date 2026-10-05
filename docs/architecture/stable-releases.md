# Versioned GitHub releases

## Current checkpoint: 0.2.0 published

[SpecRefit 0.2.0](https://github.com/SpecRefit/specrefit/releases/tag/v0.2.0) was published as stable Latest on 2026-10-05 at `06:31:36 UTC`, after the owner merged [preparation PR #37](https://github.com/SpecRefit/specrefit/pull/37). The annotated tag points to `3dffeb3ff1d695fd79c14cf2b6bd57f6f199bfba`. [Tag Build 37272119716](https://github.com/SpecRefit/specrefit/actions/runs/37272119716) passed every browser/engine and native check plus complete download assembly.

All seven assets were verified in WSL against the exact tag and commit, then their remote names, sizes, uploaded states and SHA-256 digests were compared before publication. Latest resolves to v0.2.0. The rolling development prerelease, its identity and every asset remained unchanged. Do not recreate this release, retag it or replace its published files.

Post-publication acceptance is complete and recorded below. The only product-repository follow-up is the release-evidence documentation PR; the owner merges it. Future stable releases still need explicit authorization, and package registries remain out of scope. Inspect live state before resuming instead of relying on a stale checkpoint. Preserve unrelated local edits, including the owner-maintained `docs/project-handoff.md` change.

## Publication boundaries

Versions derive from `v`-prefixed SemVer tags. Do not edit the root `0.0.0-dev` placeholder to release. Product PRs retain the mandatory Build and code-owner rules; the owner merges them. Documentation-only preparation still receives the complete CI Build, but needs only local documentation checks. See [AGENTS.md](../../AGENTS.md) for WSL, signing, branch and authorization requirements.

Tag builds run browser/engine checks, all four native package checks and complete archive assembly. A successful tag Build retains `release-downloads` for 30 days. Tags do not publish automatically, deploy the playground or replace the rolling development preview. Internal `development-*` artifact group names are shared by both channels; embedded metadata distinguishes development from release artifacts. Never relabel development downloads as release packages.

Publish the authorized stable release through the authenticated maintainer CLI/account after asset verification. The GitHub release-published event dispatches a fresh Build on current main. After every required check passes, that run deploys the playground without republishing development downloads. Publishing through a workflow's default GITHUB_TOKEN would not trigger ordinary downstream release events; keep stable publication manual unless a separately reviewed automation design changes this.

## Repeatable release procedure

Replace angle-bracket placeholders with verified values; never paste them literally. Run GitHub/Git commands in the available authenticated shell. Run all local build, test and artifact-verification code in WSL, using the configured Linux tools. Keep downloads and temporary output in a fresh ignored directory on D and translate its path for WSL.

### 1. Prepare and pin reviewed source

Read these instructions, [versioning](versioning.md) and the chosen version's notes. Confirm explicit authorization for that version, all intended PRs merged and a successful main Build. Prepare notes/documentation in a normal `codex/` branch and create a PR; wait for the owner to merge. Do not alter branch protection or merge on the owner's behalf.

After merge, inspect live state and record the exact remote main SHA and successful Build run. Do not assume the current local branch is the release target. These commands are read-only:

```sh
git status --short
git ls-remote origin refs/heads/main refs/tags/v<VERSION>
gh pr view <PREPARATION_PR> --json state,mergeCommit
gh run list --branch main --workflow build.yml --limit 10 --json databaseId,headSha,event,status,conclusion
gh release list --limit 20
```

If main advanced beyond the reviewed preparation, inspect those changes before choosing a target. Verify that the chosen commit exists locally and corresponds to the intended reviewed main state. Fetch without resetting or discarding unrelated local edits. Check both local and remote tags and existing drafts before creating anything.

### 2. Tag, build and download

Create the annotated tag against the explicit reviewed SHA and push only that tag. Respect configured signing and 1Password; never disable signing, add empty commits or force-push a release tag to work around a prompt.

```sh
git tag -a v<VERSION> <REVIEWED_COMMIT> -m "SpecRefit <VERSION>"
git push origin refs/tags/v<VERSION>
gh run list --workflow build.yml --branch v<VERSION> --limit 5 --json databaseId,headSha,event,status,conclusion
gh run view <TAG_RUN_ID> --json headSha,headBranch,event,status,conclusion,jobs
gh run download <TAG_RUN_ID> --name release-downloads --dir <FRESH_DIRECTORY>
```

Wait for the actual tag run to finish successfully before downloading. Check its SHA, tag and event, every native job and the aggregate Build gate. A passing PR or earlier main build is not a substitute. For this workflow, tag publication/deployment jobs are expected to be skipped. Do not download artifacts from a different run or combine groups from several attempts.

### 3. Verify local release bytes

From the product repository, run the existing verifiers in WSL against the downloaded tag artifacts. This command template checks clean metadata, version/tag/commit, file inventory and checksums, then requires the complete download set:

```sh
node --input-type=module -e "const {verifyInventory}=await import('./scripts/development-artifacts.mjs'); const {requireCompleteDownloads}=await import('./scripts/assemble-development.mjs'); const [directory,commit,tag]=process.argv.slice(1); const manifest=await verifyInventory(directory,commit,tag); requireCompleteDownloads(manifest.files); console.log(JSON.stringify(manifest,null,2));" <WSL_DOWNLOAD_DIRECTORY> <REVIEWED_COMMIT> v<VERSION>
```

Require these five archives, plus `manifest.json` and `SHA256SUMS`, with no extra assets:

- `specrefit-web.tar.gz`
- `specrefit-desktop-win32-x64.zip`
- `specrefit-desktop-darwin-arm64.zip`
- `specrefit-desktop-darwin-x64.zip`
- `specrefit-desktop-linux-x64.tar.gz`

The actual tag's native CI has already extracted and tested each runtime-inclusive package with an empty PATH, including shared-engine behavior, export and source protection. This does not establish full clean-machine, signing or downloaded-app quarantine acceptance. Preserve those limits in release notes.

### 4. Create a draft and verify remote assets

Create the draft only for the verified existing tag and use the committed, reviewed release notes:

```sh
gh release create v<VERSION> --verify-tag --draft --title "SpecRefit <VERSION>" --notes-file docs/releases/<VERSION>.md
gh release upload v<VERSION> <EXPLICIT_SEVEN_VERIFIED_FILE_PATHS>
gh release view v<VERSION> --json databaseId,tagName,isDraft,isPrerelease,assets,url
gh api repos/SpecRefit/specrefit/releases/<RELEASE_ID>/assets --paginate
```

Before publication, calculate each local file's byte size and SHA-256 in WSL, including `manifest.json` and `SHA256SUMS` themselves. Compare all seven remote names, sizes, uploaded states and `sha256:` digests to those local files; reject missing, duplicate, extra or mismatched assets. If GitHub does not supply an asset digest, download that asset and compare its bytes/hash rather than assuming it matches. Keep this verification output with the local release work and record its outcome in the publication evidence.

Do not use `--clobber` on a published release. If interrupted, inspect the existing draft's tag, notes and assets and resume that draft. If a release is already published, verify and report its state; do not recreate it or silently replace assets. If the intended tag exists on another commit, stop and resolve it with the owner; never move a published tag.

### 5. Publish and verify downstream behavior

Only after successful local and remote verification, publish the explicitly authorized version as stable Latest:

```sh
gh release edit v<VERSION> --draft=false --prerelease=false --latest
gh release view v<VERSION> --json tagName,isDraft,isPrerelease,publishedAt,assets,url
gh api repos/SpecRefit/specrefit/releases/latest --jq .tag_name
gh release view development --json tagName,isPrerelease,assets,url
gh run list --workflow refresh-playground.yml --limit 5
gh run list --workflow build.yml --branch main --event workflow_dispatch --limit 5
```

Verify that Latest is the intended stable tag and the separate rolling development preview is preserved. Wait for the release-triggered refresh, its main Build and Pages deployment. Check the hosted build manifest and displayed version using a fresh browser visit. An exact release commit shows the release version; if main has newer commits, its development banner is correct. Do not force the playground back to an older release or create a needless commit to trigger it. Normal hosting propagation can take time; investigate failed/absent runs instead of claiming immediate deployment.

If publication succeeded but the refresh event did not run, first confirm the workflow and release event state; `gh workflow run build.yml --ref main` can recover the hosted rebuild without changing source. It still requires the complete Build gate. This does not publish a stable release or replace development downloads.

### 6. Record evidence and update the website

After public release verification, update the separate SpecRefit website's visible stable version and download text, keeping its stable `/releases/latest` and development links separate. The owner previously authorized website updates directly on main; inspect that checkout's instructions and unrelated changes first. Check links, narrow/wide layout and both themes before publishing, then verify its Pages deployment.

Record the release URL, exact tag SHA, tag Build run, seven-asset verification, refresh/main/Pages run IDs and hosted/website acceptance here and in ROADMAP.md. Update README's release status. Product documentation changes still use a PR. Do the hosted release acceptance before this documentation follow-up advances main: after that merge, the playground correctly reports a newer development build.

For a fresh chat, leave an explicit checkpoint: prepared PR awaiting owner merge, tag build pending, draft awaiting verification, published awaiting refresh, or complete. Include verified IDs and the next action. Do not infer unfinished work from an old checkpoint without checking live GitHub state. Never store credentials in handoff documents or release notes.

## Published release evidence

### 0.2.0

Published on 2026-10-05 at `06:31:36 UTC`: [SpecRefit 0.2.0](https://github.com/SpecRefit/specrefit/releases/tag/v0.2.0), stable Latest, annotated tag commit `3dffeb3ff1d695fd79c14cf2b6bd57f6f199bfba`. [Preparation PR #37](https://github.com/SpecRefit/specrefit/pull/37) was owner-merged and [main Build 37271604595](https://github.com/SpecRefit/specrefit/actions/runs/37271604595) passed before tagging. [Tag Build 37272119716](https://github.com/SpecRefit/specrefit/actions/runs/37272119716) passed all browser/engine and four native jobs plus complete archive assembly. Artifact `release-downloads` (ID `11328931287`) was downloaded, its exact seven entries extracted and verified in WSL with `verifyInventory` and `requireCompleteDownloads`. Before draft release `403426756` was published, all seven remote asset names, sizes, uploaded states and SHA-256 digests matched the local files, including the manifest and checksum file. Latest resolved to v0.2.0; the rolling development release and all its asset identities/digests were unchanged by publication.

The real release event succeeded: [refresh run 37272873562](https://github.com/SpecRefit/specrefit/actions/runs/37272873562) dispatched [main Build and Pages run 37272883250](https://github.com/SpecRefit/specrefit/actions/runs/37272883250). Every required check and playground deployment passed; development publication was correctly skipped. Live Chromium acceptance in WSL verified HTTPS, visible version 0.2.0 at the exact tag commit, hidden development banner, cache-free startup manifest, example navigation and local JSON import. All observed application requests were same-origin GETs; no contract upload occurred.

The website was updated at commit `9bb92f7df5b8bbe248eebe764918a3827c9d7f56`; [website Pages run 37272907900](https://github.com/SpecRefit/specrefit.github.io/actions/runs/37272907900) passed. Both local and live Chromium checks covered 390px/1440px layouts, light/dark themes, stable/development links, overflow, keyboard theme switching and the media illustration. The main download now says 0.2.0 and points to stable Latest; desktop reference guidance matches the new automatic local discovery behavior.

Publication and hosted acceptance are complete. The release-evidence documentation branch is `codex/release-0.2.0-evidence`; find its PR by head branch and let the owner merge it. That merge will advance main beyond the tag, so a development banner is expected afterward. It does not change the published 0.2.0 downloads. No registry publication occurred, and the documented signing/clean-machine limitations remain open.

### 0.1.0

Recorded on 2026-10-03: [SpecRefit 0.1.0](https://github.com/SpecRefit/specrefit/releases/tag/v0.1.0) was published as Latest at commit `419a7a8cbc2e56a651d6b87a9df4dde36690adc1`. [Tag run 37075840504](https://github.com/SpecRefit/specrefit/actions/runs/37075840504) passed browser/engine checks, all four native packages and complete archive assembly. The five archives plus manifest and checksum file were verified in WSL, then all seven remote asset sizes and SHA-256 digests were compared before publication. The separate development prerelease was preserved. See [0.1.0 release notes](../releases/0.1.0.md). The resize follow-up was issue #13 and is included in the 0.2.0 preparation.

## Remaining distribution limits

GitHub source archives are not runtime-inclusive applications. Installers, trusted publisher signatures, macOS notarization and full clean-machine acceptance remain separate work. [Native packaging](desktop-packaging.md) describes the limits. Maven Central publication remains deferred until the integration and its release design exist; namespace verification alone does not authorize publication.

`npm run test:packaging` covers complete inventory assembly, exact tag/commit matching, dirty or malformed metadata, mixed development/release groups and rejection of stable artifacts by development publication. Version fixtures separately establish clean tag derivation. Only the actual selected tag run supplies native evidence for its release bytes.
