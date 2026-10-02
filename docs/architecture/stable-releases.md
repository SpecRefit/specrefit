# Versioned GitHub releases

On 2026-10-03 the owner requested the first versioned release, 0.1.0. This authorizes preparing and publishing that GitHub release after the required workflow changes are reviewed and merged. It does not authorize merging the implementation PR, publishing to package registries or automatically publishing every future tag.

Tag builds now use the same browser/engine and four native package checks as main. The required Build gate validates a complete set of five archives from the exact tag and commit, then retains `release-downloads` for 30 days. Tags do not publish automatically, deploy the playground or replace the development preview. `development-*` artifact group names and `artifacts/development` remain internal staging names shared by both channels; the embedded version and manifest distinguish them. Development publication continues to reject release metadata.

## First release procedure

1. Merge the reviewed release-preparation PR to main and verify its main checks. Preserve unrelated local edits; create the annotated `v0.1.0` tag explicitly on the reviewed main commit, never on an assumed current branch. Verify no local or remote tag of that name already exists. Push that tag without force.
2. Wait for the tag's complete Build workflow to succeed, including native startup/export tests and archive assembly. Verify the workflow's tag and commit. Download only that run's `release-downloads` artifact into a fresh directory. Do not relabel development downloads.
3. Verify the inventory using `verifyInventory(directory, commit, 'v0.1.0')` from `scripts/development-artifacts.mjs` and `requireCompleteDownloads(manifest.files)` from `scripts/assemble-development.mjs`. Inspect the version, commit and five archive names. All local automated checks run in WSL.
4. Create a draft GitHub release for the existing tag with `--verify-tag`, title `SpecRefit 0.1.0` and the reviewed notes in [0.1.0.md](../releases/0.1.0.md). Upload the five archives plus `manifest.json` and `SHA256SUMS`. Verify GitHub reports the exact seven asset names, sizes and SHA-256 digests matching the local files before making the draft public as a non-prerelease with Latest enabled.
5. Verify the public release, assets, Latest endpoint and unchanged Development preview. Record the release URL and tag-build evidence in the roadmap and update the separate website's stable download links. Do not move published version tags or silently replace published assets. Interrupted uploads remain drafts; inspect and resume the same draft.

The source archives GitHub automatically offers are not runtime-inclusive applications. Installers, trusted publisher signatures, macOS notarization and full clean-machine acceptance remain separate work. [Native packaging](desktop-packaging.md) describes the current limits. Maven Central publication remains deferred until a Maven integration and its release design exist.

`npm run test:packaging` covers release inventory assembly, exact tag/commit matching, dirty or malformed metadata, mixed development/release groups and rejection of release artifacts by the development channel. Version fixture tests separately prove clean tag derivation; the real `v0.1.0` build supplies native evidence for the actual release bytes.
