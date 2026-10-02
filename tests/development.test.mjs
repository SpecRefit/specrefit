import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { writeInventory, verifyInventory } from '../scripts/development-artifacts.mjs';
import { publishDevelopment } from '../scripts/publish-development.mjs';

const build = { version: '0.0.0-dev+g' + 'a'.repeat(12), commit: 'a'.repeat(40), dirty: false, tag: null };
async function directory(t) {
  await mkdir('.cache', { recursive: true });
  const dir = await mkdtemp(resolve('.cache/development-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'web.tar.gz'), 'fixture archive');
  return dir;
}
test('artifact inventory includes every produced package and verifies bytes', async t => {
  const dir = await directory(t);
  await writeFile(join(dir, 'future-cli.zip'), 'another fixture');
  const manifest = await writeInventory(dir, build);
  assert.deepEqual(manifest.files.map(f => f.name), ['future-cli.zip', 'web.tar.gz']);
  assert.deepEqual(await verifyInventory(dir, build.commit), manifest);
  await writeFile(join(dir, 'web.tar.gz'), 'corrupt');
  await assert.rejects(verifyInventory(dir, build.commit), /checksums/);
});
test('publication rejects missing, extra, dirty and wrong-commit artifacts', async t => {
  const dir = await directory(t); await writeInventory(dir, build);
  await assert.rejects(verifyInventory(dir, 'b'.repeat(40)), /workflow commit/);
  await writeFile(join(dir, 'extra.jar'), 'extra');
  await assert.rejects(verifyInventory(dir, build.commit), /file set/);
  await rm(join(dir, 'extra.jar')); await rm(join(dir, 'web.tar.gz'));
  await assert.rejects(verifyInventory(dir, build.commit), /No development artifacts/);
  await writeFile(join(dir, 'web.tar.gz'), 'fixture');
  await writeInventory(dir, { ...build, version: build.version + '.dirty', dirty: true });
  await assert.rejects(verifyInventory(dir, build.commit), /Only clean artifacts/);
});
test('manifest traversal and incorrect checksum lists are rejected', async t => {
  const dir = await directory(t); await writeInventory(dir, build);
  await writeFile(join(dir, 'SHA256SUMS'), 'wrong');
  await assert.rejects(verifyInventory(dir, build.commit), /SHA256SUMS/);
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  manifest.files[0].name = '../web.tar.gz';
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
  await assert.rejects(verifyInventory(dir, build.commit), /file set/);
});

function service({ published = false, failUpload = false, comparison = 'identical', oldCommit = build.commit } = {}) {
  const assets = ['web.tar.gz', 'desktop.tar.gz', 'manifest.json', 'SHA256SUMS'].map((name, i) => ({ name, size: 100 + i, sha256: String(i).repeat(64) }));
  let release = published ? { id: 7, tag_name: 'development', target_commitish: oldCommit, prerelease: true, draft: false, assets: assets.map((a, i) => ({ ...a, id: i + 1, state: 'uploaded', digest: `sha256:${a.sha256}` })), html_url: 'https://example.invalid/development' } : null;
  let ref = published ? { object: { sha: oldCommit } } : null;
  let nextId = 10;
  const events = [];
  const api = async (method, path, data) => {
    events.push({ method, path, data });
    if (path.endsWith('...main')) return { status: 'ahead' };
    if (path.startsWith('/compare/')) return { status: comparison };
    if (path.startsWith('/releases?')) return release ? [structuredClone(release)] : [];
    if (path === '/releases/tags/development') return release && !release.draft ? structuredClone(release) : null;
    if (path === '/git/ref/tags/development') return ref;
    if (path === '/git/refs' || path === '/git/refs/tags/development') { ref = { object: { sha: data.sha } }; return ref; }
    if (method === 'POST' && path === '/releases') {
      assert.equal(release, null, 'Must reuse the one existing preview');
      release = { ...data, id: 7, assets: [], html_url: 'https://example.invalid/development' }; return structuredClone(release);
    }
    if (method === 'DELETE' && path.startsWith('/releases/assets/')) {
      assert(release.draft, 'Never mutate publicly available assets');
      release.assets = release.assets.filter(a => a.id !== Number(path.split('/').at(-1))); return null;
    }
    if (path === '/releases/7' && method === 'GET') return structuredClone(release);
    if (path === '/releases/7' && method === 'PATCH') { Object.assign(release, data); return structuredClone(release); }
    throw new Error(`Unexpected API operation ${method} ${path}`);
  };
  const upload = async (_id, asset) => {
    assert(release.draft);
    events.push({ upload: asset.name });
    if (failUpload && asset.name === 'desktop.tar.gz') throw new Error('Upload failed');
    release.assets.push({ id: nextId++, ...asset, state: 'uploaded', digest: `sha256:${asset.sha256}` });
  };
  return { options: { build, assets, api, upload, runUrl: 'https://example.invalid/run' }, events, release: () => release, ref: () => ref };
}

test('one verified prerelease is published without touching stable Latest', async () => {
  const s = service(); await publishDevelopment(s.options);
  assert.equal(s.events.filter(e => e.upload).length, 4);
  assert.equal(s.release().tag_name, 'development');
  assert.equal(s.release().prerelease, true);
  assert.equal(s.release().draft, false);
  assert.equal(s.ref().object.sha, build.commit);
  assert(s.events.filter(e => e.data?.make_latest).every(e => e.data.make_latest === 'false'));
  assert(!s.events.some(e => e.path?.includes('latest')));
});

test('a newer build replaces the same preview and moves only its dedicated tag', async () => {
  const s = service({ published: true, oldCommit: 'b'.repeat(40), comparison: 'behind' });
  s.release().assets[0].digest = 'sha256:old';
  s.release().assets.push({ id: 99, name: 'obsolete.zip' });
  await publishDevelopment(s.options);
  assert.equal(s.release().id, 7);
  assert.equal(s.release().target_commitish, build.commit);
  assert.equal(s.ref().object.sha, build.commit);
  assert.deepEqual(s.events.filter(e => e.upload).map(e => e.upload), ['web.tar.gz']);
  assert.equal(s.release().assets.length, 4);
  assert(!s.events.some(e => e.method === 'POST' && e.path === '/releases'));
});

test('failed upload remains a recoverable draft and does not move the tag', async () => {
  const s = service({ failUpload: true });
  await assert.rejects(publishDevelopment(s.options), /Upload failed/);
  assert.equal(s.release().draft, true);
  assert.equal(s.ref(), null);
});

test('older builds cannot overwrite the newer preview, even an interrupted draft', async () => {
  for (const draft of [true, false]) {
    const s = service({ published: true, comparison: 'ahead', oldCommit: 'b'.repeat(40) });
    s.release().draft = draft;
    await publishDevelopment(s.options);
    assert(!s.events.some(e => e.upload || e.method !== 'GET'));
  }
});

test('rerunning a complete published build does not withdraw or upload it again', async () => {
  const s = service({ published: true }); await publishDevelopment(s.options);
  assert(!s.events.some(e => e.upload || e.method !== 'GET'));
});

test('remote checksum mismatch leaves output hidden until verified', async () => {
  const s = service();
  const upload = s.options.upload;
  s.options.upload = async (...args) => { await upload(...args); s.release().assets.at(-1).digest = 'sha256:wrong'; };
  await assert.rejects(publishDevelopment(s.options), /incomplete or have different checksums/);
  assert.equal(s.release().draft, true);
  assert.equal(s.ref(), null);
});

test('draft recovery finds the hidden release and uploads only missing files', async () => {
  const s = service({ published: true }); s.release().draft = true; s.release().assets.pop();
  await publishDevelopment(s.options);
  assert.deepEqual(s.events.filter(e => e.upload).map(e => e.upload), ['SHA256SUMS']);
  assert.equal(s.release().draft, false);
});

test('stable, immutable and diverged releases are never modified', async () => {
  for (const mode of ['stable', 'immutable', 'diverged']) {
    const s = service({ published: true, comparison: mode === 'diverged' ? 'diverged' : 'identical' });
    if (mode === 'stable') s.release().prerelease = false;
    if (mode === 'immutable') s.release().immutable = true;
    await assert.rejects(publishDevelopment(s.options));
    assert(!s.events.some(e => e.upload || e.method !== 'GET'));
  }
});

test('tag or final publication failure can resume without re-uploading assets', async () => {
  for (const phase of ['tag', 'publish']) {
    const s = service({ published: true, oldCommit: 'b'.repeat(40), comparison: 'behind' });
    const api = s.options.api;
    let failed = false;
    s.options.api = async (method, path, data) => {
      if (!failed && ((phase === 'tag' && path === '/git/refs/tags/development') ||
          (phase === 'publish' && method === 'PATCH' && data?.draft === false))) {
        failed = true; throw new Error('Transient failure');
      }
      return api(method, path, data);
    };
    await assert.rejects(publishDevelopment(s.options), /Transient failure/);
    assert.equal(s.release().draft, true);
    await publishDevelopment(s.options);
    assert.equal(s.release().draft, false);
    assert.equal(s.ref().object.sha, build.commit);
    assert(!s.events.some(e => e.upload));
  }
});
