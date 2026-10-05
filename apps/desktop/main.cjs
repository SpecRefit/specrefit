const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Worker } = require('node:worker_threads');
const { ProtectedInputs, saveFile, saveDirectory, validateOutput, safePath } = require('./export.cjs');

// Local input discovery, source protection and user-selected saving are scoped native adapters.
app.enableSandbox();
let window;
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const webRoot = path.resolve(__dirname, '../../dist/web');
  const allowedPrefix = pathToFileURL(webRoot + path.sep).href;
  const pageUrl = pathToFileURL(path.join(webRoot, 'index.html')).href;
  const inputs = new ProtectedInputs();
  let saving = false;
  let importing = false;
  const authorize = event => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url.split('#')[0] !== pageUrl) throw new Error('Untrusted export request.');
  };
  ipcMain.handle('specrefit:protect-inputs', async (event, paths) => { authorize(event); await inputs.add(paths); });
  ipcMain.handle('specrefit:import-local-references', async (event, selections, input) => {
    authorize(event);
    if (importing) throw new Error('An import is already in progress.');
    if (!Array.isArray(selections) || selections.length > 64) throw new Error('Invalid input selection.');
    importing = true;
    try {
      await inputs.add(selections.map(item => item.path));
      const result = await new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'import-worker.cjs'), { workerData: { selections, input } });
        const timer = setTimeout(() => finish(new Error('Local reference discovery exceeded 30 seconds. Try fewer or smaller files.')), 30_000);
        function finish(error, result) { clearTimeout(timer); void worker.terminate(); error ? reject(error) : resolve(result); }
        worker.once('message', result => finish(result.error ? new Error(result.error) : undefined, result));
        worker.once('error', error => finish(error));
        worker.once('exit', code => { if (code) finish(new Error('Local reference discovery stopped.')); });
      });
      for (let i = 0; i < result.paths.length; i += 64) await inputs.add(result.paths.slice(i, i + 64));
      for (const identity of result.identities) inputs.identities.add(identity);
      return { sources: result.sources, diagnostics: result.diagnostics };
    } finally { importing = false; }
  });
  ipcMain.handle('specrefit:save-output', async (event, output, name) => {
    authorize(event); validateOutput(output);
    if (!safePath(name) || name.includes('/') || !/\.(?:zip|json|ya?ml)$/i.test(name)) throw new Error('Invalid output filename.');
    if (saving) throw new Error('An export is already in progress.');
    saving = true;
    try {
      if (output.files.length === 1) {
        const selected = await dialog.showSaveDialog(window, { title: 'Save reviewed output', defaultPath: name, filters: [{name:'OpenAPI document', extensions:['yaml', 'yml', 'json']}] });
        if (selected.canceled || !selected.filePath) return { saved: false };
        await saveFile(selected.filePath, output.files[0].bytes, inputs);
      } else {
        const selected = await dialog.showOpenDialog(window, { title: 'Choose output folder', properties: ['openDirectory', 'createDirectory'] });
        if (selected.canceled || !selected.filePaths.length) return { saved: false };
        await saveDirectory(selected.filePaths[0], output, inputs);
      }
      return { saved: true };
    } catch (error) { return { saved: false, error: error instanceof Error ? error.message : 'Export failed. No source file was written.' }; }
    finally { saving = false; }
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    // Allow only packaged assets. File selection uses the browser's explicit file picker.
    callback({ cancel: !details.url.startsWith(allowedPrefix) });
  });
  window = new BrowserWindow({
    icon: path.join(__dirname, 'icons/icon.png'),
    width: 1320, height: 900, minWidth: 480, minHeight: 500, backgroundColor: '#fafcfd',
    title: 'SpecRefit · Contract inspector',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false, preload: path.join(__dirname, 'preload.cjs') },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.loadFile(path.join(webRoot, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
