import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyInventory } from './development-artifacts.mjs';
import { requireCompleteDownloads } from './assemble-development.mjs';

/** One rolling prerelease. Serialize callers; never read or modify stable Latest. */
export async function publishDevelopment({ build, assets, api, upload, runUrl }) {
  const main = await api('GET', `/compare/${build.commit}...main`);
  if (!['ahead', 'identical'].includes(main.status)) throw new Error('Development commit is not on main history.');
  const tag = 'development';
  let release = await api('GET', `/releases/tags/${tag}`);
  // The tag endpoint may omit drafts; authenticated listing also finds interrupted uploads.
  for (let page = 1; !release; page++) {
    const releases = await api('GET', `/releases?per_page=100&page=${page}`);
    release = releases.find(r => r.tag_name === tag);
    if (releases.length < 100) break;
  }
  if (release) {
    if (release.tag_name !== tag || !release.prerelease || release.immutable || !/^[0-9a-f]{40}$/.test(release.target_commitish))
      throw new Error('Existing preview must be a mutable prerelease with an exact commit.');
    const comparison = await api('GET', `/compare/${build.commit}...${release.target_commitish}`);
    if (comparison.status === 'ahead') return release.html_url;
    if (!['behind', 'identical'].includes(comparison.status)) throw new Error('Development history diverged; preview was not changed.');
  }
  const body = `Rolling development preview — not a stable release. Replaced after successful main builds.\n\nVersion: \`${build.version}\`\nCommit: \`${build.commit}\`\nBuild: ${runUrl}\n\nDownloads: browser assets and portable desktop packages for Windows x64, macOS Apple Silicon/Intel and Linux x64, including the Electron runtime. Extract the archive and launch SpecRefit.exe, SpecRefit.app or SpecRefit. Windows is unsigned; macOS has only an ad-hoc signature, with no Developer ID or notarization. OS security policy may block these development builds. Linux system libraries remain prerequisites. Manifest and SHA-256 checksums identify the complete tested set. Installers, CLI and Maven packages remain planned.\n\nLatest is reserved for stable releases. This preview may be briefly unavailable during replacement; failed publication can be retried.`;
  const metadata = { target_commitish: build.commit, name: 'Development preview', body, prerelease: true, make_latest: 'false' };
  const matches = (remote, local) => remote?.state === 'uploaded' && remote.size === local.size && remote.digest === `sha256:${local.sha256}`;
  const complete = r => r.assets.length === assets.length && assets.every(a => matches(r.assets.find(r => r.name === a.name), a));
  if (release && !release.draft && release.target_commitish === build.commit && complete(release)) return release.html_url;
  // Withdraw the public preview before changing assets: never advertise a mixed build.
  if (release) release = await api('PATCH', `/releases/${release.id}`, { ...metadata, draft: true });
  else release = await api('POST', '/releases', { ...metadata, tag_name: tag, draft: true });
  for (const old of release.assets) {
    const desired = assets.find(a => a.name === old.name);
    if (!desired || !matches(old, desired)) await api('DELETE', `/releases/assets/${old.id}`);
  }
  for (const asset of assets) {
    if (!matches(release.assets.find(a => a.name === asset.name), asset)) await upload(release.id, asset);
  }
  release = await api('GET', `/releases/${release.id}`);
  if (!complete(release)) throw new Error('Remote preview assets are incomplete or have different checksums; preview remains a draft.');
  // target_commitish does not move an existing tag. Only this dedicated preview tag moves.
  const ref = await api('GET', `/git/ref/tags/${tag}`);
  if (ref) await api('PATCH', `/git/refs/tags/${tag}`, { sha: build.commit, force: true });
  else await api('POST', '/git/refs', { ref: `refs/tags/${tag}`, sha: build.commit });
  release = await api('PATCH', `/releases/${release.id}`, { ...metadata, draft: false });
  return release.html_url;
}

async function main() {
  const env = process.env;
  if (env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF !== 'refs/heads/main') throw new Error('Publishing is restricted to main push workflows.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? '') || !env.GH_TOKEN) throw new Error('GitHub repository and token are required.');
  const directory = resolve('artifacts/development');
  const build = await verifyInventory(directory, env.GITHUB_SHA);
  requireCompleteDownloads(build.files);
  const assets = await Promise.all([...build.files.map(f => f.name), 'manifest.json', 'SHA256SUMS'].map(async name => {
    const bytes = await readFile(join(directory, name));
    return { name, bytes, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
  const headers = { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const request = async (url, options, missing = false) => {
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(300_000), redirect: 'error' });
    if (missing && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub request failed: HTTP ${response.status}. No credentials or response body logged.`);
    return response.status === 204 ? null : response.json();
  };
  const api = (method, path, data) => request(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) }, method === 'GET' && (path.startsWith('/releases/tags/') || path === '/git/ref/tags/development'));
  const upload = (id, asset) => request(`https://uploads.github.com/repos/${env.GITHUB_REPOSITORY}/releases/${id}/assets?name=${encodeURIComponent(asset.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: asset.bytes });
  console.log(await publishDevelopment({ build, assets, api, upload, runUrl: `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` }));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
