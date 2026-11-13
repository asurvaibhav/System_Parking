// @ts-check
const { app, BrowserWindow, shell, ipcMain, screen } = require('electron');
const path = require('path');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;
  let displayWindow = null;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1100,
      minHeight: 700,
      backgroundColor: '#F7F7F6',
      autoHideMenuBar: true,
      title: 'CPVTS - Campus Parking & Vehicle Tracking System',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const startUrl = process.env.ELECTRON_START_URL;

    if (startUrl) {
      mainWindow.loadURL(startUrl);
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Deny new windows and open external links in system browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Block navigation away from application
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (startUrl && url.startsWith(startUrl)) {
        return;
      }
      if (!startUrl && url.startsWith('file://')) {
        return;
      }
      event.preventDefault();
      shell.openExternal(url);
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
      // Close display window when main window closes per spec
      if (displayWindow && !displayWindow.isDestroyed()) {
        displayWindow.close();
      }
    });
  }

  // Handle open-customer-display IPC event
  ipcMain.handle('open-customer-display', async (_event, code) => {
    // Keep only one display window
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.focus();
      return;
    }

    const allDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const secondaryDisplay = allDisplays.find((d) => d.id !== primaryDisplay.id);

    const startUrl = process.env.ELECTRON_START_URL;
    const displayHash = `#/display?code=${encodeURIComponent(code || '')}`;

    if (secondaryDisplay) {
      displayWindow = new BrowserWindow({
        x: secondaryDisplay.bounds.x,
        y: secondaryDisplay.bounds.y,
        width: secondaryDisplay.bounds.width,
        height: secondaryDisplay.bounds.height,
        fullscreen: true,
        frame: false,
        autoHideMenuBar: true,
        backgroundColor: '#F7F7F6',
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
    } else {
      displayWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        autoHideMenuBar: true,
        backgroundColor: '#F7F7F6',
        title: 'Customer Payment Display - CPVTS',
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
    }

    if (startUrl) {
      displayWindow.loadURL(`${startUrl}${displayHash}`);
    } else {
      displayWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
        hash: `display?code=${encodeURIComponent(code || '')}`,
      });
    }

    displayWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    displayWindow.on('closed', () => {
      displayWindow = null;
    });
  });

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
