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

function service({ failUpload = false, moveMain = false, published = false } = {}) {
  const assets = ['web.tar.gz', 'desktop.tar.gz', 'manifest.json', 'SHA256SUMS'].map((name, i) => ({ name, size: 100 + i, sha256: String(i).repeat(64) }));
  let release = published ? { id: 7, draft: false, assets: assets.map((a, i) => ({ ...a, id: i + 1, state: 'uploaded', digest: `sha256:${a.sha256}` })), html_url: 'https://example.invalid/development' } : null;
  const events = [];
  const api = async (method, path, data) => {
    events.push({ method, path, data });
    if (path.endsWith('...main')) return { status: 'ahead' };
    if (path.startsWith('/compare/')) return { status: moveMain ? 'ahead' : 'identical' };
    if (path === '/releases/latest') return moveMain ? { tag_name: 'develop-' + 'b'.repeat(40) } : null;
    if (release) Object.assign(release, { tag_name: `develop-${build.commit}`, target_commitish: build.commit });
    if (path.startsWith('/releases/tags/')) return release && structuredClone(release);
    if (method === 'POST') { release = { ...data, id: 7, draft: true, assets: [], html_url: 'https://example.invalid/development' }; assert.equal(data.make_latest, 'false'); return structuredClone(release); }
    if (method === 'GET') return structuredClone(release);
    if (method === 'PATCH') { Object.assign(release, data); return structuredClone(release); }
    throw new Error('Unexpected mutation');
  };
  const upload = async (_id, asset) => {
    events.push({ upload: asset.name });
    if (failUpload && asset.name === 'desktop.tar.gz') throw new Error('Upload failed');
    release.assets.push({ id: release.assets.length + 1, ...asset, state: 'uploaded', digest: `sha256:${asset.sha256}` });
  };
  return { options: { build, assets, api, upload, runUrl: 'https://example.invalid/run' }, events, release: () => release };
}
test('latest changes only after every artifact has been uploaded and checked', async () => {
  const s = service(); await publishDevelopment(s.options);
  assert.equal(s.events.filter(e => e.upload).length, 4);
  assert.equal(s.events.at(-1).data.make_latest, 'true');
  assert.equal(s.events.at(-1).data.draft, false);
});
test('failed uploads leave the previous latest untouched and the new build in draft', async () => {
  const s = service({ failUpload: true });
  await assert.rejects(publishDevelopment(s.options), /Upload failed/);
  assert.equal(s.release().draft, true);
  assert.equal(s.events.some(e => e.method === 'PATCH'), false);
});
test('a newer main commit prevents an older build from replacing latest', async () => {
  const s = service({ moveMain: true });
  await publishDevelopment(s.options);
  assert.equal(s.events.at(-1).data.make_latest, 'false');
  assert.equal(s.release().draft, false); // The older merge still gets its own downloads.
});
test('rerunning a published commit verifies assets without replacing them', async () => {
  const s = service({ published: true }); await publishDevelopment(s.options);
  assert.equal(s.events.some(e => e.upload || e.method === 'DELETE' || e.method === 'POST'), false);
});
test('remote checksum mismatch cannot become latest', async () => {
  const s = service({ published: true }); s.release().assets[0].digest = 'sha256:wrong';
  await assert.rejects(publishDevelopment(s.options), /incomplete or have different checksums/);
  assert.equal(s.events.some(e => e.method === 'PATCH'), false);
});
test('an interrupted draft resumes without re-uploading verified files', async () => {
  const s = service({ published: true }); s.release().draft = true;
  s.release().assets.pop();
  await publishDevelopment(s.options);
  assert.deepEqual(s.events.filter(e => e.upload).map(e => e.upload), ['SHA256SUMS']);
  assert.equal(s.release().draft, false);
});
