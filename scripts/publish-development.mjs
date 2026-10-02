import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyInventory } from './development-artifacts.mjs';

/** Upload into a draft; serialize callers so an older build cannot replace newer latest. */
export async function publishDevelopment({ build, assets, api, upload, runUrl }) {
  const main = await api('GET', `/compare/${build.commit}...main`);
  if (!['ahead', 'identical'].includes(main.status)) throw new Error('Development commit is not on main history.');
  const tag = `develop-${build.commit}`;
  let release = await api('GET', `/releases/tags/${tag}`);
  const body = `Automated development build — not a stable product release.\n\nVersion: \`${build.version}\`\nCommit: \`${build.commit}\`\nBuild: ${runUrl}\n\nDownloads include every artifact produced by this build, a manifest and SHA-256 checksums. Currently: static browser assets and an experimental Linux x64 desktop bundle with its runtime. Linux system libraries are still required; Windows/macOS/CLI/Maven packages do not exist yet.\n\nGitHub's Latest marker identifies the newest complete development download set. This is not a stability or native-platform acceptance claim.`;
  if (!release) release = await api('POST', '/releases', { tag_name: tag, target_commitish: build.commit, name: `Development build ${build.commit.slice(0, 12)}`, body, draft: true, prerelease: false, make_latest: 'false' });
  if (release.tag_name !== tag || release.target_commitish !== build.commit) throw new Error('Existing development release does not identify this commit.');
  if (release.immutable && release.draft) throw new Error('Cannot populate an immutable draft.');
  const matches = (remote, local) => remote?.state === 'uploaded' && remote.size === local.size && remote.digest === `sha256:${local.sha256}`;
  if (release.draft) {
    for (const old of release.assets) {
      const desired = assets.find(a => a.name === old.name);
      if (!desired || !matches(old, desired)) await api('DELETE', `/releases/assets/${old.id}`);
    }
    for (const asset of assets) {
      if (!matches(release.assets.find(a => a.name === asset.name), asset)) await upload(release.id, asset);
    }
  }
  release = await api('GET', `/releases/${release.id}`);
  if (release.assets.length !== assets.length || assets.some(a => !matches(release.assets.find(r => r.name === a.name), a)))
    throw new Error('Remote development assets are incomplete or have different checksums; latest was not changed.');
  const latest = await api('GET', '/releases/latest');
  let promote = true;
  if (/^develop-[0-9a-f]{40}$/.test(latest?.tag_name ?? '')) {
    const comparison = await api('GET', `/compare/${build.commit}...${latest.tag_name.slice(8)}`);
    if (!['ahead', 'behind', 'identical'].includes(comparison.status)) throw new Error('Development history diverged or could not be compared; latest was not changed.');
    promote = comparison.status !== 'ahead';
  }
  await api('PATCH', `/releases/${release.id}`, { draft: false, prerelease: false, make_latest: promote ? 'true' : 'false', body });
  return release.html_url;
}

async function main() {
  const env = process.env;
  if (env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF !== 'refs/heads/main') throw new Error('Publishing is restricted to main push workflows.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? '') || !env.GH_TOKEN) throw new Error('GitHub repository and token are required.');
  const directory = resolve('artifacts/development');
  const build = await verifyInventory(directory, env.GITHUB_SHA);
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
  const api = (method, path, data) => request(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) }, method === 'GET' && (path.startsWith('/releases/tags/') || path === '/releases/latest'));
  const upload = (id, asset) => request(`https://uploads.github.com/repos/${env.GITHUB_REPOSITORY}/releases/${id}/assets?name=${encodeURIComponent(asset.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: asset.bytes });
  console.log(await publishDevelopment({ build, assets, api, upload, runUrl: `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` }));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
