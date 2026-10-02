import { cp, mkdir, readFile, writeFile, rm, rename } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { packager } from '@electron/packager';
import { verifyBuildVersion } from './version.mjs';
import { desktopTarget, nativeVersion } from './desktop-target.mjs';

const target = desktopTarget();
const version = verifyBuildVersion(JSON.parse(await readFile('dist/web/version.json', 'utf8')));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const staging = resolve('.cache/desktop-app'), output = resolve('.cache/packaged'), temporary = resolve('.cache/packager-tmp');
const destination = resolve('artifacts', target.folder);
for (const dir of [staging, output, temporary, destination]) {
  if (!dir.startsWith(resolve('.cache') + sep) && dir !== resolve('artifacts', target.folder)) throw new Error('Unsafe packaging destination.');
  await rm(dir, { recursive: true, force: true });
}
await mkdir(staging, { recursive: true }); await mkdir(temporary, { recursive: true });
await cp('apps/desktop', join(staging, 'apps/desktop'), { recursive: true });
await cp('dist/web', join(staging, 'dist/web'), { recursive: true });
await cp('LICENSE', join(staging, 'LICENSE'));
await writeFile(join(staging, 'package.json'), JSON.stringify({ name: pkg.name, productName: 'SpecRefit', version: version.version, license: pkg.license, main: 'apps/desktop/main.cjs' }, null, 2));
const packages = await packager({
  dir: staging, name: 'SpecRefit', executableName: 'SpecRefit', platform: target.platform, arch: target.arch,
  icon: resolve('apps/desktop/icons/icon'),
  electronVersion: pkg.devDependencies.electron, out: output, tmpdir: temporary, overwrite: true,
  asar: false, prune: false, appBundleId: 'dev.specrefit.desktop', appCategoryType: 'public.app-category.developer-tools',
  appCopyright: 'Copyright 2026 SpecRefit contributors', appVersion: nativeVersion(version.version), buildVersion: nativeVersion(version.version),
  darwinDarkModeSupport: true, extendInfo: { SpecRefitVersion: version.version },
  afterInitialize: [async ({ buildPath }) => {
    const manifestPath = join(buildPath, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.version = version.version;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }],
  download: { cacheRoot: process.env.electron_config_cache },
  // Ad-hoc signatures need no account or certificate; these are not Developer ID signing or notarization.
  ...(target.platform === 'darwin' ? { osxSign: { identity: '-', identityValidation: false, preAutoEntitlements: false, continueOnError: false, optionsForFile: () => ({ hardenedRuntime: false }) } } : {}),
});
if (packages.length !== 1) throw new Error('Expected exactly one native package.');
await mkdir(resolve('artifacts'), { recursive: true });
await rename(packages[0], destination);
console.log(`Portable ${target.id} development package: ${join(destination, target.executable)}`);
