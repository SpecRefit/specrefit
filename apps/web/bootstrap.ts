// Keep this entry point compatible with older cached HTML: it checks before mounting the editor.
const entry = document.querySelector<HTMLScriptElement>('script[data-build]')!;
const feedback = document.querySelector<HTMLElement>('#feedback')!;

async function start() {
  if (location.hostname === 'play.specrefit.dev') {
    const url = new URL('./build-manifest.json', location.href);
    url.searchParams.set('visit', crypto.randomUUID());
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('Build information is unavailable.');
    const latest: unknown = await response.json();
    if (!latest || typeof latest !== 'object' || !('id' in latest) || typeof latest.id !== 'string' || !/^[a-f0-9]{64}$/.test(latest.id)) throw new Error('Build information is invalid.');
    if (latest.id !== entry.dataset.build) {
      const fresh = new URL(location.href);
      if (fresh.searchParams.get('build') === latest.id) throw new Error('Deployment is still updating.');
      fresh.searchParams.set('build', latest.id);
      fresh.searchParams.set('visit', crypto.randomUUID());
      location.replace(fresh.href);
      return;
    }
    // The freshness parameter is only needed to bypass the cache during navigation.
    const clean = new URL(location.href);
    clean.searchParams.delete('visit');
    clean.searchParams.delete('build');
    history.replaceState(null, '', clean.href);
  }
  const app = entry.dataset.app;
  if (!app || !/^app-[a-f0-9]{64}\.js$/.test(app)) throw new Error('Application entry is invalid.');
  await import(new URL(app, location.href).href);
}

void start().catch(() => {
  feedback.hidden = false;
  feedback.replaceChildren(document.createTextNode('Could not load the latest application. Check your connection and try again. '));
  const retry = document.createElement('button');
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => location.reload());
  feedback.append(retry);
});
