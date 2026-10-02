import { resolve, join } from 'node:path';

export const desktopTargets = ['linux-x64', 'win32-x64', 'darwin-arm64', 'darwin-x64'];
export function desktopTarget(platform = process.platform, arch = process.arch) {
  const id = `${platform}-${arch}`;
  if (!desktopTargets.includes(id)) throw new Error(`No evaluated desktop packaging target for ${id}.`);
  const folder = `specrefit-${id}`;
  const executable = platform === 'darwin' ? 'SpecRefit.app/Contents/MacOS/SpecRefit' : platform === 'win32' ? 'SpecRefit.exe' : 'SpecRefit';
  const resources = platform === 'darwin' ? 'SpecRefit.app/Contents/Resources' : 'resources';
  return { id, platform, arch, folder, executable, resources, archive: `specrefit-desktop-${id}.${platform === 'linux' ? 'tar.gz' : 'zip'}` };
}
export function packageRoot() { return resolve(process.env.SPECREFIT_PACKAGE_ROOT || join('artifacts', desktopTarget().folder)); }

// Native metadata requires numeric versions; the complete Git version remains in package.json and the UI.
export function nativeVersion(version) {
  const core = version.split(/[+-]/)[0];
  if (!/^\d+\.\d+\.\d+$/.test(core) || core.split('.').some(n => Number(n) > 65535)) throw new Error('Version cannot be represented in native desktop metadata.');
  return core;
}
