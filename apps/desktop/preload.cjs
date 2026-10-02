const { contextBridge, ipcRenderer, webUtils } = require('electron');

// The page cannot supply a filesystem destination or invoke arbitrary IPC channels.
contextBridge.exposeInMainWorld('specRefitDesktop', {
  protectInputs(files) {
    if (!Array.isArray(files) || files.length > 64) return Promise.reject(new Error('Invalid file selection.'));
    const paths = files.map(file => webUtils.getPathForFile(file));
    // Synthetic browser Files have no backing path and cannot overwrite a disk source.
    return ipcRenderer.invoke('specrefit:protect-inputs', paths.filter(Boolean));
  },
  saveOutput(output, name) { return ipcRenderer.invoke('specrefit:save-output', output, name); },
});
