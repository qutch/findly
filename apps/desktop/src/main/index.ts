import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { FileWatcherService } from "@findly/watcher";
console.log("[main] Electron main loaded");
let fileWatcher: FileWatcherService | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

// ── IPC: Folder Selection ─────────────────────────────

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const folderPath = result.filePaths[0];
  const name = path.basename(folderPath);

  // Stop existing watcher if user switches folders
  if (fileWatcher) {
    await fileWatcher.stop();
  }

  // Start new watcher
  fileWatcher = new FileWatcherService({
    paths: [folderPath],
  });

  fileWatcher.start();

  console.log("[main] Watching folder:", folderPath);

  return { name, path: folderPath };
});

// ── App Lifecycle ─────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
});

app.on("before-quit", async () => {
  if (fileWatcher) {
    await fileWatcher.stop();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
