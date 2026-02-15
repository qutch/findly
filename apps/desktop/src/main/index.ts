import { app, Tray, Menu, BrowserWindow, ipcMain, dialog, globalShortcut } from "electron";
import path from "path";
import { FileWatcherService } from "@findly/watcher";
console.log("[main] Electron main loaded");
let fileWatcher: FileWatcherService | null = null;
let mainWindow: BrowserWindow | null = null;
let spotlightWindow: BrowserWindow | null = null;

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

  mainWindow = win;
}

function createSpotlightWindow() {
  spotlightWindow = new BrowserWindow({
    width: 680,
    height: 72,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    titleBarStyle: "customButtonsOnHover",
    vibrancy: "under-window",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Center on screen
  spotlightWindow.center();

  if (process.env.ELECTRON_RENDERER_URL) {
    spotlightWindow.loadURL(
      process.env.ELECTRON_RENDERER_URL + "/spotlight.html"
    );
  } else {
    spotlightWindow.loadFile(
      path.join(__dirname, "../renderer/spotlight.html")
    );
  }

  spotlightWindow.on("blur", () => {
    hideSpotlight();
  });

  spotlightWindow.on("closed", () => {
    spotlightWindow = null;
  });
}

function toggleSpotlight() {
  if (!spotlightWindow) {
    createSpotlightWindow();
  }

  if (spotlightWindow!.isVisible()) {
    hideSpotlight();
  } else {
    // Reset size to just the search bar before showing
    spotlightWindow!.setSize(680, 72);
    spotlightWindow!.center();
    spotlightWindow!.show();
    spotlightWindow!.focus();
  }
}

function hideSpotlight() {
  if (spotlightWindow && spotlightWindow.isVisible()) {
    spotlightWindow.hide();
    // Tell renderer to reset state
    spotlightWindow.webContents.send("spotlight-reset");
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

ipcMain.handle("search", async (_, query: string) => {
  try {
    const response = await fetch(
      `http://localhost:8100/search?query=${query}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = (await response.json()) as { results: any[] };

    return data.results.map((item: any) => ({
      file: {
        name: path.basename(item.filePath),
        path: item.filePath,
        folder: path.dirname(item.filePath),
      },
      summary: item.summary,
    }));
  } catch (error) {
    console.error("[main] Search error:", error);
    return [];
  }
});

// ── IPC: Spotlight ────────────────────────────────────

ipcMain.handle("hide-spotlight", () => {
  hideSpotlight();
});

ipcMain.on("spotlight-resize", (_, height: number) => {
  if (spotlightWindow) {
    const [width] = spotlightWindow.getSize();
    const maxHeight = Math.min(height, 520);
    spotlightWindow.setSize(width, maxHeight);
    spotlightWindow.center();
  }
});

// ── App Lifecycle ─────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  createSpotlightWindow();

  // Register global shortcut: Cmd+Shift+Space (macOS) / Ctrl+Shift+Space (others)
  const shortcut =
    process.platform === "darwin"
      ? "CommandOrControl+Shift+Space"
      : "Ctrl+Shift+Space";

  globalShortcut.register(shortcut, () => {
    toggleSpotlight();
  });

  console.log(`[main] Spotlight shortcut registered: ${shortcut}`);
});

app.on("before-quit", async () => {
  globalShortcut.unregisterAll();
  if (fileWatcher) {
    await fileWatcher.stop();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {};
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  };
});
