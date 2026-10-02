# Native desktop development packages

Implemented packaging pipeline (2026-10-03). Runtime-inclusive portable Windows x64 and macOS arm64/x64 packages accompany Linux x64. Native GitHub Actions runners must verify each package before development publication; [PR #11 checks](https://github.com/SpecRefit/specrefit/pull/11/checks) record the first native results and exact tested commit. Installers, store distribution, Developer ID signing, notarization and clean-machine acceptance beyond these runners remain separate work.

## Build dependency decision

Use pinned `@electron/packager` 20.3.0, the maintained Electron project packaging tool, to rename executables, prepare application bundles and set platform metadata. Registry metadata checked on 2026-10-03 reports BSD-2-Clause licensing, Node >=22.12 compatibility and a last package update on 2026-08-11. It is a development-only Node tool; it is not loaded by the browser or distributed application. It uses Electron download tooling during explicitly requested packaging; it performs no application update checks or telemetry. Signing/notarization dependencies are build tools, not runtime services; no Apple credentials or paid service are configured. The 38 added locked packages declare MIT, BSD-2-Clause, ISC, Apache-2.0 or BlueOak-1.0.0; none adds an install script. The packager and Blue Oak licenses and installed version/signing hooks were reviewed. These permissive build dependencies do not change the product license and are not shipped. Only an explicit staging directory containing built web assets, desktop adapter code, package metadata and notices is packaged; no repository, credentials, configuration fixtures or development dependencies are included.

Sources: [Electron Packager options](https://packages.electronjs.org/packager/v20.0.0/interfaces/Options.html), [Electron distribution overview](https://www.electronjs.org/docs/latest/tutorial/distribution-overview).

## Packages and launch

| Target | Native CI runner | Download | Launch after extraction |
| --- | --- | --- | --- |
| Windows x64 | windows-2025 | specrefit-desktop-win32-x64.zip | SpecRefit.exe |
| macOS Apple Silicon | macos-15 | specrefit-desktop-darwin-arm64.zip | SpecRefit.app |
| macOS Intel | macos-15-intel | specrefit-desktop-darwin-x64.zip | SpecRefit.app |
| Linux x64 | ubuntu-24.04 | specrefit-desktop-linux-x64.tar.gz | SpecRefit |

Extract the complete directory, then launch the listed application; do not move only the executable out of its supporting files. On macOS the .app bundle can optionally be moved to Applications. Portable means no installer or separately installed Node/Electron runtime is required; normal OS profile/cache directories are still used. Linux needs a graphical session and Chromium system libraries. Windows arm64, other Linux architectures, minimum production OS versions and installers are not claimed.

Windows artifacts have no publisher signature. macOS uses an explicit local ad-hoc signature with no certificate, Apple account, Developer ID or notarization. This preserves Apple Silicon launchability after branding; it does not establish publisher trust or bypass Gatekeeper. No automatic credential discovery, signing service or global security-setting changes are used. OS quarantine, SmartScreen, Gatekeeper and enterprise policy can block downloaded development builds even when CI startup succeeds. Follow the OS's per-application approval workflow only for a download you trust; no automated security bypass is included.

## Packaging and version identity

`npm run build`, `npm run package:desktop`, `npm run archive:development` and `npm run test:desktop-archive` build, archive, extract and test the host's package. Run workstation commands in WSL; Windows/macOS builds and tests run on native CI. Linux test startup uses Xvfb; other hosts run the same test file directly. `npm run test:packaging` tests inventory assembly and rejection of missing, corrupt, extra and mixed-commit artifacts. `npm run test:desktop` remains available for the unbundled application; setting SPECREFIT_TEST_PACKAGE selects the packaged application instead.

The same bundled engine, editor and platform adapter are staged on every OS. Package metadata and the UI retain the full Git version. Numeric native resource fields use the SemVer major/minor/patch core (0.0.0 for development); they are not a unique preview identifier. The packager initialization hook restores the complete application package version before signing. Native icons are committed derivatives of the existing vector mark; regenerate with `node scripts/generate-desktop-icons.mjs` in WSL with Chromium installed.

Linux tar metadata is normalized. Native ZIPs preserve executable modes and macOS framework symlinks through OS archive tools; native container bytes/signatures need not match across hosts. Generated contract names and bytes remain the shared engine's deterministic output. Each published archive has an exact SHA-256 checksum.

## Required checks and publication boundary

The required Build check depends on browser/engine validation and all four native matrix jobs. A failure, cancellation or missing target blocks the gate. Each native job runs engine/persistence tests, builds and archives its package, extracts that archive and runs the editor, worker parity, version, license, source/hardlink protection, cancellation and direct-directory export tests from the extracted application with an empty PATH. These checks demonstrate use of the bundled runtime. The application blocks a test network request; this is not a packet-capture audit of every OS service.

The gate downloads all four artifact groups and verifies their checksums, exact expected filenames, clean build metadata and identical commit/version before assembling one inventory. Main publication repeats that validation and requires all five downloads (web plus four native packages). PRs upload test artifacts but never publish releases. Tags also run every native check and retain a verified release download set; [versioned publication](stable-releases.md) is a separate manual action.

CI machines contain development tools and have no normal browser-download quarantine. Empty-PATH startup is useful runtime evidence, not full clean-machine, Gatekeeper or enterprise-policy acceptance. Manual downloaded-package acceptance on representative Windows and Mac machines remains required before claiming production support.
