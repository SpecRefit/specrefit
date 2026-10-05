import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const html = readFileSync('dist/web/index.html', 'utf8');
const current = JSON.parse(readFileSync('dist/web/build-manifest.json', 'utf8')).id;
const previous = '0'.repeat(64);
const stale = html.replace(`data-build="${current}"`, `data-build="${previous}"`).replace(/data-app="[^"]+"/, `data-app="app-${previous}.js"`);

test('a cached page refreshes before mounting and uses matching fingerprinted assets', async ({ page }) => {
  const requests: URL[] = [];
  await page.route('https://play.specrefit.dev/**', async route => {
    const url = new URL(route.request().url()); requests.push(url);
    if (url.pathname === '/') return route.fulfill({ body: url.searchParams.has('visit') ? html : stale, contentType: 'text/html', headers: { 'Cache-Control': 'max-age=600' } });
    const file = url.pathname.slice(1);
    if (!['bootstrap.js', 'build-manifest.json'].includes(file) && !/^(app|worker|styles|mark)-[a-f0-9]{64}\.(js|css|svg)$/.test(file)) return route.abort();
    await route.fulfill({ path: `dist/web/${file}`, contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/json' });
  });
  await page.goto('https://play.specrefit.dev/');
  await page.getByRole('button', { name: 'Explore an example' }).click();
  await expect(page.getByRole('heading', { name: 'Find your next companion', exact: true })).toBeVisible();
  await expect(page).toHaveURL('https://play.specrefit.dev/');
  expect(requests.filter(url => url.pathname === '/')).toHaveLength(2);
  const checks = requests.filter(url => url.pathname === '/build-manifest.json');
  expect(checks).toHaveLength(2);
  expect(checks[0].searchParams.get('visit')).toBeTruthy();
  expect(checks[1].search).not.toBe(checks[0].search);
  expect(requests.some(url => url.pathname === `/app-${previous}.js`)).toBeFalsy();
  expect(requests.some(url => /^\/worker-[a-f0-9]{64}\.js$/.test(url.pathname))).toBeTruthy();
});

for (const failure of ['offline', 'invalid', 'inconsistent-deployment']) {
  test(`freshness check handles ${failure} without starting stale code or looping`, async ({ page }) => {
    let navigations = 0, apps = 0;
    await page.route('https://play.specrefit.dev/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') { navigations++; return route.fulfill({ body: stale, contentType: 'text/html' }); }
      if (url.pathname === '/bootstrap.js') return route.fulfill({ path: 'dist/web/bootstrap.js', contentType: 'text/javascript' });
      if (url.pathname === '/build-manifest.json') {
        if (failure === 'offline') return route.abort();
        return route.fulfill({ json: failure === 'invalid' ? { id: 'invalid' } : { id: current } });
      }
      if (url.pathname.startsWith('/app-')) apps++;
      return route.abort();
    });
    await page.goto('https://play.specrefit.dev/');
    await expect(page.getByRole('alert')).toContainText('Could not load the latest application');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(navigations).toBe(failure === 'inconsistent-deployment' ? 2 : 1);
    expect(apps).toBe(0);
  });
}
