import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { inspect, canonical, valueAt, type Value } from '../packages/engine/index.ts';

const source = (value: unknown, id = 'api.json') => ({ id, text: JSON.stringify(value) });
const operation = { responses: { '200': { description: 'OK' } } };
const contract = (version = '3.1.2') => ({ openapi: version, info: { title: 'Test', version: '1' }, paths: { '/pets': { get: operation } } });
const run = (value: unknown) => inspect({ entry: 'api.json', sources: [source(value)] });

for (const version of ['3.0.4', '3.1.2', '3.2.0']) for (const format of ['json', 'yaml']) {
  test(`${version} ${format}: semantic operations, extensions and unchanged source`, () => {
    const value = { ...contract(version), 'x-data': { vendor: true } };
    const text = format === 'json' ? JSON.stringify(value) : `# title comment\nopenapi: ${version}\ninfo: {title: Test, version: '1'}\npaths:\n  /pets:\n    get:\n      responses:\n        '200': {description: OK}\nx-data: {vendor: true}\n`;
    const report = inspect({ entry: `api.${format}`, sources: [{ id: `api.${format}`, text }] });
    assert.equal(report.version, version);
    assert.equal(report.operations[0].path, '/pets');
    assert.equal(report.operations[0].responses[0].status, '200');
    assert.equal(report.diagnostics.length, 0);
    assert.deepEqual(report.documents[0].value, value);
    assert.equal(report.documents[0].text, text);
  });
}
test('YAML syntax tree preserves comments and extension through stable serialization', () => {
  const text = readFileSync('tests/fixtures/schemas/pet.yaml', 'utf8');
  const doc = parseDocument(text, { keepSourceTokens: true });
  assert.match(String(doc), /# This description belongs to Pet/);
  assert.match(String(doc), /x-display-order/);
  assert.equal(String(doc), String(parseDocument(String(doc))));
});
test('multi-file schema recursion is an edge, not infinite expansion', () => {
  const report = inspect({ entry: 'petstore.yaml', sources: ['petstore.yaml', 'schemas/pet.yaml'].map(id => ({ id, text: readFileSync(`tests/fixtures/${id}`, 'utf8') })) });
  assert.equal(report.operations.length, 4);
  assert.equal(report.diagnostics.length, 0);
  assert.ok(report.references.some(r => r.uri === '#' && r.target?.document.endsWith('/schemas/pet.yaml')));
  assert.ok(report.operations.some(o => o.method === 'QUERY'));
});
test('path parameters merge by name AND location; operation security overrides global including empty', () => {
  const root = { ...contract(), security: [{ key: [] }], paths: { '/{id}': {
    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }, { in: 'query', name: 'id', schema: { type: 'string' } }],
    get: { ...operation, parameters: [{ in: 'query', name: 'id', schema: { type: 'number' } }], security: [] },
    post: operation,
  } } };
  const report = run(root);
  assert.equal(report.operations[0].parameters.length, 2);
  assert.equal(valueAt(report.operations[0].parameters[1].value, '/schema/type'), 'number');
  assert.deepEqual(report.operations[0].security, []);
  assert.deepEqual(report.operations[1].security, [{ key: [] }]);
});
test('relative refs, escaped/encoded pointers, duplicate basenames and explicit URI locations', () => {
  const root = { ...contract(), components: { schemas: { A: { $ref: './a/model.json#/a~1b' }, B: { $ref: './b/model.json#/%24defs/~0x' }, C: { $ref: 'https://schemas.example.invalid/model.json' } } } };
  const sources = [source(root), source({ 'a/b': { type: 'string' } }, 'a/model.json'), source({ $defs: { '~x': { type: 'integer' } } }, 'b/model.json'), source({ type: 'boolean' }, 'https://schemas.example.invalid/model.json')];
  const report = inspect({ entry: 'api.json', sources });
  assert.equal(report.diagnostics.length, 0);
  assert.deepEqual(report.references.map(r => r.target?.pointer), ['/a~1b', '/$defs/~0x', '']);
});
test('missing documents resolve incrementally and discover further missing files', () => {
  const root = { ...contract(), components: { schemas: { A: { $ref: './a.json' } } } };
  const first = inspect({ entry: 'api.json', sources: [source(root)] });
  assert.equal(first.references[0].missing, canonical('a.json'));
  const next = inspect({ entry: 'api.json', sources: [source(root), source({ $ref: './b.json' }, 'a.json')] });
  assert.equal(next.references[1].missing, canonical('b.json'));
  assert.ok(next.operations.length);
});
test('reference objects use version-specific description overrides', () => {
  for (const [version, expected] of [['3.0.4', 'original'], ['3.1.2', 'override'], ['3.2.0', 'override']]) {
    const root = { ...contract(version), paths: { '/': { get: { responses: { '200': { $ref: '#/components/responses/OK', description: 'override' } } } } }, components: { responses: { OK: { description: 'original' } } } };
    assert.equal(valueAt(run(root).operations[0].responses[0].item.value, '/description'), expected);
  }
});
test('schema ref siblings are preserved, never flattened or mistaken for Reference Object overrides', () => {
  const schema = { $ref: '#/components/schemas/Base', maxLength: 5 };
  const report = run({ ...contract(), components: { schemas: { Name: schema, Base: { type: 'string', minLength: 2 } } } });
  assert.deepEqual(report.schemas[0].item.value, schema);
  assert.equal(report.references[0].target?.pointer, '/components/schemas/Base');
});
test('references inside examples/extensions are data, not dependencies', () => {
  const report = run({ ...contract(), components: { schemas: { X: { type: 'object', example: { $ref: 'fake.json' }, 'x-data': { $ref: 'fake2.json' } } } } });
  assert.equal(report.references.length, 0);
});
test('3.2 custom operations and webhooks are inspectable', () => {
  const report = run({ ...contract('3.2.0'), paths: { '/': { query: operation, additionalOperations: { COPY: operation } } }, webhooks: { event: { post: operation } } });
  assert.deepEqual(report.operations.map(o => o.method), ['QUERY', 'COPY', 'POST']);
  assert.equal(report.operations[2].kind, 'Webhook');
});
test('imperfect entries leave valid operations available with exact diagnostic location', () => {
  const text = "openapi: 3.1.2\ninfo: {title: Test, version: '1'}\npaths:\n  /good:\n    get:\n      responses: {}\n  /bad:\n    get: 4\n";
  const r = inspect({ entry: 'a.yaml', sources: [{ id: 'a.yaml', text }] });
  assert.equal(r.operations.length, 1);
  assert.equal(r.diagnostics.find(d => d.code === 'OBJECT')?.location.line, 8);
});
test('unsupported schema scope never silently resolves against the wrong base', () => {
  const report = run({ ...contract(), components: { schemas: { X: { $id: 'other/', properties: { p: { $ref: 'model.json' } }, $dynamicRef: '#node' } } } });
  assert.equal(report.references.length, 0);
  assert.ok(report.diagnostics.some(d => d.code === 'SCHEMA_BASE'));
  assert.ok(report.diagnostics.some(d => d.code === 'DYNAMIC_REFERENCE'));
});
test('malformed JSON, duplicate YAML keys and aliases fail safely while source remains', () => {
  for (const [id, text] of [['a.json', '{"x":1,}'], ['a.yaml', 'x: 1\nx: 2'], ['a.yaml', 'a: &a [1]\nb: *a']]) {
    const report = inspect({ entry: id, sources: [{ id, text }] });
    assert.ok(report.diagnostics.length);
    assert.equal(report.documents[0].text, text);
    assert.equal(report.documents[0].value, undefined);
  }
});
test('hostile input and prototype pointer lookups are bounded', () => {
  assert.ok(inspect(null).diagnostics.length);
  assert.equal(valueAt({} as Value, '/__proto__'), undefined);
  assert.throws(() => canonical('file:///etc/passwd'));
  assert.throws(() => canonical('https://user:password@example.invalid/a'));
  assert.ok(inspect({ entry: 'a', sources: [{ id: 'a', text: 'x'.repeat(2_000_001) }] }).diagnostics.some(d => d.code === 'LIMIT'));
  let nested: unknown = 0; for (let i = 0; i < 100; i++) nested = { x: nested };
  assert.ok(run(nested).diagnostics.some(d => d.code === 'PARSE'));
});
test('unsupported version is source-only; no old-version interpretation', () => {
  const report = run(contract('4.0.0'));
  assert.equal(report.operations.length, 0);
  assert.ok(report.documents[0].value);
  assert.ok(report.diagnostics.some(d => d.code === 'VERSION'));
});

test('mixed OpenAPI reference versions are diagnosed before interpretation', () => {
  const root = { ...contract('3.1.2'), paths: { '/': { $ref: 'old.json#/paths/~1' } } };
  const older = { ...contract('3.0.4'), paths: { '/': { get: operation } } };
  const r = inspect({ entry: 'api.json', sources: [source(root), source(older, 'old.json')] });
  assert.ok(r.diagnostics.some(d => d.code === 'REFERENCE_VERSION'));
  assert.equal(r.operations.length, 0);
});
test('3.2 querystring conflicts and reserved header semantics are diagnosed', () => {
  const root = { ...contract('3.2.0'), paths: { '/': { get: { ...operation, parameters: [
    { in: 'querystring', name: 'query', content: { 'application/json': { schema: { type: 'object' } } } },
    { in: 'query', name: 'q', schema: { type: 'string' } },
    { in: 'header', name: 'Authorization', schema: { type: 'string' } },
  ] } } } };
  const r = run(root);
  assert.ok(r.diagnostics.some(d => d.code === 'QUERYSTRING_CONFLICT'));
  assert.ok(r.diagnostics.some(d => d.code === 'IGNORED_HEADER'));
  assert.equal(r.operations[0].parameters.length, 2);
});
test('schema maps with complex keys or imprecise integers are source-only', () => {
  for (const [id, text] of [['x.yaml', '? [a, b]\n: 1'], ['x.yaml', 'responses: {200: {description: OK}}'], ['x.json', '{"number":9007199254740993}']]) {
    const r = inspect({ entry: id, sources: [{ id, text }] });
    assert.equal(r.documents[0].value, undefined);
    assert.ok(r.diagnostics.some(d => d.code === 'PARSE'));
  }
});
test('source paths cannot substitute each other through canonical aliases', () => {
  const r = inspect({ entry: 'api.json', sources: [source(contract()), source(contract(), './x/../api.json')] });
  assert.ok(r.diagnostics.some(d => d.code === 'DUPLICATE_DOCUMENT'));
  assert.equal(r.documents.length, 1);
});
test('cyclic path reference chains stop with a diagnostic', () => {
  const root = { ...contract(), paths: { '/': { $ref: '#/components/pathItems/A' } }, components: { pathItems: { A: { $ref: '#/components/pathItems/B' }, B: { $ref: '#/components/pathItems/A' } } } };
  const r = run(root);
  assert.equal(r.operations.length, 0);
  assert.ok(r.diagnostics.some(d => d.code === 'REFERENCE_CYCLE'));
});
test('schema property names beginning x- are real properties, not ignored extensions', () => {
  const r = run({ ...contract(), components: { schemas: { X: { type: 'object', properties: { 'x-value': { $ref: 'missing.json' } } } } } });
  assert.equal(r.references[0].missing, canonical('missing.json'));
});
test('inline schema navigation exposes the schema source line, not its operation line', () => {
  const r = inspect({ entry: 'petstore.yaml', sources: [{ id: 'petstore.yaml', text: readFileSync('tests/fixtures/petstore.yaml', 'utf8') }] });
  assert.equal(r.locations.find(l => l.pointer === '/paths/~1pets/get/responses/200/content/application~1json/schema')?.line, 33);
});
