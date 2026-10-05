import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, truncate } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { importLocalReferences } from '../packages/desktop/import.ts';
import { inspect, canonical } from '../packages/engine/index.ts';
import { transform } from '../packages/engine/transform.ts';

const contract = refs => JSON.stringify({ openapi: '3.0.4', info: { title: 'Local references', version: '1' }, paths: {}, components: { schemas: Object.fromEntries(refs.map((ref, i) => ['S' + i, { $ref: ref }])) } });
async function fixture(t, files) {
  await mkdir('artifacts', { recursive: true });
  const root = await mkdtemp(resolve('artifacts/import-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) { await mkdir(dirname(join(root, name)), { recursive: true }); await writeFile(join(root, name), text); }
  return root;
}
async function load(root, entry = 'api.json', other = []) {
  return importLocalReferences({ entry, sources: [{ id: entry, text: await readFile(join(root, entry), 'utf8') }, ...other] }, [{ id: entry, path: join(root, entry) }]);
}

test('desktop discovers nested JSON/YAML references, cycles and duplicate basenames with identical shared-engine output', async t => {
  const files = {
    'api.json': contract(['components/foundation-schemas.json#/Foundation', 'components/workflow-schemas.json#/Workflow']),
    'components/foundation-schemas.json': JSON.stringify({ Foundation: { type: 'object', properties: { nested: { $ref: '../common/a/model.yaml' } } } }),
    'components/workflow-schemas.json': JSON.stringify({ Workflow: { $ref: '../common/b/model.yaml' } }),
    'common/a/model.yaml': 'type: object\nproperties:\n  cycle:\n    $ref: ../../components/foundation-schemas.json#/Foundation\n',
    'common/b/model.yaml': '# retained\ntype: string\nx-marker: workflow\n',
  };
  const root = await fixture(t, files), result = await load(root);
  assert.equal(result.sources.length, 5); assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(inspect({ entry: 'api.json', sources: result.sources }).diagnostics, []);
  for (const bundle of [false, true]) {
    const config = { version: 1, rules: [], output: { bundle, format: 'yaml' } };
    assert.deepEqual(transform({ entry: 'api.json', sources: result.sources }, config), transform({ entry: 'api.json', sources: Object.entries(files).map(([id, text]) => ({ id, text })) }, config));
  }
  assert(result.paths.includes(join(root, 'common/b/model.yaml')));
  assert.equal(result.identities.length, 4);
});

test('percent-encoded names resolve and explicitly supplied documents are never replaced', async t => {
  const root = await fixture(t, { 'api.json': contract(['components/my%20schema.yaml']), 'components/my schema.yaml': '\ufefftype: string' });
  assert.equal((await load(root)).sources[1].text, 'type: string');
  const result = await load(root, 'api.json', [{ id: 'components/my%20schema.yaml', text: 'type: integer' }]);
  assert.equal(result.sources[1].text, 'type: integer'); assert.deepEqual(result.paths, []);
});

test('missing files, parent escapes, encoded separators, links and network references remain explicit diagnostics', async t => {
  const root = await fixture(t, {
    'project/api.json': contract(['missing.yaml', '../secret.yaml', '%2e%2e/secret.yaml', 'linked/secret.yaml', 'bad%2fsecret.yaml', 'https://example.invalid/secret.yaml', '//example.invalid/secret.yaml', '/secret.yaml']),
    'secret.yaml': 'type: string',
  });
  await symlink(root, join(root, 'project/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = await load(root, 'project/api.json');
  assert.equal(result.sources.length, 1); assert.deepEqual(result.paths, []);
  assert(result.diagnostics.some(d => d.message.includes('not found')));
  assert(result.diagnostics.some(d => d.message.includes('outside')));
  assert(result.diagnostics.some(d => d.message.includes('unsafe')));
  assert.equal(inspect({ entry: 'project/api.json', sources: result.sources }).references.filter(r => r.missing).length, 8);
});

test('automatic loading respects file size/count limits and rejects directories', async t => {
  const root = await fixture(t, { 'api.json': contract(['large.yaml', 'folder', ...Array.from({ length: 64 }, (_, i) => `s${i}.yaml`)]), 'large.yaml': '', 'folder/a.yaml': 'type: string', ...Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`s${i}.yaml`, 'type: string'])) });
  await truncate(join(root, 'large.yaml'), 20_000_001);
  const result = await load(root);
  assert.equal(result.sources.length, 64);
  assert(result.diagnostics.some(d => d.message.includes('input limit')));
  assert(result.diagnostics.some(d => d.message.includes('regular file')));
  assert(!result.sources.some(s => s.id.endsWith('/large.yaml')));
});

test('explicitly mapped remote locations use only relative local references and preserve logical IDs', async t => {
  const root = await fixture(t, { 'api.json': contract(['parts/schema.yaml']), 'parts/schema.yaml': 'type: string' });
  const entry = 'https://contracts.example/api.json';
  const result = await importLocalReferences({ entry, sources: [{ id: entry, text: await readFile(join(root, 'api.json'), 'utf8') }] }, [{ id: entry, path: join(root, 'api.json') }]);
  assert.equal(result.sources[1].id, canonical('parts/schema.yaml', entry));
  assert.deepEqual(inspect({ entry, sources: result.sources }).diagnostics, []);
});

test('malformed native input requests fail without filesystem access', async () => {
  for (const input of [null, {}, { entry: 'api.json', sources: [{ id: 'api.json', text: 42 }] }]) await assert.rejects(importLocalReferences(input, []));
  await assert.rejects(importLocalReferences({ entry: 'api.json', sources: [{ id: 'api.json', text: contract([]) }] }, [{ id: 'other.json', path: resolve('missing.json') }]));
});
