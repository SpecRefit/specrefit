import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

const numeric = '(?:0|[1-9][0-9]*)';
const identifier = `(?:${numeric}|[0-9]*[A-Za-z-][0-9A-Za-z-]*)`;
const releaseTag = new RegExp(`^v(${numeric}\\.${numeric}\\.${numeric}(?:-${identifier}(?:\\.${identifier})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?)$`);

/** Build tooling only: never imported by the shared contract engine. */
export function buildVersion({ cwd = process.cwd(), env = process.env } = {}) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let commit, dirty, tags;
  try {
    if (realpathSync(git('rev-parse', '--show-toplevel')) !== realpathSync(cwd)) throw new Error('Not the checkout root');
    commit = git('rev-parse', '--verify', 'HEAD');
    dirty = git('status', '--porcelain', '--untracked-files=normal').length > 0;
    tags = git('tag', '--points-at', 'HEAD').split('\n').filter(Boolean);
  } catch { throw new Error('Versioning requires the root of a Git checkout with a commit and fetched tags. Build from a clone, not a source archive.'); }
  let tag = null;
  const development = env.SPECREFIT_BUILD_CHANNEL === 'development';
  if (env.SPECREFIT_BUILD_CHANNEL && !development) throw new Error('Unknown SPECREFIT_BUILD_CHANNEL; expected development or unset.');
  if (!development && env.GITHUB_REF_TYPE === 'tag') {
    tag = env.GITHUB_REF_NAME;
    if (!tag || !releaseTag.test(tag) || !tags.includes(tag)) throw new Error('The release tag must be valid vMAJOR.MINOR.PATCH SemVer and point at the checked-out commit.');
    if (dirty) throw new Error('A release tag build requires a clean checkout.');
  } else if (!development && !env.GITHUB_EVENT_NAME?.startsWith('pull_request')) {
    const candidates = tags.filter(t => releaseTag.test(t));
    if (candidates.length > 1) throw new Error('Multiple release tags point at HEAD; select a single release in a tag build.');
    if (!dirty) tag = candidates[0] ?? null;
  }
  return { version: tag ? tag.slice(1) : `0.0.0-dev+g${commit.slice(0, 12)}${dirty ? '.dirty' : ''}`, commit, dirty, tag };
}

export function verifyBuildVersion(built, current = buildVersion()) {
  for (const key of ['version', 'commit', 'dirty', 'tag']) {
    if (built?.[key] !== current[key]) throw new Error('Built assets do not match this checkout/version. Run npm run build before packaging.');
  }
  return built;
}
