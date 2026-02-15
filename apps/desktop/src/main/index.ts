import { app, Tray, Menu, BrowserWindow, ipcMain, dialog, globalShortcut, shell } from "electron";
import path from "path";
import { FileWatcherService } from "@findly/watcher";
console.log("[main] Electron main loaded");
let fileWatcher: FileWatcherService | null = null;
let watchedPaths: string[] = [];
let mainWindow: BrowserWindow | null = null;
let spotlightWindow: BrowserWindow | null = null;
let isQuitting = false;
let rankingAbortController: AbortController | null = null;

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

  // On macOS, hide the window instead of destroying it on close
  win.on("close", (e) => {
    if (process.platform === "darwin" && !isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

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
    properties: ["openDirectory", "multiSelections"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  // Filter out any folders already being watched
  const newPaths = result.filePaths.filter((p) => !watchedPaths.includes(p));
  if (newPaths.length === 0) return null;

  // Add new paths to the tracked list
  watchedPaths.push(...newPaths);

  // Stop existing watcher and restart with all paths
  if (fileWatcher) {
    await fileWatcher.stop();
  }

  // Start new watcher with indexing progress tracking
  fileWatcher = new FileWatcherService({
    paths: watchedPaths,
    onIndexingProgress: (processed, total) => {
      mainWindow?.webContents.send("indexing-progress", { processed, total });
    },
    onIndexingComplete: () => {
      mainWindow?.webContents.send("indexing-complete");
    },
  });

  fileWatcher.start();

  // Notify renderer that indexing has started
  mainWindow?.webContents.send("indexing-started");

  const folders = newPaths.map((p) => ({ name: path.basename(p), path: p }));
  console.log("[main] Watching folders:", watchedPaths);

  return folders;
});

ipcMain.handle("search", async (_, query: string) => {
  try {
    // Step 1: Get initial results from Pinecone (fast, no Gemini)
    const response = await fetch(
      `http://localhost:8100/search?query=${encodeURIComponent(query)}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = (await response.json()) as { results: any[] };

    const initialResults = data.results.map((item: any) => ({
      file: {
        name: item.fileName || path.basename(item.filePath),
        path: item.filePath,
        folder: path.dirname(item.filePath),
      },
      summary: "",
      metadata: {
        fileType: item.fileType || "",
        fileSize: item.fileSize || 0,
        sizeReadable: item.sizeReadable || "",
        lastModifiedReadable: item.lastModifiedReadable || "",
        lastAccessedReadable: item.lastAccessedReadable || "",
      },
    }));

    // Step 2: Kick off Gemini ranking in the background
    const filePaths = data.results
      .map((item: any) => item.filePath)
      .filter(Boolean);

    if (filePaths.length > 0) {
      // Abort any previous ranking request
      if (rankingAbortController) {
        rankingAbortController.abort();
      }
      rankingAbortController = new AbortController();
      const signal = rankingAbortController.signal;

      // Notify renderer that ranking has started
      mainWindow?.webContents.send("search-ranking-started");
      spotlightWindow?.webContents.send("search-ranking-started");

      fetch("http://localhost:8100/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, filePaths }),
        signal,
      })
        .then(async (rankResponse) => {
          if (!rankResponse.ok) throw new Error("Ranking request failed");
          const rankData = (await rankResponse.json()) as { results: any[] };
          // Merge ranked summaries with existing metadata from initial results
          const rankedResults = rankData.results.map((item: any) => {
            // Find matching initial result to preserve metadata
            const existing = initialResults.find((r: any) => r.file.path === item.filePath);
            return {
              file: {
                name: path.basename(item.filePath),
                path: item.filePath,
                folder: path.dirname(item.filePath),
              },
              summary: item.summary,
              metadata: existing?.metadata || {},
            };
          });
          // Send ranked results to all windows
          mainWindow?.webContents.send("search-ranked-results", rankedResults);
          spotlightWindow?.webContents.send(
            "search-ranked-results",
            rankedResults
          );
        })
        .catch((err) => {
          if (err.name === "AbortError") {
            console.log("[main] Ranking aborted");
            return;
          }
          console.error("[main] Ranking error:", err);
          // Signal ranking is done (even on failure) so indicator goes away
          mainWindow?.webContents.send("search-ranked-results", null);
          spotlightWindow?.webContents.send("search-ranked-results", null);
        });
    }

    // Return initial results immediately — no waiting for Gemini
    return initialResults;
  } catch (error) {
    console.error("[main] Search error:", error);
    return [];
  }
});

// ── IPC: Cancel Ranking ───────────────────────────────

ipcMain.handle("cancel-ranking", () => {
  if (rankingAbortController) {
    rankingAbortController.abort();
    rankingAbortController = null;
  }
});

// ── IPC: File Actions ─────────────────────────────────

ipcMain.handle("open-file", async (_, filePath: string) => {
  try {
    const result = await shell.openPath(filePath);
    if (result) {
      console.error("[main] Failed to open file:", result);
    }
    return result;
  } catch (error) {
    console.error("[main] open-file error:", error);
    return String(error);
  }
});

ipcMain.handle("show-in-folder", (_, filePath: string) => {
  try {
    shell.showItemInFolder(filePath);
  } catch (error) {
    console.error("[main] show-in-folder error:", error);
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
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (fileWatcher) {
    await fileWatcher.stop();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
});
