import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { playgroundVersion } from '../scripts/playground-version.mjs';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

function repository(t) {
  mkdirSync('.cache', { recursive: true });
  const cwd = mkdtempSync(resolve('.cache/playground-version-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'Version test'); git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgSign', 'false'); git('config', 'tag.gpgSign', 'false');
  writeFileSync(join(cwd, 'input'), 'fixture'); git('add', 'input'); git('commit', '-qm', 'Fixture');
  return { cwd, git, read: (env = { SPECREFIT_BUILD_CHANNEL: 'development' }) => playgroundVersion({ cwd, env }) };
}
test('an exact clean stable tag is displayed as a release even in a main development artifact', t => {
  const r = repository(t); r.git('tag', '-a', 'v0.1.0', '-m', 'Release');
  assert.deepEqual(r.read().release, { tag: 'v0.1.0', version: '0.1.0', commitsSince: 0 });
  assert.equal(r.read().development, false);
  assert.equal(r.read({ GITHUB_EVENT_NAME: 'pull_request' }).development, true);
});
test('later commits identify the reachable release and exact distance without guessing the next version', t => {
  const r = repository(t); r.git('tag', 'v0.1.0');
  r.git('commit', '--allow-empty', '-qm', 'Next'); r.git('commit', '--allow-empty', '-qm', 'Another');
  const result = r.read();
  assert.deepEqual(result.release, { tag: 'v0.1.0', version: '0.1.0', commitsSince: 2 });
  assert.equal(result.development, true); assert.equal(result.commit, r.git('rev-parse', 'HEAD'));
  assert.deepEqual(r.read(), result);
});
test('prerelease, invalid and unrelated tags cannot masquerade as a stable baseline', t => {
  const r = repository(t);
  r.git('tag', 'v01.2.3'); r.git('tag', 'v1.0.0-rc.1'); r.git('tag', 'development');
  assert.equal(r.read().release, null); assert.equal(r.read().development, true);
  const head = r.git('rev-parse', 'HEAD'); r.git('checkout', '-qb', 'other');
  r.git('commit', '--allow-empty', '-qm', 'Other release'); r.git('tag', 'v9.0.0'); r.git('checkout', '-q', head);
  assert.equal(r.read().release, null);
});
test('the next reachable release resets the count, while dirty source stays development', t => {
  const r = repository(t); r.git('tag', 'v0.1.0'); r.git('commit', '--allow-empty', '-qm', 'Next'); r.git('tag', 'v0.2.0');
  assert.deepEqual(r.read().release, { tag: 'v0.2.0', version: '0.2.0', commitsSince: 0 });
  writeFileSync(join(r.cwd, 'input'), 'changed'); assert.equal(r.read().development, true); assert.equal(r.read().dirty, true);
});

test('hosted builds distinguish published releases from unpublished tags', t => {
  const r = repository(t); r.git('tag', 'v0.1.0'); r.git('commit', '--allow-empty', '-qm', 'Next'); r.git('tag', 'v0.2.0');
  const env = { SPECREFIT_BUILD_CHANNEL: 'development', SPECREFIT_PLAYGROUND_RELEASE_TAGS: '["v0.1.0"]' };
  assert.deepEqual(r.read(env).release, { tag: 'v0.1.0', version: '0.1.0', commitsSince: 1 });
  assert.equal(r.read({ ...env, SPECREFIT_PLAYGROUND_RELEASE_TAGS: '["v0.1.0","v0.2.0"]' }).development, false);
  assert.equal(r.read({ ...env, SPECREFIT_PLAYGROUND_RELEASE_TAGS: '[]' }).release, null);
  assert.throws(() => r.read({ ...env, SPECREFIT_PLAYGROUND_RELEASE_TAGS: '{}' }), /JSON array/);
  assert.throws(() => r.read({ ...env, SPECREFIT_PLAYGROUND_RELEASE_TAGS: 'null' }), /JSON array/);
});

test('release refresh dispatches main and preserves the full deployment gate', () => {
  const build = parse(readFileSync('.github/workflows/build.yml', 'utf8'));
  const refresh = parse(readFileSync('.github/workflows/refresh-playground.yml', 'utf8'));
  assert.ok(Object.hasOwn(build.on, 'workflow_dispatch'));
  assert.deepEqual(refresh.on.release.types, ['published']);
  assert.match(refresh.jobs.refresh.if, /prerelease == false.*draft == false/);
  assert.match(refresh.jobs.refresh.steps[0].run, /gh workflow run build.yml.*--ref main/);
  assert.equal(build.jobs['deploy-playground'].needs, 'build');
  assert.deepEqual(build.jobs.build.needs, ['verify', 'native']);
  assert.equal(build.jobs['deploy-playground'].if, "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'");
  assert.equal(build.jobs['publish-development'].if, "github.event_name == 'push' && github.ref == 'refs/heads/main'");
});
