# Project handoff

Recorded 2026-10-02. The agreed product context lives in this repository; the original planning chat is not required to start implementation. Begin with AGENTS.md and its required reading list. Requirements and decisions take precedence over exploratory visual mockups or earlier chat proposals.

## Repositories

| Repository | Purpose | Existing checkout on the owner's workstation |
| --- | --- | --- |
| [SpecRefit/specrefit](https://github.com/SpecRefit/specrefit) | Product requirements, architecture, roadmap and future implementation | `D:\GitHub\specrefit` |
| [SpecRefit/specrefit.github.io](https://github.com/SpecRefit/specrefit.github.io) | Static landing page, logo assets and GitHub Pages configuration | `D:\GitHub\specrefit.github.io` |
| [SpecRefit/.github](https://github.com/SpecRefit/.github) | Organization profile in `profile/README.md` | `D:\GitHub\specrefit-profile` |

These are ordinary independent checkouts, not worktrees. The profile repository is presentation infrastructure, not a separate product module. GitHub pins `specrefit` on the organization overview; the onboarding tasks were hidden to make the pinned section visible.

## Branding and hosting

The approved logo is variant 2: blue and teal. The website repository stores the full transparent wordmark at `assets/specrefit-logo.png`, the vector symbol at `assets/mark.svg`, and the compact transparent 256 × 256 PNG avatar at `assets/specrefit-avatar.png` (3,638 bytes). Its README records the wordmark provenance. The profile repository contains a copy of the full wordmark.

The compact avatar file is committed and pushed. Updating GitHub's organization avatar is a separate profile action, not something publishing this PNG performs automatically. The last attempted automated upload was blocked by the Chrome extension's local-file access setting; successful avatar replacement has not been verified. This does not block product development.

The domain is managed at TransIP. The landing page is hosted by GitHub Pages from `main` at the root of the website repository, with `CNAME` set to `specrefit.dev` and HTTPS enabled. `www.specrefit.dev` redirects to the main domain. `play.specrefit.dev` is reserved for the future browser editor and has no editor deployed yet. No VPS or contract-processing server is part of this setup. See the website README for publishing and preview instructions; verify current DNS before making infrastructure changes.

## Resume development

Open or clone the product repository as the primary folder of a new local project/chat. Its AGENTS.md carries the testing, WSL, storage, safety and handoff requirements. A read-only browser/Electron viewer now exists on the implementation branch; see README.md for verified commands and docs/architecture/viewer.md for evidence and support boundaries. Apache 2.0 remains the selected license.

The next task is owner review of the first viewer, followed by the remaining work in ROADMAP.md. Broader schema/reference coverage, native distribution/clean-machine acceptance, transformation-time comment preservation, bundling, byte-identical contract output and runtime-inclusive CLI/Maven feasibility remain open. The viewer does not implement editing, transformation, comparison or export; those product requirements remain accepted.

The WSL development runtime is installed persistently at `/mnt/d/devtools/node/node-v24.21.0-linux-x64/bin`; browser binaries are at `/mnt/d/devtools/playwright`. A terminal's PATH export is temporary. Use the explicit Linux tool invocation in AGENTS.md or the setup exports in README.md in a fresh session. The owner installed Ubuntu Xvfb/unzip and WebKit system dependencies on 2026-10-02. Report any additional missing WSL prerequisites with installation instructions.

Use ordinary `codex/` branches in the existing D: checkout, without worktrees. Avoid concurrent branch changes or writes from different chats. Central product/architecture decisions remain in the decision chat; implementation chats carry out agreed work. PR review from code owner `@mrhoeve` is required; do not merge or bypass review. Website and profile repositories are not part of viewer changes.

GitKraken originally needed separate OAuth approval for this new GitHub organization. The owner reported resolving that access issue. If authentication fails in a new environment, diagnose that client's credentials; do not change repository visibility or weaken organization-wide app restrictions as a workaround.
