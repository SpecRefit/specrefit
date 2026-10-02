import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyBuildVersion } from './version.mjs';
import { writeInventory } from './development-artifacts.mjs';

if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Development archiving currently requires Linux x64.');
const build = verifyBuildVersion(JSON.parse(await readFile('dist/web/version.json', 'utf8')));
const desktop = JSON.parse(await readFile('artifacts/specrefit-linux-x64/resources/app/dist/web/version.json', 'utf8'));
verifyBuildVersion(desktop, build);
const output = resolve('artifacts/development');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const archive = (name, cwd, entry) => execFileSync('tar', ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '-czf', resolve(output, name), '-C', cwd, entry], { stdio: 'inherit' });
archive('specrefit-web.tar.gz', 'dist', 'web');
archive('specrefit-desktop-linux-x64.tar.gz', 'artifacts', 'specrefit-linux-x64');
const manifest = await writeInventory(output, build);
console.log(`Archived ${manifest.files.length} development artifacts for ${build.version}.`);
