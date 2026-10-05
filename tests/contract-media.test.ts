import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { inspect, valueAt } from '../packages/engine/index.ts';
import { contractMediaTypes, transform, type ContractMediaRule } from '../packages/engine/transform.ts';

const fixture = readFileSync('tests/fixtures/media-preference.yaml', 'utf8');
const external = readFileSync('tests/fixtures/media-components.yaml', 'utf8');
const rule: ContractMediaRule = { id: 'preferred-media', kind: 'select-contract-media', keep: ['application/json', 'multipart/form-data'] };
const content = '/paths/~1inline/post/requestBody/content';
const mediaKeys = (value: any, pointer: string) => Object.keys(valueAt(value, pointer) as object).filter(k => !k.startsWith('x-'));
function input(version = '3.1.2', format = 'yaml') {
  const root = parse(fixture); root.openapi = version;
  if (version.startsWith('3.0')) delete root.webhooks;
  return { entry: `api.${format}`, sources: [{ id: `api.${format}`, text: format === 'yaml' ? fixture.replace('3.1.2', version).replace(version.startsWith('3.0') ? /webhooks:[\s\S]*?(?=components:)/ : /$^/, '') : JSON.stringify(root) }, { id: 'media-components.yaml', text: external }] };
}

for (const version of ['3.0.4', '3.1.2', '3.2.0']) for (const format of ['json', 'yaml']) test(`${version} ${format}: contract preference covers shared, nested and external content with byte-idempotent replay`, () => {
  const source = input(version, format), original = structuredClone(source);
  const config = { version: 1, rules: [rule] };
  const preview = transform(source, config);
  assert.equal(preview.files.length, 2, JSON.stringify(preview));
  const root = parse(preview.files[0].text), shared = parse(preview.files[1].text);
  assert.deepEqual(mediaKeys(root, content), ['application/json', 'multipart/form-data']);
  assert.deepEqual(mediaKeys(root, '/paths/~1inline/post/responses/400/content'), ['application/json']);
  assert.deepEqual(mediaKeys(root, '/paths/~1single/post/responses/200/content'), ['application/xml']);
  assert.deepEqual(mediaKeys(root, '/paths/~1single/post/requestBody/content'), ['multipart/form-data']);
  assert.deepEqual(mediaKeys(root, '/paths/~1other/get/responses/200/content'), ['application/xml', 'text/csv']);
  assert.deepEqual(mediaKeys(root, '/paths/~1inline/post/callbacks/notify/{$request.body#~1callbackUrl}/post/requestBody/content'), ['application/json']);
  assert.deepEqual(mediaKeys(root, '/components/responses/Unused/content'), ['application/json']);
  assert.deepEqual(mediaKeys(shared, '/request/content'), ['application/json']);
  assert.deepEqual(mediaKeys(shared, '/response/content'), ['application/json']);
  assert.deepEqual(root.paths['/shared'], root.paths['/shared-again']);
  assert.equal(preview.changes.filter(c => c.status === 'changed' && c.target.pointer === '/request/content').length, 1);
  assert.equal(valueAt(root, content + '/x-content-note'), 'Keep this extension');
  assert.deepEqual(root.components.parameters, parse(fixture).components.parameters);
  assert.deepEqual(root.components.schemas, parse(fixture).components.schemas);
  assert.deepEqual(inspect({ entry: source.entry, sources: preview.files }).diagnostics, []);
  assert.deepEqual(transform({ entry: source.entry, sources: preview.files }, config).files, preview.files);
  assert.deepEqual(transform(source, config), preview); assert.deepEqual(source, original);
  if (format === 'yaml') assert(preview.files[0].text.includes('# Preserve the selected schema and comment'));
});

test('options include every offered request/response key and exclude parameters, examples and extensions', () => {
  assert.deepEqual(contractMediaTypes(inspect(input())), ['application/json', 'application/problem+json', 'application/xml', 'multipart/form-data', 'text/csv', 'text/plain']);
  const source = input(), root = parse(source.sources[0].text);
  delete root.paths['/inline'].post.requestBody.content['application/json'];
  root.paths['/inline'].post.requestBody.content['application/xml; charset=utf-8'] = { schema: { type: 'string' } };
  source.sources[0].text = JSON.stringify(root);
  assert(contractMediaTypes(inspect(source)).includes('application/xml; charset=utf-8'));
});

test('XML and multiple exact preferences work, multipart only disappears when deliberately excluded from a matching choice', () => {
  const source = input();
  const preview = transform(source, { version: 1, rules: [{ ...rule, keep: ['application/xml', 'multipart/form-data'] }] });
  const root = parse(preview.files[0].text);
  assert.deepEqual(mediaKeys(root, content), ['application/xml', 'multipart/form-data']);
  assert.deepEqual(mediaKeys(root, '/paths/~1other/get/responses/200/content'), ['application/xml']);
  assert.deepEqual(mediaKeys(root, '/webhooks/incoming/post/requestBody/content'), ['application/xml']);
  const withoutMultipart = transform(source, { version: 1, rules: [{ ...rule, keep: ['application/json', 'application/problem+json'] }] });
  assert.deepEqual(mediaKeys(parse(withoutMultipart.files[0].text), content), ['application/json']);
  assert.deepEqual(mediaKeys(parse(withoutMultipart.files[0].text), '/paths/~1single/post/requestBody/content'), ['multipart/form-data']);
  assert.deepEqual(mediaKeys(parse(withoutMultipart.files[0].text), '/paths/~1inline/post/responses/400/content'), ['application/json', 'application/problem+json']);
  assert.deepEqual(transform(source, { version: 1, rules: [{ ...rule, keep: ['application/not-offered'] }] }).files.map(f => f.text), source.sources.map(f => f.text));
});

test('contract preference runs in explicit order with extraction and blocks removal of referenced content', () => {
  const source = input();
  const target = { document: source.entry, pointer: content + '/application~1xml/schema' };
  const extract = { id: 'extract', kind: 'extract-schema', target, expected: { type: 'string' }, name: 'XmlInput', onMissing: 'error' };
  assert.equal(transform(source, { version: 1, rules: [extract, rule] }).files.length, 2);
  assert.equal(transform(source, { version: 1, rules: [rule, extract] }).files.length, 0);
  const root = parse(source.sources[0].text);
  root.components.schemas.Inbound = { $ref: '#/paths/~1inline/post/requestBody/content/application~1xml/schema' };
  source.sources[0].text = JSON.stringify(root);
  const blocked = transform(source, { version: 1, rules: [rule] });
  assert.equal(blocked.files.length, 0); assert(blocked.changes.some(c => c.message.includes('referenced elsewhere')));
});

test('empty contracts and hostile contract preference configuration fail or remain unchanged explicitly', () => {
  const source = { entry: 'api.json', sources: [{ id: 'api.json', text: JSON.stringify({ openapi: '3.1.2', info: { title: 'Empty', version: '1' }, paths: {} }) }] };
  const unchanged = transform(source, { version: 1, rules: [rule] });
  assert.equal(unchanged.files[0].text, source.sources[0].text); assert.equal(unchanged.changes[0].status, 'unchanged');
  for (const rules of [[{ ...rule, keep: [] }], [{ ...rule, keep: [42] }], [{ ...rule, keep: ['application/json', 'application/json'] }], [{ ...rule, extra: true }], [rule, { ...rule, id: 'duplicate-policy' }], [{ ...rule, keep: ['x-note'] }]]) {
    const rejected = transform(source, { version: 1, rules }); assert.equal(rejected.files.length, 0); assert(rejected.diagnostics.length);
  }
});
