import { mount } from '../../packages/editor/index.ts';
import sample from './sample.json';
mount(document.querySelector<HTMLElement>('#app')!, sample);
