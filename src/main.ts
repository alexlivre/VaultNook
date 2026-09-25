import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './main/handlers/ipc-handlers';
import { migrateLegacyUserData } from './main/services/legacy-user-data';
import * as vault from './main/services/vault';
import { IPC_CHANNELS } from './shared/ipc-channels';

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 980,
    minHeight: 500,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#151b22',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/main_window/index.html'));
  }

  // mainWindow.webContents.openDevTools();

  // Notify renderer on maximize/unmaximize
  mainWindow.on('maximize', () => mainWindow?.webContents.send(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGED, true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGED, false));
};

function registerWindowControls() {
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => mainWindow?.minimize());
  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => mainWindow?.close());
}

function registerPowerEvents() {
  const onSystemLock = () => {
    vault.lockVault();
    mainWindow?.webContents.send(IPC_CHANNELS.VAULT_LOCKED_BY_SYSTEM);
  };

  powerMonitor.on('suspend', onSystemLock);
  powerMonitor.on('lock-screen', onSystemLock);
}

app.whenReady().then(async () => {
  await migrateLegacyUserData();
  registerIpcHandlers();
  registerWindowControls();
  registerPowerEvents();
  createWindow();
});

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
