const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

let mainWindow = null;

function pingUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function findDevUrl() {
  const envPort = process.env.VITE_DEV_SERVER_PORT && Number(process.env.VITE_DEV_SERVER_PORT);
  const candidates = [];
  if (envPort) candidates.push(envPort);
  for (let p = 3000; p <= 3020; p++) candidates.push(p);
  for (const port of candidates) {
    const url = `http://localhost:${port}/`;
    /* eslint-disable no-await-in-loop */
    const ok = await pingUrl(url);
    if (ok) return url;
  }
  return null;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    const devUrl = await findDevUrl();
    if (devUrl) {
      mainWindow.loadURL(devUrl);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      mainWindow.loadURL('data:text/html,<h1>Vite dev server not found</h1><p>Start it with npm run dev.</p>');
    }
  } else {
    const unpackedIndex = path.join(__dirname, '../dist/index.html');
    const asarIndex = path.join(process.resourcesPath || path.join(__dirname, '..'), 'app.asar', 'dist', 'index.html');
    const indexPath = fs.existsSync(unpackedIndex) ? unpackedIndex : asarIndex;
    const fileUrl = pathToFileURL(indexPath).toString();
    // Ensure initial hash points to login so HashRouter matches a defined route
    mainWindow.loadURL(`${fileUrl}#/login`);
    // Optionally open devtools to debug packaged issues (comment to disable)
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Auto-update: check on ready and on interval
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.logger = require('electron-log');
    autoUpdater.logger.transports.file.level = 'info';

    autoUpdater.on('update-available', () => {
      if (mainWindow) mainWindow.webContents.send('update-available');
    });
    autoUpdater.on('update-downloaded', () => {
      const res = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['Restart', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update Ready',
        message: 'A new version has been downloaded. Restart to apply?',
      });
      if (res === 0) autoUpdater.quitAndInstall();
    });

    // Check for updates after window is ready
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
    // Periodic checks (every 4 hours)
    setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
  } catch (e) {
    // auto-update is optional
  }
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
