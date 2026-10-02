import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { unzipSync, strFromU8 } from 'fflate';
import { createArchive, createDownload, createOutput, prepareExport } from '../packages/engine/export.ts';
import { transform } from '../packages/engine/transform.ts';
import { inspect } from '../packages/engine/index.ts';

const input = { entry: 'petstore.yaml', sources: ['petstore.yaml', 'schemas/pet.yaml'].map(id => ({id,text:readFileSync('tests/fixtures/' + id,'utf8')})) };
test('single downloads are raw reviewed YAML/JSON; multiple downloads preserve the archive tree', () => {
  for (const format of ['yaml', 'json']) {
    const preview = transform(input, {version:1, rules:[], output:{bundle:true,format}});
    const download = createDownload(preview.exportPlan), output = createOutput(preview.exportPlan);
    assert.equal(download.name, 'specrefit-bundled.' + format);
    assert.equal(strFromU8(download.bytes), preview.files[0].text);
    assert.deepEqual(download.bytes, output.files[0].bytes);
  }
  const preview = transform(input, {version:1,rules:[]});
  assert.deepEqual(createDownload(preview.exportPlan).bytes, createArchive(preview.exportPlan));
  assert.equal(createDownload({entry:'api.txt',files:[{path:'api.txt',text:'{}'}]}).name,'api.txt.json');
  assert.throws(()=>createOutput({entry:'../api',files:[{path:'../api',text:'{}'}]}));
});
test('retained output exports exact preview bytes with folders and working references', () => {
  const preview = transform(input, {version:1,rules:[]});
  assert.deepEqual(preview.exportDiagnostics, []);
  const zip = createArchive(preview.exportPlan), files = unzipSync(zip);
  assert.deepEqual(Object.keys(files), ['petstore.yaml','schemas/pet.yaml']);
  for (const file of preview.exportPlan!.files) assert.equal(strFromU8(files[file.path]), file.text);
  assert.deepEqual(inspect({entry:preview.exportPlan!.entry,sources:Object.entries(files).map(([id,bytes])=>({id,text:strFromU8(bytes)}))}).diagnostics, []);
  assert.deepEqual(createArchive({...preview.exportPlan,files:[...preview.exportPlan!.files].reverse()}),zip);
});
test('YAML and JSON bundles export just the reviewed file', () => {
  for (const format of ['yaml','json']) {
    const preview=transform(input,{version:1,rules:[],output:{bundle:true,format}});
    assert.deepEqual(preview.exportDiagnostics, []);
    const files=unzipSync(createArchive(preview.exportPlan));
    assert.deepEqual(Object.keys(files), [`specrefit-bundled.${format}`]);
    assert.equal(strFromU8(files[`specrefit-bundled.${format}`]),preview.files[0].text);
  }
});
test('ZIP metadata is independent of timezone and clock', () => {
  const source = "import {createArchive} from './packages/engine/export.ts'; console.log(Buffer.from(createArchive({entry:'api.json',files:[{path:'api.json',text:'{}'}]})).toString('hex'));";
  const outputs=['UTC','Pacific/Honolulu','Europe/Amsterdam','Asia/Tokyo'].map(TZ=>execFileSync(process.execPath,['--input-type=module','-e',source],{env:{...process.env,TZ},encoding:'utf8'}));
  assert.ok(outputs.every(s=>s===outputs[0]));
});
test('archive traversal, device names, collisions and hostile payloads fail closed', () => {
  for (const path of ['../api.yaml','/api.yaml','a/../../x','a//x','a\\x','C:/x','nul.json','a/COM1.yaml','a:L.yaml','a/file.','a/file ','a/\u0000x','__proto__','a/\ud800']) {
    assert.throws(()=>createArchive({entry:path,files:[{path,text:'{}'}]}),/unsafe/);
  }
  for (const names of [['a.yaml','A.yaml'],['a','a/b'],['a/b','a'],['a/x','A/y'],['caf\u00e9.yaml','cafe\u0301.yaml'],['a.yaml','a.yaml']])
    assert.throws(()=>createArchive({entry:names[0],files:names.map(path=>({path,text:'{}'}))}));
  for(const plan of [null, {entry:'missing',files:[{path:'api',text:'{}'}]}, {entry:'a',files:[{path:'a',text:7}]}, {entry:'a',files:[{path:'a',text:'x'.repeat(20_000_001)}]}]) assert.throws(()=>createArchive(plan));
});
test('non-portable reference locations retain preview but require bundling for export', () => {
  for(const uri of ['https://project.invalid/schemas/pet.yaml','/schemas/pet.yaml']) {
    const changed=structuredClone(input); changed.sources[0].text=changed.sources[0].text.replaceAll('./schemas/pet.yaml',uri);
    const preview=transform(changed,{version:1,rules:[]});
    assert.equal(preview.files.length,2); assert.equal(preview.exportPlan,undefined); assert.match(preview.exportDiagnostics!.join(),/bundl/i);
    assert.ok(transform(changed,{version:1,rules:[],output:{bundle:true,format:'yaml'}}).exportPlan);
  }
  const changed=structuredClone(input); changed.sources[0].text=changed.sources[0].text.replaceAll('./schemas/pet.yaml','https://other.invalid/pet.yaml'); changed.sources[1].id='https://other.invalid/pet.yaml';
  assert.equal(transform(changed,{version:1,rules:[]}).exportPlan,undefined);
  assert.ok(transform(changed,{version:1,rules:[],output:{bundle:true,format:'json'}}).exportPlan);
});
test('escaping relative paths and encoded separators are not exported as broken trees', () => {
  const changed=structuredClone(input); changed.sources[0].text=changed.sources[0].text.replaceAll('./schemas/pet.yaml','../schemas/pet.yaml');
  assert.match(prepareExport(changed.entry,changed.sources).diagnostics.join(),/escape/);
  const bad=structuredClone(input); bad.sources[1].id='schemas%2Fpet.yaml'; bad.sources[0].text=bad.sources[0].text.replaceAll('./schemas/pet.yaml','schemas%2Fpet.yaml');
  assert.match(prepareExport(bad.entry,bad.sources).diagnostics.join(),/separator/);
});

test('single files with filename-based self-references require bundling before a renameable save',()=>{
  const input={entry:'api.json',sources:[{id:'api.json',text:JSON.stringify({openapi:'3.1.2',info:{title:'Self',version:'1'},paths:{},components:{schemas:{A:{type:'string'},B:{$ref:'api.json#/components/schemas/A'}}}})}]};
  const preview=transform(input,{version:1,rules:[]});
  assert.equal(preview.exportPlan,undefined);
  assert.match(preview.exportDiagnostics!.join(),/self-reference/);
  assert.ok(transform(input,{version:1,rules:[],output:{bundle:true,format:'json'}}).exportPlan);
});
