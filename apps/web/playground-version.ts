export interface PlaygroundVersion {
  commit: string; dirty: boolean; development: boolean;
  release: { tag: string; version: string; commitsSince: number } | null;
}

export function showPlaygroundVersion(label: HTMLElement, banner: HTMLElement, build: PlaygroundVersion, hostname = location.hostname) {
  if (hostname !== 'play.specrefit.dev') return;
  banner.hidden = true;
  label.textContent = build.release ? build.release.version + (build.development ? ' + development' : '') : 'Development';
  label.title = `Commit ${build.commit}${build.dirty ? ' (local changes)' : ''}`;
  if (!build.development) return;
  banner.hidden = false;
  const title = document.createElement('strong'); title.textContent = 'Development build';
  const detail = document.createElement('span');
  detail.textContent = build.release
    ? `${build.release.commitsSince} ${build.release.commitsSince === 1 ? 'commit' : 'commits'} since ${build.release.tag}${build.dirty ? ' · local changes' : ''}`
    : `No stable release tag in this build${build.dirty ? ' · local changes' : ''}`;
  const commit = document.createElement('a'); commit.textContent = build.commit.slice(0, 12);
  commit.href = `https://github.com/SpecRefit/specrefit/commit/${build.commit}`;
  commit.target = '_blank'; commit.rel = 'noopener noreferrer'; commit.setAttribute('aria-label', `View commit ${build.commit.slice(0, 12)} on GitHub`);
  banner.replaceChildren(title, detail, commit);
}
