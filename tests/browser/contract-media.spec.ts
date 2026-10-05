import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { inspect } from '../../packages/engine/index.ts';
import { transform } from '../../packages/engine/transform.ts';

const fixture = readFileSync('tests/fixtures/media-preference.yaml', 'utf8');
const external = readFileSync('tests/fixtures/media-components.yaml', 'utf8');
const toggleName = 'Prefer selected media types across the whole contract';
const rulesName = 'Rules JSON (copy to save, paste to replay)';

test('contract-wide choices come from the input, preserve multipart by default and replay one ordered rule', async ({ page }, info) => {
  await page.goto('/');
  await page.getByLabel('Open contract files', { exact: true }).setInputFiles([
    { name: 'api.yaml', mimeType: 'text/yaml', buffer: Buffer.from(fixture) },
    { name: 'media-components.yaml', mimeType: 'text/yaml', buffer: Buffer.from(external) },
  ]);
  await page.getByRole('button', { name: 'Rules and preview', exact: true }).click();
  const group = page.getByRole('group', { name: 'Media types for the whole contract', exact: true });
  await expect(group.getByRole('checkbox', { name: 'application/parameter-only', exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: toggleName, exact: true }).check();
  for (const name of ['application/json', 'application/xml', 'application/problem+json', 'multipart/form-data', 'text/csv', 'text/plain']) await expect(group.getByRole('checkbox', { name, exact: true })).toBeChecked();
  for (const name of ['application/problem+json', 'application/xml', 'text/csv', 'text/plain']) await group.getByRole('checkbox', { name, exact: true }).uncheck();
  const selected = JSON.parse(await page.getByLabel(rulesName).inputValue());
  expect(selected.rules).toHaveLength(1);
  expect(selected.rules[0]).toMatchObject({ kind: 'select-contract-media', keep: ['application/json', 'multipart/form-data'] });
  await page.getByRole('button', { name: 'Preview these rules' }).click();
  await expect(page.getByRole('heading', { name: 'Transformation preview', exact: true })).toBeVisible();
  const expected = transform({ entry: 'api.yaml', sources: [{ id: 'api.yaml', text: fixture }, { id: 'media-components.yaml', text: external }] }, selected);
  for (const file of expected.files) {
    const detail = page.locator('.preview-result details').filter({ has: page.locator('summary').getByText(file.id.replace('https://project.invalid/', '') + ' · changed', { exact: true }) });
    await detail.locator('summary').click();
    expect(await detail.locator('pre').last().textContent()).toBe(file.text);
  }
  // XML can be selected with exactly the same controls; JSON has no fixed status.
  const xml = group.getByRole('checkbox', { name: 'application/xml', exact: true });
  await xml.focus(); await page.keyboard.press('Space'); await expect(xml).toBeFocused();
  await group.getByRole('checkbox', { name: 'application/json', exact: true }).uncheck();
  await expect(page.locator('.preview-result')).toHaveCount(0);
  expect(JSON.parse(await page.getByLabel(rulesName).inputValue()).rules[0].keep).toEqual(['multipart/form-data', 'application/xml']);
  await page.setViewportSize({ width: 480, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `artifacts/${info.project.name}-contract-media.png`, fullPage: true });
  const saved = await page.getByLabel(rulesName).inputValue();
  await page.getByRole('checkbox', { name: toggleName, exact: true }).uncheck();
  expect(JSON.parse(await page.getByLabel(rulesName).inputValue()).rules).toHaveLength(0);
  await page.getByLabel(rulesName).fill(saved);
  await page.getByRole('button', { name: 'Preview these rules' }).click();
  await expect(page.getByRole('checkbox', { name: toggleName, exact: true })).toBeChecked();
  await expect(group.getByRole('checkbox', { name: 'application/xml', exact: true })).toBeChecked();
  await expect(group.getByRole('checkbox', { name: 'application/json', exact: true })).not.toBeChecked();
});

test('a contract without JSON offers XML and text as preferences and never permits an empty selection', async ({ page }) => {
  const text = JSON.stringify({ openapi: '3.0.4', info: { title: 'XML service', version: '1' }, paths: { '/xml': { get: { responses: { '200': { description: 'Result', content: { 'application/xml': { schema: { type: 'string' } }, 'text/plain': { schema: { type: 'string' } } } } } } } } });
  await page.goto('/');
  await page.getByLabel('Open contract files', { exact: true }).setInputFiles({ name: 'xml.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByRole('button', { name: 'Rules and preview', exact: true }).click();
  const group = page.getByRole('group', { name: 'Media types for the whole contract', exact: true });
  await expect(group.getByRole('checkbox', { name: 'application/json', exact: true })).toHaveCount(0);
  await group.getByRole('checkbox', { name: toggleName, exact: true }).check();
  await group.getByRole('checkbox', { name: 'text/plain', exact: true }).uncheck();
  await group.getByRole('checkbox', { name: 'application/xml', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('at least one');
  await expect(group.getByRole('checkbox', { name: 'application/xml', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Preview these rules' }).click();
  await expect(page.getByRole('heading', { name: 'Transformation preview', exact: true })).toBeVisible();
  await page.locator('.preview-result summary').click();
  const result = JSON.parse(await page.locator('.preview-result details pre').last().textContent() ?? '{}');
  expect(Object.keys(result.paths['/xml'].get.responses['200'].content)).toEqual(['application/xml']);
});

test('contract preferences produce exactly the same bytes through browser workers and Node for each supported family', async ({ page }) => {
  await page.goto('/');
  for (const version of ['3.0.4', '3.1.2', '3.2.0']) {
    const root = parse(fixture); root.openapi = version;
    if (version.startsWith('3.0')) delete root.webhooks;
    const input = { entry: 'api.json', sources: [{ id: 'api.json', text: JSON.stringify(root) }, { id: 'media-components.yaml', text: external }] };
    expect(inspect(input).diagnostics).toEqual([]);
    const config = { version: 1, rules: [{ id: 'preferred-media', kind: 'select-contract-media', keep: ['application/xml', 'multipart/form-data'] }] };
    const expected = transform(input, config);
    const actual = await page.evaluate(({ input, config }) => new Promise((resolve, reject) => { const w = new Worker('./worker.js', { type: 'module' }); w.onmessage = e => { w.terminate(); resolve(e.data.preview); }; w.onerror = reject; w.postMessage({ action: 'transform', input, config }); }), { input, config });
    expect(actual).toEqual(expected); expect(expected.files).toHaveLength(2);
  }
});
