import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { inspect, valueAt, type Value } from '../packages/engine/index.ts';
import { transform, suggestSchemaName, type Rule } from '../packages/engine/transform.ts';
const yaml = readFileSync('tests/fixtures/transform.yaml', 'utf8');
const content = '/paths/~1pets/post/requestBody/content';
const schema = content + '/application~1json/schema';
const source = (text = yaml, id = 'api.yaml') => ({ entry: id, sources: [{ id, text }] });
function rules(input = source()): Rule[] {
  const r = inspect(input), document = r.entry;
  return [
    { id: 'extract', kind: 'extract-schema', target: { document, pointer: schema }, name: 'CreatePetRequest', expected: valueAt(r.documents[0].value, schema)!, onMissing: 'error' },
    { id: 'media', kind: 'select-media', target: { document, pointer: content }, expectedTypes: ['application/json', 'application/problem+json', 'application/xml'], keep: ['application/json', 'application/problem+json'], onMissing: 'error' },
  ];
}
const run = (input = source(), selected = rules(input)) => transform(input, { version: 1, rules: selected });

for (const version of ['3.0.4', '3.1.2', '3.2.0']) for (const format of ['yaml', 'json']) test(`${version} ${format}: two rules preserve meaning, comments, extensions and source; byte-idempotent replay`, () => {
  const text = yaml.replace('3.1.2', version);
  const input = source(format === 'yaml' ? text : JSON.stringify(parse(text)), `api.${format}`);
  const original = structuredClone(input), selected = rules(input), output = run(input, selected);
  assert.equal(output.files.length, 1, JSON.stringify(output));
  const value = parse(output.files[0].text);
  assert.deepEqual(valueAt(value, schema), { $ref: '#/components/schemas/CreatePetRequest' });
  assert.deepEqual(value.components.schemas.CreatePetRequest, (selected[0] as {expected: Value}).expected);
  assert.equal(valueAt(value, content + '/application~1xml'), undefined);
  assert.equal(valueAt(value, content + '/x-note'), 'preserve unknown content extension');
  assert.equal(value['x-context'], 'Keep unknown root information');
  assert.deepEqual(input, original);
  const replay = run({ entry: input.entry, sources: output.files }, selected);
  assert.deepEqual(replay.files, output.files);
  assert(replay.changes.every(c => c.status === 'already-applied'));
  assert.deepEqual(run(input, selected), output);
  if (format === 'yaml') {
    assert(output.files[0].text.includes('# Model comment travels with the schema'));
    assert(output.files[0].text.indexOf('# Model comment travels with the schema') > output.files[0].text.indexOf('components:'));
    assert(output.files[0].text.indexOf('# Media context stays at the original location') < output.files[0].text.indexOf('components:'));
    assert(output.changes.some(c => c.message.includes('Surrounding YAML comments')));
    assert(output.files[0].text.includes('# Keep property comment'));
    assert(output.changes.some(c => c.status === 'warning'));
  }
});

test('explicit one or several media types, no match, and media-before-extraction compose', () => {
  const selected = rules();
  const media = selected[1]; if (media.kind !== 'select-media') throw new Error();
  media.keep = ['application/json'];
  assert.equal(run(source(), [media, selected[0]]).files.length, 1);
  media.keep = ['text/plain'];
  const output = run(source(), [media]);
  assert.equal(output.changes[0].status, 'unchanged');
  assert.equal(output.files[0].text, yaml);
});

test('name suggestions use operationId, method/path fallback and nested property context', () => {
  const op = inspect(source()).operations[0];
  assert.equal(suggestSchemaName(op, schema), 'CreatePetRequest');
  assert.equal(suggestSchemaName(op, schema + '/properties/address'), 'CreatePetRequestAddress');
  assert.equal(suggestSchemaName({...op, raw: {}}, schema), 'PostPetsRequest');
  assert.equal(suggestSchemaName({...op, raw: {operationId:'123'}}, schema), 'Model123Request');
});

test('collisions, changed schema preconditions and changed media offerings block all output', () => {
  const selected = rules();
  for (const change of [
    (v: any) => { v.components = { schemas: { CreatePetRequest: {type: 'string'} } }; },
    (v: any) => { (valueAt(v, schema) as any).description = 'Changed'; },
    (v: any) => { (valueAt(v, content) as any)['text/plain'] = {schema:{type:'string'}}; },
  ]) {
    const v = parse(yaml); change(v);
    const output = run(source(JSON.stringify(v)), selected);
    assert.equal(output.files.length, 0);
    assert(output.changes.some(c => c.status === 'error'));
  }
});

test('missing target policy is explicit; excluded rules do not run', () => {
  const selected = rules(); selected[0].target.pointer += '/missing';
  assert.equal(run(source(), selected).files.length, 0);
  selected[0].onMissing = 'warning';
  assert.equal(run(source(), selected).files.length, 1);
  assert.equal(run(source(), []).files[0].text, yaml);
});

test('malformed configuration, duplicate IDs and hostile pointers fail safely', () => {
  for (const config of [null, {version:2,rules:[]}, {version:1,rules:[...rules(),rules()[0]]}, {version:1,rules:[{...rules()[0],target:{document:'api.yaml',pointer:'/__proto__/polluted'}}]}, {version:1,rules:[{...rules()[1],keep:[]}]}]) {
    const output = transform(source(), config);
    assert.equal(output.files.length, 0);
  }
  assert.equal(({} as any).polluted, undefined);
});

test('missing references and unsupported scope block preview instead of producing partial output', () => {
  for (const extra of [{ $ref: './missing.yaml' }, { $id:'https://example.invalid/model',type:'object' }]) {
    const v = parse(yaml); (valueAt(v, schema) as any).properties.extra = extra;
    assert.equal(run(source(JSON.stringify(v))).files.length, 0);
  }
});

test('external recursive dependencies remain separate and relative references retain their base', () => {
  const v = parse(yaml); (valueAt(v, schema) as any).properties.friend = {$ref:'../models/pet.yaml'};
  const input = {entry:'contracts/api.json',sources:[{id:'contracts/api.json',text:JSON.stringify(v)},{id:'models/pet.yaml',text:'type: object\nproperties:\n  friend: {$ref: "#"}\n'}]};
  const output = run(input);
  assert.equal(output.files.length, 2, JSON.stringify(output));
  assert.equal(output.files[1].text, input.sources[1].text);
  assert.deepEqual(parse(output.files[0].text).components.schemas.CreatePetRequest.properties.friend, {$ref:'../models/pet.yaml'});
});

test('referenced operation or inbound inline-schema references cannot silently change other uses', () => {
  const v = parse(yaml); v.components = {schemas:{Other:{$ref:'#'+schema}}};
  assert.equal(run(source(JSON.stringify(v))).files.length, 0);
  delete v.components;
  v.paths['/alias'] = {$ref:'#/paths/~1pets'};
  assert.equal(run(source(JSON.stringify(v))).files.length, 0);
});

test('nested request, inline parameter and response schemas extract at their exact targets', () => {
  const original = parse(yaml);
  original.paths['/pets'].post.parameters = [{name:'filter',in:'query',schema:{type:'object',properties:{name:{type:'string'}}}}];
  for (const pointer of [schema+'/properties/address','/paths/~1pets/post/parameters/0/schema','/paths/~1pets/post/responses/201/content/application~1json/schema']) {
    const input=source(JSON.stringify(original));
    const expected=valueAt(original,pointer)!;
    const selected:Rule[]=[{id:'nested',kind:'extract-schema',target:{document:'api.yaml',pointer},name:'SharedModel',expected,onMissing:'error'}];
    const output=run(input,selected);
    assert.equal(output.files.length,1,JSON.stringify(output));
    const value=parse(output.files[0].text);
    assert.deepEqual(valueAt(value,pointer),{$ref:'#/components/schemas/SharedModel'});
    assert.deepEqual(value.components.schemas.SharedModel,expected);
    assert.deepEqual(run({entry:input.entry,sources:output.files},selected).files,output.files);
  }
});

test('existing component comments survive and referenced media cannot be removed', () => {
  const withComponents=yaml+'components:\n  schemas:\n    # Existing model stays\n    Existing: {type: string}\n';
  const output=run(source(withComponents));
  assert.equal(output.files.length,1,JSON.stringify(output));
  assert(output.files[0].text.includes('# Existing model stays'));
  assert.deepEqual(parse(output.files[0].text).components.schemas.Existing,{type:'string'});
  const v=parse(yaml);
  v.components={schemas:{UseXml:{$ref:'#'+content+'/application~1xml/schema'}}};
  const input=source(JSON.stringify(v));
  const result=run(input,[rules(input)[1]]);
  assert.equal(result.files.length,0);
  assert(result.changes.some(c=>c.message.includes('referenced elsewhere')));
});

test('callback media targets belong to the nearest operation, not its enclosing operation', () => {
  const v=parse(yaml);
  const callbackOperation = {
    requestBody: { content: {
      'application/json': { schema: { type: 'object' } },
      'text/plain': { schema: { type: 'string' } },
    } },
    responses: { '200': { description: 'OK' } },
  };
  v.paths['/pets'].post.callbacks = { notify: { '/notice': { post: callbackOperation } } };
  const input=source(JSON.stringify(v));
  const selected:Rule[]=[{id:'callback',kind:'select-media',target:{document:'api.yaml',pointer:'/paths/~1pets/post/callbacks/notify/~1notice/post/requestBody/content'},onMissing:'error',expectedTypes:['application/json','text/plain'],keep:['application/json']}];
  const output=run(input,selected);
  assert.equal(output.files.length,1,JSON.stringify(output));
  assert.equal(valueAt(parse(output.files[0].text),selected[0].target.pointer+'/text~1plain'),undefined);
});
