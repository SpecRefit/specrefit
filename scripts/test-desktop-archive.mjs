import { execFileSync } from 'node:child_process';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { desktopTarget } from './desktop-target.mjs';
import { verifyBuildVersion } from './version.mjs';

const target = desktopTarget(), directory = resolve('artifacts/extracted');
await rm(directory, { recursive: true, force: true }); await mkdir(directory, { recursive: true });
const archive = resolve('artifacts/development', target.archive);
if (target.platform === 'darwin') execFileSync('ditto', ['-x', '-k', archive, directory], { stdio: 'inherit' });
else execFileSync(target.platform === 'win32' ? join(process.env.SystemRoot, 'System32/tar.exe') : 'tar', ['-xf', archive, '-C', directory], { stdio: 'inherit' });
const root = join(directory, target.folder);
verifyBuildVersion(JSON.parse(await readFile(join(root, target.resources, 'app/dist/web/version.json'), 'utf8')));
execFileSync(process.execPath, ['scripts/test-desktop.mjs'], { stdio: 'inherit', env: { ...process.env, SPECREFIT_TEST_PACKAGE: '1', SPECREFIT_PACKAGE_ROOT: root } });
