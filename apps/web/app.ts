import { mount } from '../../packages/editor/index.ts';
import sample from './sample.json';
const versionLabel = document.querySelector<HTMLElement>('.preview')!;
versionLabel.textContent = __SPECREFIT_BUILD__.version;
versionLabel.title = `Build ${__SPECREFIT_BUILD__.commit}${__SPECREFIT_BUILD__.dirty ? ' (local changes)' : ''}`;
mount(document.querySelector<HTMLElement>('#app')!, sample);
