import { inspect } from '../../packages/engine/index.ts';
import { transform } from '../../packages/engine/transform.ts';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent) => void; postMessage: (data: unknown) => void };
scope.onmessage = event => {
  try { scope.postMessage(event.data.action === 'transform' ? { preview: transform(event.data.input, event.data.config) } : { report: inspect(event.data) }); }
  catch { scope.postMessage({ error: 'Inspection stopped safely. Reduce the input size or check the document syntax.' }); }
};
