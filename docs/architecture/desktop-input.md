# Desktop local references

Opening a desktop contract supplies local relative references automatically, recursively, within the selected file's directory tree. This fixes the browser-style requirement to select every component file separately. It follows 0.1.0; that published release does not include the change. Browser users still select a folder or supply missing documents explicitly.

## Adapter and access boundary

The isolated preload derives physical paths from user-selected browser `File` objects. It exposes a bounded import operation, not a filesystem read API or arbitrary IPC. The main process validates the calling window/frame/application URL, protects the selected inputs and launches a native worker. `packages/desktop/import.ts` repeatedly calls the existing shared `inspect` engine to discover references; only the adapter accesses disk. The worker has a 30-second deadline so malformed inputs cannot keep the desktop main thread busy indefinitely. Inspection and transformations in the editor continue using the shared browser worker.

Logical document IDs and original text remain independent of physical paths. Explicitly supplied documents win and are never replaced by automatic reads. File references retain their declaring document's base, including nested `../` references that stay inside the selected root. Distinct basenames, percent-encoded spaces and cycles retain the engine's semantics. Schema scopes and other unsupported constructs retain the engine's existing diagnostics; the adapter does not guess additional reference positions.

Each selected file authorizes its containing directory tree. Automatic reads reject traversal or symlinks outside that tree, unsafe encoded separators, device/stream filenames, directories and non-regular files. Absolute/root-relative paths and network URLs are not automatically loaded. Files outside the selected tree can be selected explicitly in Diagnostics; their own local relative dependencies are then discovered. There are no network requests or reference credentials. Optional controlled network retrieval remains separate roadmap work.

Reads check resolved containment, file identity, size and timestamps around bounded file-handle reads. The engine's 64-document, 20 MB per-file and 40 MB total limits also apply to automatically read inputs. Missing/unreadable/blocked references leave the selected contract inspectable and produce location-specific diagnostics. A timeout or failure to protect discovered source files rejects the import, retaining the previous project.

Before returning any discovered contents to the editor, the main process registers selected/resolved reference paths and the identities observed while reading. The existing export service also refreshes current identities and prevents overwriting these inputs through aliases or hardlinks. This protection lasts for the application session. These checks do not claim OS-level isolation from a hostile process concurrently rewriting the filesystem.

## Packaging and verification

The existing esbuild dependency bundles the adapter and shared inspection engine into `dist/desktop/import.cjs`; native packaging includes it alongside `dist/web`. Prefer dependency module entry points so bundled JSON parsing has no unresolved UMD imports. No new dependency, network client or separately installed runtime is introduced. Existing yaml/jsonc-parser notices are distributed with the app.

`npm test` includes `tests/desktop-import.test.mjs`: recursive JSON/YAML imports, duplicate basenames, cycles, percent encoding, explicit URI mappings, deterministic retained/bundled output parity, missing files, traversal, linked-directory escape, invalid requests and size/count limits. `npm run test:desktop` selects a single real file through the production bridge, verifies discovery of both component files, exports exact shared-engine bundle bytes and rejects writes to either reference or its hardlink. The same regression runs in downloaded-package acceptance through `npm run test:desktop-archive`, including startup with an empty PATH. Native CI must pass on all four supported OS/architecture targets before merging.

The owner's original three-file JSON contract was also checked locally in WSL: 98 operations, all three documents present, zero missing references and zero inspection diagnostics. Machine-specific paths and source contents are deliberately not committed. Broader schema/dialect semantics and manual clean-machine acceptance remain open.
