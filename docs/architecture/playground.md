# Hosted playground

The owner requested the hosted playground and current development downloads on the landing page on 2026-10-02. The product repository publishes its tested `dist/web` directory to GitHub Pages at `https://play.specrefit.dev`; the separate website repository continues to serve `https://specrefit.dev`.

This is the read-only viewer preview, not a stable release or the complete transformation workflow. The version in its header identifies the build. Uploaded contract and reference files remain in browser memory; the application has no processing endpoint, remote reference retrieval, telemetry, service worker or automatic update polling. GitHub serves application assets and logs visitor IP addresses for security, as described in its Pages documentation. Reloading discards the inspection session and loads the currently hosted application.

## Publication boundary

The required Build job runs the existing Chromium, Firefox and WebKit suite as well as type, engine, version, development-publication and packaged Electron checks. A main push uploads the exact tested browser directory as a Pages artifact. A separate, narrowly permissioned job deploys only after Build succeeds. PRs and tags do not deploy. Deployment is serialized; before deployment the job checks that its commit is still the main tip, so a late older build cannot replace a newer playground. A main update during deployment can temporarily leave the previous build visible until the newer successful build deploys. Failed builds preserve the last published preview.

GitHub Pages must use the Actions source with custom domain `play.specrefit.dev`. Its DNS CNAME points to `specrefit.github.io`. The domain and HTTPS enforcement were configured and verified through the GitHub API on 2026-10-02. The `github-pages` environment is restricted to main. No deploy token is stored in the repository: the deployment job receives Pages write permission and a short-lived GitHub OIDC identity; its repository permission is read-only.

Dependency review before adoption: GitHub-maintained `actions/upload-pages-artifact` v4 and `actions/deploy-pages` v4 are MIT-licensed, pinned to full commits, and run only in CI. The upload action packages files with runner tools and the GitHub artifact action; deployment uses GitHub APIs and runner authentication. These tools require network access to GitHub, add no browser/runtime dependency, and do not change offline product processing or add product telemetry. Their bundled dependencies remain confined to the CI runner.

## Website and download channels

The landing page links to `https://github.com/SpecRefit/specrefit/releases/tag/development`, which currently denotes the latest successful development build. Available files are browser assets, an experimental Linux x64 runtime bundle, a manifest and checksums. Stable releases and Windows/macOS/CLI/Maven packages must not be advertised as available before implementation and publication.

GitHub Latest is reserved for future stable releases. One rolling development prerelease uses the fixed development tag; the website links directly to it. Maven Central publication remains a separate future step.

## Acceptance

Before merge, run the documented WSL build and browser checks and inspect the workflow permissions, event guards and diff. After the authorized main update, verify the Actions deployment, HTTPS response, displayed version, example navigation and local file import on the hosted site. DNS and Pages setup alone do not establish a working deployment. Keep the landing page's hosted-preview link unavailable until that verification succeeds.

Local verification on 2026-10-02: WSL type check/build, 30 engine tests, 10 version tests, 9 publication tests, 21 real-browser cases and both packaged/development Electron cases passed. The website was checked at 1440px and 390px in light/dark themes, including download destination and keyboard interaction. Hosted acceptance subsequently passed after [the first deployment](https://github.com/SpecRefit/specrefit/actions/runs/37063276439): HTTPS, correct build commit, example navigation, local contract import and absence of contract upload were checked in Chromium under WSL.
