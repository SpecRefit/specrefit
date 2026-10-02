import { spawnSync } from 'node:child_process';
const args = ['--test', 'tests/desktop.test.mjs'];
const child = process.platform === 'linux'
  ? spawnSync('xvfb-run', ['-a', process.execPath, ...args], { stdio: 'inherit', env: process.env })
  : spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
if (child.error) throw child.error;
process.exit(child.status ?? 1);
