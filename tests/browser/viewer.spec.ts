import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inspect } from '../../packages/engine/index.ts';

const sources = ['petstore.yaml', 'schemas/pet.yaml'].map(id => ({ id, text: readFileSync(`tests/fixtures/${id}`, 'utf8') }));
test('example, filter, keyboard, schema recursion and back navigation', async ({ page }, info) => {
  const requests: string[] = [];
  page.on('request', r => requests.push(r.url()));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore an example' }).click();
  await expect(page.getByRole('heading', { name: 'Find your next companion', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search operations' }).fill('adoption');
  await page.getByRole('combobox', { name: 'HTTP method' }).selectOption('POST');
  await expect(page.getByRole('navigation', { name: 'Operations by tag' }).getByRole('button')).toHaveCount(1);
  const operation = page.getByRole('button', { name: 'POST /adoptions Request an adoption' });
  await operation.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Request an adoption', exact: true })).toBeVisible();
  await expect(page.locator('#content')).toBeFocused();
  await page.getByRole('button', { name: 'Schemas', exact: true }).click();
  await page.getByRole('button', { name: 'Pet →', exact: true }).click();
  await page.getByRole('button', { name: '↗ ./schemas/pet.yaml', exact: true }).click();
  await expect(page.getByText('Required properties: id, name')).toBeVisible();
  await page.getByText('properties', { exact: true }).click();
  await page.getByText('friends', { exact: true }).click();
  await page.getByText('items', { exact: true }).click();
  await page.getByRole('button', { name: '↗ #', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Referenced definition' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to inspection' }).click();
  await expect(page.getByText('Required properties: id, name')).toBeVisible();
  await page.screenshot({ path: `artifacts/${info.project.name}-schema.png`, fullPage: true });
  expect(requests.every(url => url.startsWith('http://127.0.0.1:4173/'))).toBeTruthy();
});
test('targeted missing-reference upload, source comments and plain-text hostile content', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Open contract files', { exact: true }).setInputFiles({ name: 'petstore.yaml', mimeType: 'text/yaml', buffer: Buffer.from(sources[0].text.replace('Pet shelter API', '<img src=x onerror=alert(1)>')) });
  await page.getByRole('button', { name: /^Diagnostics/ }).click();
  await expect(page.getByRole('heading', { name: 'Supply a missing document' })).toBeVisible();
  await page.getByLabel('Choose file for schemas/pet.yaml', { exact: true }).setInputFiles({ name: 'unrelated-name.yaml', mimeType: 'text/yaml', buffer: Buffer.from(sources[1].text) });
  await expect(page.getByText('No issues found by the available inspection checks.')).toBeVisible();
  await expect(page.locator('img')).toHaveCount(1); // Only the bundled logo; contract HTML never executes.
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'schemas/pet.yaml', exact: true }) }).getByRole('button', { name: 'Read original source' }).click();
  await expect(page.locator('.source-excerpt')).toContainText('# This description belongs to Pet');
});

test('unresolved request bodies do not claim optional status', async ({ page }) => {
  await page.goto('/');
  const input = { openapi: '3.1.2', info: { title: 'Partial', version: '1' }, paths: { '/': { post: { requestBody: { $ref: 'body.yaml' }, responses: { '200': { description: 'OK' } } } } } };
  await page.getByLabel('Open contract files', { exact: true }).setInputFiles({ name: 'api.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  await expect(page.getByText('Unresolved reference — required status unknown')).toBeVisible();
  await expect(page.getByText('Optional body', { exact: true })).toHaveCount(0);
});
test('real browser worker matches Node inspection exactly across formats and versions', async ({ page }) => {
  await page.goto('/');
  const projects = [
    { entry: 'petstore.yaml', sources },
    ...['3.0.4', '3.1.2', '3.2.0'].flatMap(version => ['json', 'yaml'].map(format => {
      const text = format === 'json' ? JSON.stringify({ openapi: version, info: { title: 'Parity', version: '1' }, paths: { '/': { get: { responses: { '200': { description: 'OK' } } } } }, 'x-extra': [true, 'retain'] }) : `# kept\nopenapi: ${version}\ninfo: {title: Parity, version: '1'}\npaths:\n  /:\n    get:\n      responses:\n        '200': {description: OK}\nx-extra: [true, retain]\n`;
      return { entry: `api.${format}`, sources: [{ id: `api.${format}`, text }] };
    })),
  ];
  for (const input of projects) {
    const expected = inspect(input);
    const actual = await page.evaluate(input => new Promise((resolve, reject) => {
      const w = new Worker('./worker.js', { type: 'module' });
      w.onmessage = e => { w.terminate(); resolve(e.data.report); }; w.onerror = reject; w.postMessage(input);
    }), input);
    expect(actual).toStrictEqual(expected);
  }
});
test('empty state and narrow viewport stay usable', async ({ page }, info) => {
  await page.goto('/');
  const built = JSON.parse(readFileSync('dist/web/version.json', 'utf8'));
  await expect(page.locator('.preview')).toHaveText(built.version);
  await expect(page.locator('.preview')).toHaveAttribute('title', `Build ${built.commit}${built.dirty ? ' (local changes)' : ''}`);
  await page.screenshot({ path: `artifacts/${info.project.name}-welcome.png`, fullPage: true });
  await page.getByRole('button', { name: 'Explore an example' }).click();
  await expect(page.getByRole('heading', { name: 'Find your next companion', exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/${info.project.name}-operation.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Find your next companion', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `artifacts/${info.project.name}-mobile.png`, fullPage: true });
});

test('large local JSON import remains navigable and searchable', async ({ page }) => {
  const { largeContract } = await import('../fixtures/large-contract.ts');
  await page.goto('/');
  await page.getByLabel('Open contract files', { exact: true }).setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(largeContract()) });
  await expect(page.locator('#status')).toContainText('1200 operations. 0 diagnostics.', { timeout: 20_000 });
  // A long operation list must not push the detail pane down or scroll it.
  const sidebar = page.locator('.sidebar');
  const pane = page.locator('#content');
  await sidebar.hover(); await page.mouse.wheel(0, 1800);
  await expect.poll(() => sidebar.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await pane.evaluate(el => el.scrollTop)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await pane.hover(); await page.mouse.wheel(0, 700);
  await expect.poll(() => pane.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  const nearBottom = page.getByRole('navigation', { name: 'Operations by tag' }).getByRole('button').last();
  await nearBottom.scrollIntoViewIfNeeded();
  const listPosition = await sidebar.evaluate(el => el.scrollTop);
  await nearBottom.focus(); await page.keyboard.press('Enter');
  await expect(pane).toBeFocused();
  await expect.poll(() => pane.evaluate(el => el.scrollTop)).toBe(0);
  expect(Math.abs(await sidebar.evaluate(el => el.scrollTop) - listPosition)).toBeLessThan(2);
  await expect(pane.locator('h1')).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // Reset the list through search, then inspect a schema near the bottom of its own pane.
  await page.getByRole('searchbox', { name: 'Search operations' }).fill('/items/1199');
  const operations = page.getByRole('navigation', { name: 'Operations by tag' }).getByRole('button');
  await expect(operations).toHaveCount(1);
  await operations.click();
  await expect(page.getByRole('heading', { name: 'Read item 1199', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Schemas', exact: true }).click();
  await expect(page.locator('.schema-button')).toHaveCount(1000);
  await page.getByRole('button', { name: 'Model999 →', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Model999', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Model999', exact: true })).toBeInViewport();
  expect(await pane.evaluate(el => el.scrollTop)).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Operations & filters', exact: true }).click();
  await page.getByRole('navigation', { name: 'Operations by tag' }).getByRole('button').click();
  await expect(pane.locator('h1')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('file limit failures are visible and allow a new selection', async ({ page }, info) => {
  await page.goto('/');
  await page.getByLabel('Open contract files', { exact: true }).setInputFiles({ name: 'too-large.json', mimeType: 'application/json', buffer: Buffer.alloc(20_000_001, 32) });
  await expect(page.getByRole('alert')).toBeInViewport();
  await expect(page.getByRole('alert')).toContainText('20 MB per file and 40 MB in total');
  await page.screenshot({ path: `artifacts/${info.project.name}-file-limit.png`, fullPage: true });
  await page.getByRole('button', { name: 'Explore an example' }).click();
  await expect(page.getByRole('heading', { name: 'Find your next companion', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toBeHidden();
});
