import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, symlink, link, readdir, rm, rename, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createArchive } from '../packages/engine/export.ts';
import persistence from '../apps/desktop/export.cjs';
const {ProtectedInputs, saveFile, saveDirectory, validateOutput}=persistence;
const bytes=createArchive({entry:'api.json',files:[{path:'api.json',text:'{}'}]});
async function fixture(t) { await mkdir('artifacts',{recursive:true});const root=await mkdtemp(resolve('artifacts/export-'));t.after(()=>rm(root,{recursive:true,force:true}));return root; }
const tree = () => ({entry:'api.json',files:[{path:'api.json',bytes:Buffer.from('{"openapi":"3.1.2"}')},{path:'schemas/pet.yaml',bytes:Buffer.from('type: string\n')}]});

test('directory export preserves nested names and exact bytes, replacing only non-source files',async t=>{
  const root=await fixture(t), output=tree(), inputs=new ProtectedInputs();
  await saveDirectory(root,output,inputs);
  for(const f of output.files)assert.deepEqual(await readFile(join(root,f.path)),f.bytes);
  await writeFile(join(root,'api.json'),'old'); await saveDirectory(root,output,inputs);
  for(const f of output.files)assert.deepEqual(await readFile(join(root,f.path)),f.bytes);
});
test('directory preflight rejects later source aliases and linked folders before any file is written',async t=>{
  const root=await fixture(t), output=tree(), source=join(root,'original.yaml'), inputs=new ProtectedInputs();
  await writeFile(source,'source');await inputs.add([source]);await mkdir(join(root,'schemas'));await link(source,join(root,'schemas/pet.yaml'));
  await assert.rejects(saveDirectory(root,output,inputs),/source file/);
  await assert.rejects(readFile(join(root,'api.json')),/ENOENT/);
  await rm(join(root,'schemas'),{recursive:true});await symlink(root,join(root,'schemas'));
  await assert.rejects(saveDirectory(root,output,inputs),/links/);
  await assert.rejects(readFile(join(root,'api.json')),/ENOENT/);
  assert.equal(await readFile(source,'utf8'),'source');
});
test('directory failure reports incomplete output and retains source bytes',async t=>{
  const root=await fixture(t), inputs=new ProtectedInputs(), snapshot=inputs.snapshot.bind(inputs);let calls=0;
  inputs.snapshot=async()=>{if(++calls===5)throw new Error('injected disk failure');return snapshot();};
  await assert.rejects(saveDirectory(root,tree(),inputs),/1 of 2 files saved; export is incomplete/);
  assert.deepEqual(await readFile(join(root,'api.json')),tree().files[0].bytes);
  await assert.rejects(readFile(join(root,'schemas/pet.yaml')),/ENOENT/);
});
test('native bridge independently rejects unsafe, colliding and oversized output payloads',()=>{
  for(const path of ['../escape','/absolute','a\\b','__proto__/x','nul.json','a:stream','a//b'])assert.throws(()=>validateOutput({entry:path,files:[{path,bytes:Buffer.from('{}')}]}));
  for(const paths of [['a','a'],['A/x','a/y'],['a','a/b'],['a/b','a'],['é/x','e\u0301/y']])assert.throws(()=>validateOutput({entry:paths[0],files:paths.map(path=>({path,bytes:Buffer.from('{}')}))}));
  assert.throws(()=>validateOutput({entry:'a',files:[{path:'a',bytes:new Uint8Array(20_000_001)}]}));
});

test('save exact bytes and safely replace existing non-source output',async t=>{
  const root=await fixture(t), out=join(root,'result.zip'), inputs=new ProtectedInputs();
  await saveFile(out,bytes,inputs); assert.deepEqual(new Uint8Array(await readFile(out)),bytes);
  await writeFile(out,'old output'); await saveFile(out,bytes,inputs); assert.deepEqual(new Uint8Array(await readFile(out)),bytes);
  assert.deepEqual(await readdir(root),['result.zip']);
});
test('source paths, symlinks, hardlinks and symlinked parents cannot be overwritten',async t=>{
  const root=await fixture(t), original=join(root,'source.zip'), inputs=new ProtectedInputs();
  await writeFile(original,'source'); await inputs.add([original]);
  await symlink(original,join(root,'sym.zip')); await link(original,join(root,'hard.zip')); await symlink(root,join(root,'alias'));
  for(const output of [original,join(root,'sym.zip'),join(root,'hard.zip'),join(root,'alias/source.zip')]) await assert.rejects(saveFile(output,bytes,inputs),/source|symlink/);
  assert.equal(await readFile(original,'utf8'),'source'); assert.equal(await readFile(join(root,'hard.zip'),'utf8'),'source');
});
test('current and original file identities are protected after source replacement',async t=>{
  const root=await fixture(t), original=join(root,'source.zip'), inputs=new ProtectedInputs();
  await writeFile(original,'original'); await inputs.add([original]); await rename(original,join(root,'old-source.zip')); await writeFile(original,'new source'); await link(original,join(root,'new-alias.zip'));
  for(const output of [join(root,'old-source.zip'),join(root,'new-alias.zip')]) await assert.rejects(saveFile(output,bytes,inputs),/source/);
});
test('failure before final rename preserves previous output and removes staging',async t=>{
  const root=await fixture(t), output=join(root,'result.zip'); await writeFile(output,'previous');
  const inputs=new ProtectedInputs(), snapshot=inputs.snapshot.bind(inputs); let checks=0;
  inputs.snapshot=async()=>{if(++checks===2)throw new Error('injected pre-commit failure');return snapshot();};
  await assert.rejects(saveFile(output,bytes,inputs),/injected/); assert.equal(await readFile(output,'utf8'),'previous');assert.deepEqual(await readdir(root),['result.zip']);
});
test('changed output, unsafe filename and malformed bytes fail without overwriting',async t=>{
  const root=await fixture(t), output=join(root,'result.zip'); await writeFile(output,'previous');
  const inputs=new ProtectedInputs(), snapshot=inputs.snapshot.bind(inputs); let checks=0;
  inputs.snapshot=async()=>{if(++checks===2)await writeFile(output,'concurrent edit');return snapshot();};
  await assert.rejects(saveFile(output,bytes,inputs),/changed/);assert.equal(await readFile(output,'utf8'),'concurrent edit');
  for(const target of ['nul.zip','source:stream.zip'])await assert.rejects(saveFile(join(root,target),bytes,new ProtectedInputs()));
  await assert.rejects(saveFile(output,[1,2],new ProtectedInputs()));
  assert.deepEqual(await readdir(root),['result.zip']);
});
