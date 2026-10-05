const { parentPort, workerData } = require('node:worker_threads');
const { importLocalReferences } = require('../../dist/desktop/import.cjs');
importLocalReferences(workerData.input, workerData.selections)
  .then(result => parentPort.postMessage(result))
  .catch(() => parentPort.postMessage({ error: 'Local input could not be read safely. Check the files and input limits.' }));
