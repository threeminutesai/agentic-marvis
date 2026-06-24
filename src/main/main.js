const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('path');
const { registerIpcHandlers } = require('./ipcHandlers');

const cacheDir = path.join(os.tmpdir(), 'agentic-marvis-cache');
fs.mkdirSync(cacheDir, { recursive: true });
app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });
  try {
    registerIpcHandlers();
  } catch (err) {
    console.error('[Main] Error registering IPC handlers:', err);
  }
  createWindow();
}).catch((err) => {
  console.error('[Main] Error in app.whenReady():', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
