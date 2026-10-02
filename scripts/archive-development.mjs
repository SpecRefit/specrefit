import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { verifyBuildVersion } from './version.mjs';
import { writeInventory } from './development-artifacts.mjs';
import { desktopTarget } from './desktop-target.mjs';

const target = desktopTarget();
const build = verifyBuildVersion(JSON.parse(await readFile('dist/web/version.json', 'utf8')));
const desktop = JSON.parse(await readFile(join('artifacts', target.folder, target.resources, 'app/dist/web/version.json'), 'utf8'));
verifyBuildVersion(desktop, build);
const output = resolve('artifacts/development');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const archivePath = join(output, target.archive);
if (target.platform === 'linux') {
  const archive = (name, cwd, entry) => execFileSync('tar', ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '-czf', resolve(output, name), '-C', cwd, entry], { stdio: 'inherit' });
  archive('specrefit-web.tar.gz', 'dist', 'web');
  archive(target.archive, 'artifacts', target.folder);
} else if (target.platform === 'darwin') {
  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', resolve('artifacts', target.folder), archivePath], { stdio: 'inherit' });
} else {
  execFileSync(join(process.env.SystemRoot, 'System32/tar.exe'), ['-a', '-cf', archivePath, '-C', resolve('artifacts'), target.folder], { stdio: 'inherit' });
}
const manifest = await writeInventory(output, build, build.tag);
console.log(`Archived ${manifest.files.length} artifacts for ${build.version}.`);
