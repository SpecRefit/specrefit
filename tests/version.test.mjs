import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildVersion, verifyBuildVersion } from '../scripts/version.mjs';

function repository(t) {
  mkdirSync('.cache', { recursive: true });
  const cwd = mkdtempSync(resolve('.cache/version-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'Version test'); git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgSign', 'false'); git('config', 'tag.gpgSign', 'false');
  writeFileSync(join(cwd, 'source.txt'), 'first\n'); git('add', 'source.txt'); git('commit', '-qm', 'Fixture');
  return { cwd, git, read: (env = {}) => buildVersion({ cwd, env }), edit: () => writeFileSync(join(cwd, 'source.txt'), 'changed\n') };
}

test('untagged builds use commit identity with no clock or guessed next release', t => {
  const r = repository(t), version = r.read();
  assert.equal(version.version, `0.0.0-dev+g${r.git('rev-parse', 'HEAD').slice(0, 12)}`);
  assert.equal(version.dirty, false); assert.equal(version.tag, null);
  assert.deepEqual(r.read(), version);
});
test('annotated stable tags and lightweight prerelease tags determine exact versions', t => {
  const r = repository(t);
  r.git('tag', '-a', 'v0.1.0', '-m', 'Fixture release');
  assert.equal(r.read().version, '0.1.0');
  r.git('tag', '-d', 'v0.1.0'); r.git('tag', 'v0.2.0-beta.1+build.7');
  assert.equal(r.read().version, '0.2.0-beta.1+build.7');
});
test('commits after a release do not reuse its version', t => {
  const r = repository(t); r.git('tag', 'v0.1.0'); r.edit(); r.git('commit', '-qam', 'Next');
  assert.match(r.read().version, /^0\.0\.0-dev\+g[0-9a-f]{12}$/);
});
test('local changes and untracked files cannot masquerade as a clean release', t => {
  const r = repository(t); r.git('tag', 'v0.1.0'); r.edit();
  assert.match(r.read().version, /\.dirty$/);
  assert.throws(() => r.read({ GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v0.1.0' }), /clean checkout/);
  r.git('restore', 'source.txt'); writeFileSync(join(r.cwd, 'extra.txt'), 'untracked');
  assert.equal(r.read().dirty, true);
});
test('pull request builds stay development versions even at a tagged commit', t => {
  const r = repository(t); r.git('tag', 'v0.1.0');
  assert.match(r.read({ GITHUB_EVENT_NAME: 'pull_request' }).version, /^0\.0\.0-dev/);
});
test('the development channel never turns a tagged main commit into a stable release', t => {
  const r = repository(t); r.git('tag', 'v1.0.0');
  const version = r.read({ SPECREFIT_BUILD_CHANNEL: 'development' });
  assert.match(version.version, /^0\.0\.0-dev\+g/); assert.equal(version.tag, null);
  assert.throws(() => r.read({ SPECREFIT_BUILD_CHANNEL: 'typo' }), /Unknown SPECREFIT_BUILD_CHANNEL/);
});
test('tag builds reject invalid SemVer and tags on a different commit', t => {
  const r = repository(t);
  for (const name of ['v01.2.3', 'v1.2', 'v1.2.3-beta.01', 'v1.2.3-', 'v1.2.3+']) {
    r.git('tag', name);
    assert.throws(() => r.read({ GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: name }), /valid vMAJOR/);
  }
  r.git('tag', 'v1.2.3'); r.edit(); r.git('commit', '-qam', 'Next');
  assert.throws(() => r.read({ GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v1.2.3' }), /checked-out commit/);
});
test('multiple release tags require an explicit tag build instead of guessing', t => {
  const r = repository(t); r.git('tag', 'v0.1.0'); r.git('tag', 'v0.2.0');
  assert.throws(() => r.read(), /Multiple release tags/);
  assert.equal(r.read({ GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v0.2.0' }).version, '0.2.0');
});
test('desktop packaging rejects assets with stale version metadata', t => {
  const r = repository(t), built = r.read();
  assert.deepEqual(verifyBuildVersion(built, r.read()), built);
  r.git('tag', 'v0.1.0');
  assert.throws(() => verifyBuildVersion(built, r.read()), /Run npm run build/);
  assert.throws(() => verifyBuildVersion({ ...built, commit: 'wrong' }, built), /Run npm run build/);
});
test('source archives without Git fail with an actionable message', t => {
  const r = repository(t); rmSync(join(r.cwd, '.git'), { recursive: true, force: true });
  // Even inside another checkout, an archive must not inherit that repository's version.
  assert.throws(() => r.read(), /Build from a clone/);
});
