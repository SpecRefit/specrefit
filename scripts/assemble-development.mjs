import { readdir, mkdir, rm, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { desktopTargets, desktopTarget } from './desktop-target.mjs';
import { verifyInventory, writeInventory } from './development-artifacts.mjs';
import { verifyBuildVersion } from './version.mjs';

export const expectedDownloads = ['specrefit-web.tar.gz', ...desktopTargets.map(id => {
  const [platform, arch] = id.split('-'); return desktopTarget(platform, arch).archive;
})].sort();
export function requireCompleteDownloads(files) {
  if (JSON.stringify(files.map(f => f.name).sort()) !== JSON.stringify(expectedDownloads)) throw new Error('Development publication requires the complete tested browser and native package set.');
}
export async function assembleDevelopment(input, output, commit, expectedTag = null) {
  const expectedFolders = desktopTargets.map(id => 'development-' + id).sort();
  if (JSON.stringify((await readdir(input)).sort()) !== JSON.stringify(expectedFolders)) throw new Error('Missing or unexpected native artifact group.');
  let build;
  const copies = [];
  for (const id of desktopTargets) {
    const folder = join(input, 'development-' + id), manifest = await verifyInventory(folder, commit, expectedTag);
    if (build) verifyBuildVersion(manifest, build); else build = manifest;
    const [platform, arch] = id.split('-');
    const names = [desktopTarget(platform, arch).archive, ...(platform === 'linux' ? ['specrefit-web.tar.gz'] : [])].sort();
    if (JSON.stringify(manifest.files.map(f => f.name)) !== JSON.stringify(names)) throw new Error(`Unexpected package set for ${id}.`);
    copies.push(...manifest.files.map(f => ({ from: join(folder, f.name), name: f.name })));
  }
  requireCompleteDownloads(copies);
  await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
  for (const file of copies) await cp(file.from, join(output, file.name));
  return writeInventory(output, {version:build.version,commit:build.commit,dirty:build.dirty,tag:build.tag}, expectedTag);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await assembleDevelopment(resolve('artifacts/incoming'), resolve('artifacts/development'), process.env.GITHUB_SHA,
    process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : null);
}
