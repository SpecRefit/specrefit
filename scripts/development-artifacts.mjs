import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { releaseVersion } from './version.mjs';

export async function inventory(directory, build, expectedTag = null) {
  if (expectedTag !== null) {
    if (build.version !== releaseVersion(expectedTag) || build.tag !== expectedTag || build.dirty !== false || !/^[0-9a-f]{40}$/.test(build.commit))
      throw new Error('Release artifacts require clean metadata matching the selected tag.');
  } else {
    if (!/^0\.0\.0-dev\+g[0-9a-f]{12}(?:\.dirty)?$/.test(build.version) || !/^[0-9a-f]{40}$/.test(build.commit) || build.tag !== null)
      throw new Error('Development artifacts require development version metadata.');
    if (typeof build.dirty !== 'boolean' || build.version !== `0.0.0-dev+g${build.commit.slice(0, 12)}${build.dirty ? '.dirty' : ''}`)
      throw new Error('Development version does not identify its commit and dirty state.');
  }
  const files = [];
  for (const name of (await readdir(directory)).sort()) {
    if (['manifest.json', 'SHA256SUMS'].includes(name)) continue;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:tar\.gz|zip|jar)$/.test(name)) throw new Error(`Unexpected development artifact: ${name}`);
    if (!(await lstat(join(directory, name))).isFile()) throw new Error('Artifacts must be regular files.');
    const bytes = await readFile(join(directory, name));
    if (!bytes.length) throw new Error('Empty development artifact.');
    files.push({ name, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  if (!files.length) throw new Error('No development artifacts were built.');
  return { ...build, files };
}

export async function writeInventory(directory, build, expectedTag = null) {
  const manifest = await inventory(directory, build, expectedTag);
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(directory, 'SHA256SUMS'), manifest.files.map(f => `${f.sha256}  ${f.name}\n`).join(''));
  return manifest;
}

export async function verifyInventory(directory, expectedCommit, expectedTag = null) {
  const saved = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (saved.dirty !== false || saved.commit !== expectedCommit) throw new Error('Only clean artifacts from this workflow commit may be published.');
  const actual = await inventory(directory, saved, expectedTag);
  if (JSON.stringify(actual.files) !== JSON.stringify(saved.files)) throw new Error('Development artifact checksums or file set do not match.');
  const sums = actual.files.map(f => `${f.sha256}  ${f.name}\n`).join('');
  if (await readFile(join(directory, 'SHA256SUMS'), 'utf8') !== sums) throw new Error('SHA256SUMS does not match the artifacts.');
  return actual;
}
