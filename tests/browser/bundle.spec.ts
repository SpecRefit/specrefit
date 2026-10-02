import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { transform } from '../../packages/engine/transform.ts';

test('general bundle option works without rules, persists settings and invalidates stale output', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore an example' }).click();
  await page.getByRole('button', { name: 'Rules and preview', exact: true }).click();
  const bundle = page.getByRole('checkbox', { name: 'Bundle external references into one file' });
  await expect(bundle).not.toBeChecked();
  await bundle.focus(); await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Preview these rules' }).click();
  await expect(page.getByRole('heading', { name: 'Transformation preview', exact: true })).toBeVisible();
  await expect(page.locator('.preview-result summary')).toHaveCount(1);
  await expect(page.locator('.preview-result summary')).toContainText('specrefit-bundled.yaml');
  await page.locator('.preview-result summary').click();
  await expect(page.locator('.preview-result')).toContainText('#/components/schemas/pet');
  await page.screenshot({ path: `artifacts/${info.project.name}-bundle.png`, fullPage: true });
  await page.getByLabel('Bundle format').selectOption('json');
  await expect(page.locator('.preview-result')).toHaveCount(0);
  const saved = await page.getByLabel('Rules JSON (copy to save, paste to replay)').inputValue();
  expect(JSON.parse(saved).output).toEqual({ bundle: true, format: 'json' });
  await page.getByRole('button', { name: 'Preview these rules' }).click();
  await expect(page.locator('.preview-result summary')).toContainText('specrefit-bundled.json');
  await expect(page.locator('.preview-result')).toContainText('JSON cannot retain YAML comments');
  await bundle.uncheck();
  await expect(page.locator('.preview-result')).toHaveCount(0);
  await page.getByLabel('Rules JSON (copy to save, paste to replay)').fill(saved);
  await page.getByRole('button', { name: 'Preview these rules' }).click();
  await expect(bundle).toBeChecked();
  await expect(page.getByLabel('Bundle format')).toHaveValue('json');
  await expect(page.locator('.preview-result summary')).toHaveCount(1);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('bundled bytes match Node for three families, YAML and JSON and block missing inputs', async ({ page }) => {
  await page.goto('/');
  for (const version of ['3.0.4', '3.1.2', '3.2.0']) for (const format of ['yaml', 'json']) {
    const input = { entry: 'api.json', sources: [
      { id: 'api.json', text: JSON.stringify({ openapi: version, info: { title: 'Parity', version: '1' }, paths: {}, components: { schemas: { Pet: { $ref: 'pet.yaml' } } } }) },
      { id: 'pet.yaml', text: readFileSync('tests/fixtures/schemas/pet.yaml', 'utf8') },
    ] };
    const config = { version: 1, rules: [], output: { bundle: true, format } };
    const expected = transform(input, config);
    expect(expected.files).toHaveLength(1);
    const actual = await page.evaluate(({input,config}) => new Promise((resolve,reject) => {const w=new Worker('./worker.js',{type:'module'});w.onmessage=e=>{w.terminate();resolve(e.data.preview)};w.onerror=reject;w.postMessage({action:'transform',input,config});}), {input,config});
    expect(actual).toEqual(expected);
  }
  await page.getByLabel('Open contract files', {exact:true}).setInputFiles({name:'api.yaml', mimeType:'text/yaml', buffer:Buffer.from('openapi: 3.1.2\ninfo: {title: Missing, version: "1"}\npaths: {}\ncomponents:\n  schemas:\n    Pet: {$ref: missing.yaml}\n')});
  await page.getByRole('button', {name:'Rules and preview',exact:true}).click();
  await page.getByRole('checkbox', {name:'Bundle external references into one file'}).check();
  await page.getByRole('button', {name:'Preview these rules'}).click();
  await expect(page.getByRole('heading', {name:'Preview blocked',exact:true})).toBeVisible();
  await expect(page.locator('.preview-result summary')).toHaveCount(0);
});
