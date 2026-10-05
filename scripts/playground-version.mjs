import { execFileSync } from 'node:child_process';
import { buildVersion, releaseVersion } from './version.mjs';

/** Presentation metadata only; development artifact versions remain unchanged. */
export function playgroundVersion({ cwd = process.cwd(), env = process.env, build = buildVersion({ cwd, env }) } = {}) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const published = env.SPECREFIT_PLAYGROUND_RELEASE_TAGS === undefined ? null : JSON.parse(env.SPECREFIT_PLAYGROUND_RELEASE_TAGS);
  if (env.SPECREFIT_PLAYGROUND_RELEASE_TAGS !== undefined && (!Array.isArray(published) || published.some(tag => typeof tag !== 'string'))) throw new Error('Playground release tags must be a JSON array of published tag names.');
  const candidates = git('tag', '--merged', 'HEAD', '--list', 'v*').split('\n').filter(tag => {
    try { return (!published || published.includes(tag)) && !releaseVersion(tag).split('+')[0].includes('-'); } catch { return false; }
  }).sort();
  let release = null;
  if (candidates.length) {
    const tag = git('describe', '--tags', '--abbrev=0', ...candidates.flatMap(tag => ['--match', tag]), 'HEAD');
    release = { tag, version: releaseVersion(tag), commitsSince: Number(git('rev-list', '--count', `${tag}..HEAD`)) };
  }
  return {
    commit: build.commit, dirty: build.dirty, release,
    development: !release || release.commitsSince > 0 || build.dirty || !!env.GITHUB_EVENT_NAME?.startsWith('pull_request'),
  };
}
