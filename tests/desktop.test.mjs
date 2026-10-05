import test from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
import { readFile, mkdtemp, writeFile, link, rm, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { inspect, valueAt } from '../packages/engine/index.ts';
import { transform } from '../packages/engine/transform.ts';
import { createOutput } from '../packages/engine/export.ts';
import { desktopTarget, packageRoot } from '../scripts/desktop-target.mjs';

const packaged = !!process.env.SPECREFIT_TEST_PACKAGE;
function launch() {
  if (!packaged) return electron.launch({ args: ['.'] });
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'));
  return electron.launch({ executablePath: join(packageRoot(), desktopTarget().executable), args: [], env: { ...env, PATH: '' } });
}

test('native window resizing keeps details and compact navigation usable', async () => {
  const application=await launch();
  try {
    const page=await application.firstWindow();
    await page.getByRole('button',{name:'Explore an example'}).click();
    await page.getByRole('heading',{name:'Find your next companion',exact:true}).waitFor();
    for(const [width,height] of [[900,600],[600,500],[480,500],[1200,800]]) {
      await application.evaluate(({BrowserWindow}, size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
      await page.waitForFunction(w=>innerWidth===w,width);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert((await page.locator('#content').boundingBox()).height>190);
      if(width<=800) {
        const toggle=page.getByRole('button',{name:'Operations & filters',exact:true});
        await toggle.click();
        await page.locator('.operation-button').first().click();
        assert.equal(await toggle.getAttribute('aria-expanded'),'false');
        assert(await page.locator('#content').isVisible());
      }
    }
  } finally {await application.close();}
});

test('sandboxed Electron uses the same worker and UI without renderer privileges', async () => {
  const application = await launch();
  try {
    const page = await application.firstWindow();
    await page.getByRole('button', { name: 'Explore an example' }).click();
    await page.getByRole('heading', { name: 'Find your next companion', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => typeof globalThis.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof globalThis.process), 'undefined');
    const preferences = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(preferences.sandbox, true); assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false);
    const sources = await Promise.all(['petstore.yaml', 'schemas/pet.yaml'].map(async id => ({ id, text: await readFile(`tests/fixtures/${id}`, 'utf8') })));
    const input = { entry: 'petstore.yaml', sources };
    const report = await page.evaluate(input => new Promise((resolve, reject) => { const w = new Worker('./worker.js', { type: 'module' }); w.onmessage = e => { w.terminate(); resolve(e.data.report); }; w.onerror = reject; w.postMessage(input); }), input);
    assert.deepEqual(report, inspect(input));
    for (const format of ['yaml', 'json']) {
      const config = { version: 1, rules: [], output: { bundle: true, format } };
      const bundled = await page.evaluate(({input,config}) => new Promise((resolve,reject) => {const w=new Worker('./worker.js',{type:'module'});w.onmessage=e=>{w.terminate();resolve(e.data.preview)};w.onerror=reject;w.postMessage({action:'transform',input,config});}), {input,config});
      assert.deepEqual(bundled, transform(input,config));
      assert.equal(bundled.files.length, 1);
    }
    const transformInput = { entry: 'api.yaml', sources: [{ id: 'api.yaml', text: await readFile('tests/fixtures/transform.yaml', 'utf8') }] };
    const target = { document: 'api.yaml', pointer: '/paths/~1pets/post/requestBody/content' };
    const schemaPointer = target.pointer + '/application~1json/schema';
    const expected = valueAt(inspect(transformInput).documents[0].value, schemaPointer);
    const config = { version: 1, rules: [
      { id: 'extract', kind: 'extract-schema', target: {...target, pointer: schemaPointer}, name: 'Input', expected, onMissing: 'error' },
      { id: 'media', kind: 'select-media', target, expectedTypes: ['application/json', 'application/problem+json', 'application/xml'], keep: ['application/json'], onMissing: 'error' },
    ] };
    const actual = await page.evaluate(({input,config}) => new Promise((resolve,reject) => {const w=new Worker('./worker.js',{type:'module'});w.onmessage=e=>{w.terminate();resolve(e.data.preview)};w.onerror=reject;w.postMessage({action:'transform',input,config});}), {input:transformInput,config});
    assert.deepEqual(actual, transform(transformInput,config));
    assert.equal(actual.files.length, 1);
    const mediaSources = await Promise.all(['media-preference.yaml', 'media-components.yaml'].map(async id => ({ id, text: await readFile(`tests/fixtures/${id}`, 'utf8') })));
    const mediaInput = { entry: 'media-preference.yaml', sources: mediaSources };
    const mediaConfig = { version: 1, rules: [{ id: 'contract-media', kind: 'select-contract-media', keep: ['application/xml', 'multipart/form-data'] }] };
    const mediaPreview = await page.evaluate(({ input, config }) => new Promise((resolve, reject) => { const w = new Worker('./worker.js', { type: 'module' }); w.onmessage = e => { w.terminate(); resolve(e.data.preview); }; w.onerror = reject; w.postMessage({ action: 'transform', input, config }); }), { input: mediaInput, config: mediaConfig });
    assert.deepEqual(mediaPreview, transform(mediaInput, mediaConfig));
    await page.screenshot({ path: 'artifacts/electron-operation.png', fullPage: true });
  } finally { await application.close(); }
});

test('portable bundle starts with no Node installation on its PATH', { skip: !process.env.SPECREFIT_TEST_PACKAGE }, async () => {
  const application = await launch();
  try {
    const page = await application.firstWindow();
    await page.getByRole('button', { name: 'Explore an example' }).click();
    await page.getByRole('heading', { name: 'Find your next companion', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => typeof globalThis.process), 'undefined');
    const built = JSON.parse(await readFile('dist/web/version.json', 'utf8'));
    assert.equal(await application.evaluate(({ app }) => app.getVersion()), built.version);
    assert.equal(await page.locator('.preview').textContent(), built.version);
    // Windows removes empty environment variables; neither form may expose a runtime search path.
    assert.deepEqual(await application.evaluate(() => Object.entries(process.env).filter(([key,value]) => key.toLowerCase() === 'path' && value)), []);
    assert.equal(await application.evaluate(() => process.arch), process.arch);
    assert.equal(await application.evaluate(({app}) => app.isPackaged), true);
    const root=join(packageRoot(),desktopTarget().resources,'app');
    assert.equal(await readFile(join(root,'LICENSE'),'utf8'),await readFile('LICENSE','utf8'));
    assert.equal(await readFile(join(root,'dist/web/THIRD_PARTY_NOTICES.txt'),'utf8'),await readFile('dist/web/THIRD_PARTY_NOTICES.txt','utf8'));
    assert.equal(await page.evaluate(async()=>{try {await fetch('https://example.invalid/blocked');return false;}catch{return true;}}),true);
  } finally { await application.close(); }
});

test('desktop exports through a scoped bridge, handles cancellation and protects actual selected sources', async () => {
  const root=await mkdtemp(resolve('artifacts/desktop-export-'));
  const source=resolve(root,'api.json'), alias=resolve(root,'alias.json'), output=resolve(root,'result.json');
  const text='{"openapi":"3.1.2","info":{"title":"Export","version":"1"},"paths":{}}';
  await writeFile(source,text); await link(source,alias);
  const application=await launch();
  try {
    const page=await application.firstWindow();
    await page.evaluate(()=>{location.hash='content';});
    assert.deepEqual(await page.evaluate(()=>Object.keys(window.specRefitDesktop).sort()),['importLocalReferences','protectInputs','saveOutput']);
    await page.getByLabel('Open contract files',{exact:true}).setInputFiles(source);
    await page.getByRole('button',{name:'Rules and preview',exact:true}).click();
    await page.getByRole('button',{name:'Preview these rules'}).click();
    const save=page.getByRole('button',{name:'Export reviewed output'});
    await save.waitFor();
    // Exercise production saving while substituting only the user's native-dialog response.
    await application.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true,filePath:''});});
    await save.click(); await page.getByRole('status').filter({hasText:'Export cancelled'}).waitFor();
    for(const filePath of [source,alias]) {
      await application.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},filePath);
      await save.click(); await page.getByRole('alert').filter({hasText:'source file'}).waitFor();
      assert.equal(await readFile(source,'utf8'),text);
    }
    await application.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},output);
    await save.click(); await page.getByRole('status').filter({hasText:'Reviewed output saved'}).waitFor();
    const expected=transform({entry:'api.json',sources:[{id:'api.json',text}]},{version:1,rules:[],output:{bundle:false,format:'yaml'}});
    assert.deepEqual(new Uint8Array(await readFile(output)),createOutput(expected.exportPlan).files[0].bytes);
    assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
    assert.equal(await readFile(source,'utf8'),text);
  } finally {await application.close();await rm(root,{recursive:true,force:true});}
});

test('desktop saves multiple reviewed files into the chosen folder without a ZIP', async () => {
  const root=await mkdtemp(resolve('artifacts/desktop-folder-'));
  const application=await launch();
  try {
    const page=await application.firstWindow();
    await page.getByRole('button',{name:'Explore an example'}).click();
    await page.getByRole('button',{name:'Rules and preview',exact:true}).click();
    await page.getByRole('button',{name:'Preview these rules'}).click();
    const save=page.getByRole('button',{name:'Export reviewed output'});
    await application.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
    await save.click();await page.getByRole('status').filter({hasText:'Export cancelled'}).waitFor();
    await application.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},root);
    await save.click();await page.getByRole('status').filter({hasText:'Reviewed output saved'}).waitFor();
    const sources=await Promise.all(['petstore.yaml','schemas/pet.yaml'].map(async id=>({id,text:await readFile('tests/fixtures/'+id,'utf8')})));
    const expected=transform({entry:'petstore.yaml',sources},{version:1,rules:[]});
    const written=[];
    for(const f of expected.exportPlan.files) {
      const text=await readFile(resolve(root,f.path),'utf8');
      assert.equal(text,f.text);written.push({id:f.path,text});
    }
    assert.deepEqual(inspect({entry:expected.exportPlan.entry,sources:written}).diagnostics,[]);
    await assert.rejects(readFile(resolve(root,'specrefit-output.zip')),/ENOENT/);
  } finally {await application.close();await rm(root,{recursive:true,force:true});}
});

test('opening one desktop file loads its references and protects their hardlinks during bundled export', async () => {
  const root = await mkdtemp(resolve('artifacts/desktop-references-'));
  const source = join(root, 'api.json'), foundation = join(root, 'components/foundation-schemas.json'), workflow = join(root, 'components/workflow-schemas.json'), alias = join(root, 'alias.json'), output = join(root, 'result.yaml');
  await mkdir(join(root, 'components'));
  const files = {
    'api.json': JSON.stringify({ openapi: '3.0.4', info: { title: 'Local reference test', version: '1' }, paths: {}, components: { schemas: { Foundation: { $ref: 'components/foundation-schemas.json#/Foundation' }, Workflow: { $ref: 'components/workflow-schemas.json#/Workflow' } } } }),
    'components/foundation-schemas.json': '{"Foundation":{"type":"string"}}',
    'components/workflow-schemas.json': '{"Workflow":{"type":"object","properties":{"foundation":{"$ref":"foundation-schemas.json#/Foundation"}}}}',
  };
  for (const [name, text] of Object.entries(files)) await writeFile(join(root, name), text);
  await link(foundation, alias);
  const application = await launch();
  try {
    const page = await application.firstWindow();
    await page.getByLabel('Open contract files', { exact: true }).setInputFiles(source);
    await page.locator('.toolbar').getByText('OpenAPI 3.0.4 · 3 files', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Diagnostics', exact: true }).click();
    await page.getByText('No issues found by the available inspection checks.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Rules and preview', exact: true }).click();
    await page.getByLabel('Bundle external references into one file', { exact: true }).check();
    await page.getByRole('button', { name: 'Preview these rules' }).click();
    const save = page.getByRole('button', { name: 'Export reviewed output' });
    await save.waitFor();
    for (const filePath of [foundation, workflow, alias]) {
      await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, filePath);
      await save.click(); await page.getByRole('alert').filter({ hasText: 'source file' }).waitFor();
    }
    await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, output);
    await save.click(); await page.getByRole('status').filter({ hasText: 'Reviewed output saved' }).waitFor();
    const expected = transform({ entry: 'api.json', sources: Object.entries(files).map(([id, text]) => ({ id, text })) }, { version: 1, rules: [], output: { bundle: true, format: 'yaml' } });
    assert.deepEqual(new Uint8Array(await readFile(output)), createOutput(expected.exportPlan).files[0].bytes);
    for (const [name, text] of Object.entries(files)) assert.equal(await readFile(join(root, name), 'utf8'), text);
  } finally { await application.close(); await rm(root, { recursive: true, force: true }); }
});
