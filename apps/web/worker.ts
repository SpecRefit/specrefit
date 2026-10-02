import { inspect } from '../../packages/engine/index.ts';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent) => void; postMessage: (data: unknown) => void };
scope.onmessage = event => {
  try { scope.postMessage({ report: inspect(event.data) }); }
  catch { scope.postMessage({ error: 'Inspection stopped safely. Reduce the input size or check the document syntax.' }); }
};
