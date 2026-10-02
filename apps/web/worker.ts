import { inspect } from '../../packages/engine/index.ts';
import { transform } from '../../packages/engine/transform.ts';
import { createOutput, createDownload } from '../../packages/engine/export.ts';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent) => void; postMessage: (data: unknown) => void };
scope.onmessage = event => {
  try { scope.postMessage(event.data.action === 'export' ? { output: createOutput(event.data.plan), download: createDownload(event.data.plan) } : event.data.action === 'transform' ? { preview: transform(event.data.input, event.data.config) } : { report: inspect(event.data) }); }
  catch { scope.postMessage({ error: 'Inspection stopped safely. Reduce the input size or check the document syntax.' }); }
};
