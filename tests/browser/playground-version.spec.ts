import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const metadata = JSON.parse(readFileSync('dist/web/playground-version.json', 'utf8'));
const helper = (await build({ entryPoints: ['apps/web/playground-version.ts'], bundle: true, format: 'esm', write: false })).outputFiles[0].text;

test('hosted playground uses embedded metadata and remains usable with a development banner', async ({ page }, info) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.route('https://play.specrefit.dev/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const file = path === '/' ? 'index.html' : path.slice(1);
    if (!['index.html', 'app.js', 'worker.js', 'styles.css', 'mark.svg'].includes(file)) return route.abort();
    await route.fulfill({ path: `dist/web/${file}`, contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html' });
  });
  await page.goto('https://play.specrefit.dev/');
  await expect(page.locator('.preview')).toHaveAttribute('title', `Commit ${metadata.commit}${metadata.dirty ? ' (local changes)' : ''}`);
  if (metadata.development) await expect(page.locator('#build-banner')).toBeVisible();
  else await expect(page.locator('#build-banner')).toBeHidden();
  await page.getByRole('button', { name: 'Explore an example' }).click();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 390, height: 600 });
    await expect(page.locator('#content')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `artifacts/${info.project.name}-build-banner-${colorScheme}.png` });
  }
  expect(requests.every(url => url.startsWith('https://play.specrefit.dev/'))).toBeTruthy();
});

test('release, newer commit and no-release presentation; local builds keep their own version', async ({ page }) => {
  await page.route('**/version-test.js', route => route.fulfill({ body: helper, contentType: 'text/javascript' }));
  await page.goto('/');
  const original = await page.locator('.preview').textContent();
  await expect(page.locator('#build-banner')).toBeHidden();
  const commit = 'a'.repeat(40);
  async function show(development: boolean, commitsSince: number, release = true, hostname = 'play.specrefit.dev') {
    await page.evaluate(async args => {
      const { showPlaygroundVersion } = await import('/version-test.js');
      showPlaygroundVersion(document.querySelector('.preview'), document.querySelector('#build-banner'), args.build, args.hostname);
    }, { build: { commit, dirty: false, development, release: release ? { tag: 'v0.1.0', version: '0.1.0', commitsSince } : null }, hostname });
  }
  await show(true, 3, true, 'localhost');
  await expect(page.locator('.preview')).toHaveText(original!);
  await show(true, 3);
  await expect(page.locator('#build-banner')).toContainText('3 commits since v0.1.0');
  await expect(page.locator('#build-banner a')).toHaveAttribute('href', `https://github.com/SpecRefit/specrefit/commit/${commit}`);
  await show(false, 0);
  await expect(page.locator('.preview')).toHaveText('0.1.0');
  await expect(page.locator('#build-banner')).toBeHidden();
  await show(true, 0, false);
  await expect(page.locator('.preview')).toHaveText('Development');
  await expect(page.locator('#build-banner')).toContainText('No stable release');
});
