import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'yaml';
import { inspect, valueAt } from '../packages/engine/index.ts';
import { transform } from '../packages/engine/transform.ts';

export function bundleInput(version = '3.1.2', format = 'yaml') {
  const root = {
    openapi: version, info: { title: 'Bundle test', version: '1' },
    paths: { '/pets': { get: { responses: { '200': { $ref: './response.yaml' } } } } },
    components: { schemas: { pet: { type: 'integer' }, Local: { type: 'boolean' }, Other: { $ref: './b/pet.yaml' } } },
    'x-example': { $ref: 'example-data-not-a-reference.json' },
  };
  return { entry: `api.${format}`, sources: [
    { id: `api.${format}`, text: format === 'json' ? JSON.stringify(root) : '# Entry comment\n' + stringify(root) },
    { id: 'response.yaml', text: "# Response comment\ndescription: Pets\ncontent:\n  application/json:\n    schema:\n      $ref: './a/pet.yaml'\n    example:\n      $ref: ordinary-example-data\n" },
    { id: 'a/pet.yaml', text: `# Model comment\ntype: object\nproperties:\n  # Name comment\n  name: {type: string}\n  friend: {$ref: '../b/pet.yaml'}\n  self: {$ref: '#'}\n  local: {$ref: '../api.${format}#/components/schemas/Local'}\nx-custom: retained\n` },
    { id: 'b/pet.yaml', text: "type: object\nproperties:\n  other: {$ref: '../a/pet.yaml'}\n" },
  ] };
}
const config = (format = 'yaml') => ({ version: 1, rules: [], output: { bundle: true, format } });
function success(input: ReturnType<typeof bundleInput>, format = 'yaml') {
  const result = transform(input, config(format));
  assert.deepEqual(result.diagnostics, []); assert.equal(result.files.length, 1);
  const checked = inspect({ entry: result.files[0].id, sources: result.files });
  assert.deepEqual(checked.diagnostics, []);
  assert.ok(checked.references.every(r => r.uri.startsWith('#') && r.target?.document === checked.entry));
  return result;
}
for (const version of ['3.0.4', '3.1.2', '3.2.0']) for (const format of ['yaml', 'json']) test(`${version} ${format}: self-contained, deterministic and idempotent with duplicate basenames and mutual recursion`, () => {
  const input = bundleInput(version, format), original = structuredClone(input);
  const result = success(input, format), v = parse(result.files[0].text);
  assert.deepEqual(input, original);
  assert.equal(v.components.schemas.pet.type, 'integer');
  assert.equal(v.components.schemas.pet_2.properties.self.$ref, '#/components/schemas/pet_2');
  assert.equal(v.components.schemas.pet_2.properties.friend.$ref, '#/components/schemas/pet_3');
  assert.equal(v.components.schemas.pet_3.properties.other.$ref, '#/components/schemas/pet_2');
  assert.equal(v.components.schemas.pet_2.properties.local.$ref, '#/components/schemas/Local');
  assert.equal(v.components.schemas.pet_2['x-custom'], 'retained');
  assert.equal(v['x-example'].$ref, 'example-data-not-a-reference.json');
  assert.equal(v.components.responses.response.content['application/json'].example.$ref, 'ordinary-example-data');
  assert.deepEqual(success({ ...input, sources: [...input.sources].reverse() }, format).files, result.files);
  assert.deepEqual(transform({ entry: result.files[0].id, sources: result.files }, config(format)).files, result.files);
  if (format === 'yaml') {
    assert.match(result.files[0].text, /# Model comment\n\s+pet_2:|pet_2:\n\s+# Model comment/);
    assert.match(result.files[0].text, /# Name comment\n\s+name:/);
  } else assert.ok(result.changes.some(c => c.message.includes('JSON cannot retain YAML comments')));
});

test('missing files, schema scopes and malformed output settings block all output', () => {
  const input = bundleInput(); input.sources.pop();
  assert.equal(transform(input, config()).files.length, 0);
  const scoped = bundleInput(); scoped.sources[2].text += '$id: https://schemas.invalid/pet\n';
  assert.equal(transform(scoped, config()).files.length, 0);
  for (const output of [{ bundle: 'true', format: 'yaml' }, { bundle: true, format: ['yaml'] }, { bundle: true, format: 'xml' }, { bundle: true }, { bundle: true, format: 'json', surprise: 1 }]) {
    assert.equal(transform(bundleInput(), { version: 1, rules: [], output }).files.length, 0);
  }
});

test('bundling is optional and applies after transformations', () => {
  const input = bundleInput();
  assert.equal(transform(input, { version: 1, rules: [] }).files.length, 4);
  const root = parse(input.sources[0].text);
  root.paths['/pets'].post = { requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { pet: { $ref: './a/pet.yaml' } } } } } }, responses: { '204': { description: 'ok' } } };
  input.sources[0].text = stringify(root);
  const pointer = '/paths/~1pets/post/requestBody/content/application~1json/schema';
  const result = transform(input, { ...config(), rules: [{ id: 'extract', kind: 'extract-schema', target: { document: input.entry, pointer }, onMissing: 'error', name: 'Request', expected: valueAt(root, pointer) }] });
  assert.equal(result.files.length, 1);
  assert.equal(parse(result.files[0].text).components.schemas.Request.properties.pet.$ref, '#/components/schemas/pet_2');
});

test('overlapping targets, escaped fragments and boolean schemas retain targets', () => {
  const input = { entry: 'api.json', sources: [
    { id: 'api.json', text: JSON.stringify({ openapi: '3.1.2', info: { title: 'Pointers', version: '1' }, paths: {}, components: { schemas: { A: { $ref: 'models.json#/A' }, Child: { $ref: 'models.json#/A/properties/a~1b~0%20%25%23' }, Bool: { $ref: 'models.json#/Bool' } } } }) },
    { id: 'models.json', text: JSON.stringify({ A: { type: 'object', properties: { 'a/b~ %#': { type: 'string' }, '$ref': {type:'string'} } }, Bool: false }) },
  ] };
  const result = success(input, 'json'), v = parse(result.files[0].text);
  assert.equal(v.components.schemas.Child.$ref, '#/components/schemas/A_2/properties/a~1b~0%20%25%23');
  assert.equal(v.components.schemas.Bool_2, false);
  assert.equal(v.components.schemas.A_2.properties.$ref.type, 'string');
});

test('external URI mapping uses supplied bytes, never a basename or a fetch', () => {
  const input = bundleInput();
  input.sources[1].text = input.sources[1].text.replace('./a/pet.yaml', 'https://schemas.example.invalid/pet.yaml');
  input.sources.push({ id: 'https://schemas.example.invalid/pet.yaml', text: 'type: string\n' });
  const result = success(input);
  assert.equal(parse(result.files[0].text).components.schemas.pet_4.type, 'string');
});

test('discriminator, operationRef and moved relative URLs fail explicitly', () => {
  for (const addition of ['discriminator: {propertyName: kind}', 'externalDocs: {url: ./docs}', 'servers: [{url: ../api}]']) {
    const input = bundleInput(); input.sources[2].text += addition + '\n';
    const result = transform(input, config()); assert.equal(result.files.length, 0); assert.ok(result.diagnostics.length);
  }
  const input = bundleInput(); input.sources[1].text += 'links:\n  Next: {operationRef: ./paths.yaml#/next}\n';
  assert.match(transform(input, config()).diagnostics.join(), /operationRef/);
});

test('external path items bundle in all three families', () => {
  for (const version of ['3.0.4', '3.1.2', '3.2.0']) {
    const input = { entry: 'api.json', sources: [
      { id: 'api.json', text: JSON.stringify({ openapi: version, info: { title: 'Paths', version: '1' }, paths: { '/pets': { $ref: 'path.json' } } }) },
      { id: 'path.json', text: JSON.stringify({ get: { responses: { '200': { description: 'ok' } } } }) },
    ] };
    const result = success(input, 'json');
    assert.equal(inspect({ entry: result.files[0].id, sources: result.files }).operations.length, 1);
  }
});

test('unknown reference positions block instead of leaving external dependencies behind', () => {
  const input = bundleInput(); input.sources[2].text += 'unknownKeyword: {$ref: missing.yaml}\n';
  const result = transform(input, config());
  assert.equal(result.files.length, 0); assert.match(result.diagnostics.join(), /unrecognized \$ref/);
});

test('encoding headers are discovered and bundled while schema example data stays literal', () => {
  const input = bundleInput();
  input.sources[1].text += '  multipart/form-data:\n    schema: {type: object, example: {$ref: literal}}\n    encoding:\n      part:\n        headers:\n          X-Test: {$ref: header.yaml}\n';
  input.sources.push({id:'header.yaml',text:'schema: {type: string}\n'});
  const result = success(input);
  const v = parse(result.files[0].text);
  assert.equal(v.components.headers.header.schema.type, 'string');
  assert.equal(v.components.responses.response.content['multipart/form-data'].schema.example.$ref, 'literal');
  const newer = bundleInput('3.2.0');
  newer.sources[1].text += '  multipart/mixed:\n    prefixEncoding:\n      - headers:\n          X-Test: {$ref: header.yaml}\n';
  newer.sources.push({id:'header.yaml',text:'schema: {type: string}\n'});
  assert.equal(parse(success(newer).files[0].text).components.headers.header.schema.type, 'string');
  newer.sources[0].text = newer.sources[0].text.replace('3.2.0', '3.1.2');
  assert.equal(transform(newer, config()).files.length, 0);
});
