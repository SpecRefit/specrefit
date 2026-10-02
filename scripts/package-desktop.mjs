import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { verifyBuildVersion } from './version.mjs';

// Portable development distribution for the current host only. No cross-OS support claim.
if (process.platform !== 'linux') throw new Error('This evaluated packaging path currently targets Linux only. Native Windows/macOS packaging is pending.');
const version = verifyBuildVersion(JSON.parse(await readFile('dist/web/version.json', 'utf8')));
const destination = resolve(`artifacts/specrefit-${process.platform}-${process.arch}`);
await mkdir(destination, { recursive: true });
await cp('node_modules/electron/dist', destination, { recursive: true });
const appRoot = join(destination, 'resources/app');
await mkdir(appRoot, { recursive: true });
await cp('apps/desktop', join(appRoot, 'apps/desktop'), { recursive: true });
await cp('dist/web', join(appRoot, 'dist/web'), { recursive: true });
await cp('LICENSE', join(appRoot, 'LICENSE'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(join(appRoot, 'package.json'), JSON.stringify({ name: pkg.name, version: version.version, license: pkg.license, main: 'apps/desktop/main.cjs' }, null, 2));
console.log(`Portable Linux development bundle (including Electron runtime and notices): ${destination}/electron`);
