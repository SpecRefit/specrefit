import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { desktopTargets, desktopTarget, nativeVersion } from '../scripts/desktop-target.mjs';
import { assembleDevelopment, requireCompleteDownloads } from '../scripts/assemble-development.mjs';
import { writeInventory, verifyInventory } from '../scripts/development-artifacts.mjs';

const build={version:'0.0.0-dev+g'+'a'.repeat(12),commit:'a'.repeat(40),dirty:false,tag:null};
async function fixture(t) {
  await mkdir('.cache',{recursive:true});const root=await mkdtemp(resolve('.cache/package-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const input=join(root,'input'),output=join(root,'output');await mkdir(input);
  for(const id of desktopTargets) {
    const [platform,arch]=id.split('-'),target=desktopTarget(platform,arch),dir=join(input,'development-'+id);
    await mkdir(dir);await writeFile(join(dir,target.archive),'native fixture '+id);
    if(platform==='linux')await writeFile(join(dir,'specrefit-web.tar.gz'),'web fixture');
    await writeInventory(dir,build);
  }
  return {input,output};
}
test('native package names and version fields are explicit and bounded',()=>{
  assert.equal(desktopTarget('win32','x64').executable,'SpecRefit.exe');
  assert.equal(desktopTarget('darwin','arm64').executable,'SpecRefit.app/Contents/MacOS/SpecRefit');
  assert.equal(desktopTarget('darwin','x64').archive,'specrefit-desktop-darwin-x64.zip');
  assert.throws(()=>desktopTarget('win32','arm64'));
  assert.equal(nativeVersion('1.2.3-beta+abc'),'1.2.3');
  assert.equal(nativeVersion(build.version),'0.0.0');
  assert.throws(()=>nativeVersion('70000.0.0'));
});
test('assembly verifies all native groups and publishes one exact complete inventory',async t=>{
  const {input,output}=await fixture(t);const result=await assembleDevelopment(input,output,build.commit);
  assert.equal(result.files.length,5);requireCompleteDownloads(result.files);
  assert.deepEqual(await verifyInventory(output,build.commit),result);
  assert.equal(await readFile(join(output,'specrefit-desktop-win32-x64.zip'),'utf8'),'native fixture win32-x64');
});
test('missing, corrupt, mixed-commit and unexpected artifacts cannot replace a previous inventory',async t=>{
  for(const mode of ['missing','corrupt','commit','extra']) {
    const {input,output}=await fixture(t);await mkdir(output);await writeFile(join(output,'previous'),'keep');
    const dir=join(input,'development-win32-x64');
    if(mode==='missing')await rm(dir,{recursive:true});
    if(mode==='corrupt')await writeFile(join(dir,'specrefit-desktop-win32-x64.zip'),'bad');
    if(mode==='commit')await writeInventory(dir,{...build,commit:'b'.repeat(40),version:'0.0.0-dev+g'+'b'.repeat(12)});
    if(mode==='extra'){await writeFile(join(dir,'extra.zip'),'extra');await writeInventory(dir,build);}
    await assert.rejects(assembleDevelopment(input,output,build.commit));
    assert.equal(await readFile(join(output,'previous'),'utf8'),'keep');
  }
  assert.throws(()=>requireCompleteDownloads([{name:'specrefit-web.tar.gz'}]));
});
