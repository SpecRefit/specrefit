const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// No IPC bridge, preload, filesystem access, updates or optional fetch in this viewer.
app.enableSandbox();
let window;
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const webRoot = path.resolve(__dirname, '../../dist/web');
  const allowedPrefix = pathToFileURL(webRoot + path.sep).href;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    // Allow only packaged assets. File selection uses the browser's explicit file picker.
    callback({ cancel: !details.url.startsWith(allowedPrefix) });
  });
  window = new BrowserWindow({
    width: 1320, height: 900, minWidth: 480, minHeight: 500, backgroundColor: '#fafcfd',
    title: 'SpecRefit · Contract inspector',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.loadFile(path.join(webRoot, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
