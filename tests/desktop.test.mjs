import test from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspect, valueAt } from '../packages/engine/index.ts';
import { transform } from '../packages/engine/transform.ts';

test('sandboxed Electron uses the same worker and UI without renderer privileges', async () => {
  const application = await electron.launch({ args: ['.'] });
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
    await page.screenshot({ path: 'artifacts/electron-operation.png', fullPage: true });
  } finally { await application.close(); }
});

test('portable bundle starts with no Node installation on its PATH', { skip: !process.env.SPECREFIT_TEST_PACKAGE }, async () => {
  const application = await electron.launch({ executablePath: resolve('artifacts/specrefit-linux-x64/electron'), args: [], env: { ...process.env, PATH: '/usr/bin:/bin' } });
  try {
    const page = await application.firstWindow();
    await page.getByRole('button', { name: 'Explore an example' }).click();
    await page.getByRole('heading', { name: 'Find your next companion', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => typeof globalThis.process), 'undefined');
    const built = JSON.parse(await readFile('dist/web/version.json', 'utf8'));
    assert.equal(await application.evaluate(({ app }) => app.getVersion()), built.version);
    assert.equal(await page.locator('.preview').textContent(), built.version);
  } finally { await application.close(); }
});
