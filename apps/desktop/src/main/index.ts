import { app, BrowserWindow, ipcMain, dialog, globalShortcut, shell } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { FileWatcherService } from "@findly/watcher";

console.log("[main] Electron main loaded");
let fileWatcher: FileWatcherService | null = null;
let mainWindow: BrowserWindow | null = null;
let quickSearchWindow: BrowserWindow | null = null;
let saveWindowStateTimeout: NodeJS.Timeout | null = null;

const QUICK_SEARCH_HASH = "quick-search";
const SEARCH_SERVICE_URL = process.env.FINDLY_SEARCH_URL ?? "http://127.0.0.1:8000";
const DEFAULT_WINDOW_STATE = { width: 1000, height: 700 };

interface SearchFile {
  name: string;
  path: string;
  folder: string;
  lastModified?: string | null;
}

interface NormalizedSearchResult {
  file: SearchFile;
  summary: string;
  reason: string;
}

function getWindowStatePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

async function readWindowState() {
  try {
    const payload = await fs.readFile(getWindowStatePath(), "utf8");
    const parsed = JSON.parse(payload) as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };

    return {
      x: parsed.x,
      y: parsed.y,
      width: Math.max(parsed.width ?? DEFAULT_WINDOW_STATE.width, 700),
      height: Math.max(parsed.height ?? DEFAULT_WINDOW_STATE.height, 500),
    };
  } catch {
    return DEFAULT_WINDOW_STATE;
  }
}

function scheduleWindowStateSave(win: BrowserWindow) {
  if (saveWindowStateTimeout) {
    clearTimeout(saveWindowStateTimeout);
  }

  saveWindowStateTimeout = setTimeout(() => {
    void fs.writeFile(
      getWindowStatePath(),
      JSON.stringify(win.getBounds()),
      "utf8",
    );
  }, 120);
}

async function enrichResultFile(
  file: { name?: string; path?: string; folder?: string } | null | undefined,
) {
  const filePath = file?.path ?? "";
  let lastModified: string | null = null;

  if (filePath) {
    try {
      const stats = await fs.stat(filePath);
      lastModified = stats.mtime.toISOString();
    } catch {
      // Ignore files that no longer exist.
    }
  }

  return {
    name: file?.name ?? path.basename(filePath || "Unknown file"),
    path: filePath,
    folder: file?.folder ?? (filePath ? path.dirname(filePath) : "Unknown folder"),
    lastModified,
  };
}

async function normalizeSearchPayload(payload: unknown, query: string) {
  const rawResults = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { results?: unknown[] } | null)?.results)
      ? ((payload as { results: unknown[] }).results ?? [])
      : [];

  const normalized = await Promise.all(
    rawResults.map(async (entry) => {
      const result = (entry ?? {}) as {
        file?: { name?: string; path?: string; folder?: string };
        filePath?: string;
        fileName?: string;
        folder?: string;
        lastModified?: string | null;
        lastModifiedReadable?: string | null;
        summary?: string;
        reason?: string;
      };
      const summary = result.summary?.trim() || "No generated summary available yet.";
      const reason =
        result.reason?.trim() ||
        `Matched because its content appears related to "${query}".`;
      const file = await enrichResultFile(
        result.file ?? {
          name: result.fileName,
          path: result.filePath,
          folder: result.folder,
        },
      );
      file.lastModified = file.lastModified ?? result.lastModified ?? result.lastModifiedReadable;

      return {
        file,
        summary,
        reason,
      } satisfies NormalizedSearchResult;
    }),
  );

  return normalized;
}

function loadRenderer(window: BrowserWindow, hash?: string) {
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = hash
      ? `${process.env.ELECTRON_RENDERER_URL}#${hash}`
      : process.env.ELECTRON_RENDERER_URL;
    window.loadURL(url);
  } else {
    window.loadFile(path.join(__dirname, "../renderer/index.html"), {
      hash,
    });
  }
}

function createMainWindow(windowState: {
  x?: number;
  y?: number;
  width: number;
  height: number;
}) {
  const win = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
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

  loadRenderer(win);
  mainWindow = win;

  win.on("resize", () => {
    scheduleWindowStateSave(win);
  });

  win.on("move", () => {
    scheduleWindowStateSave(win);
  });

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  return win;
}

function createQuickSearchWindow() {
  const win = new BrowserWindow({
    width: 760,
    height: 520,
    minWidth: 640,
    minHeight: 460,
    show: false,
    resizable: false,
    frame: false,
    titleBarStyle: "hidden",
    transparent: true,
    backgroundColor: "#00000000",
    skipTaskbar: true,
    alwaysOnTop: true,
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRenderer(win, QUICK_SEARCH_HASH);
  quickSearchWindow = win;

  win.on("blur", () => {
    if (!win.webContents.isDevToolsOpened()) {
      win.hide();
    }
  });

  win.on("closed", () => {
    if (quickSearchWindow === win) {
      quickSearchWindow = null;
    }
  });

  return win;
}

function toggleQuickSearchWindow() {
  if (!quickSearchWindow || quickSearchWindow.isDestroyed()) {
    createQuickSearchWindow();
  }

  if (!quickSearchWindow) {
    return;
  }

  if (quickSearchWindow.isVisible()) {
    quickSearchWindow.hide();
    return;
  }

  quickSearchWindow.center();
  quickSearchWindow.show();
  quickSearchWindow.focus();
}

// ── IPC: Folder Selection ─────────────────────────────

ipcMain.handle("app-status", async () => {
  return {
    ready: app.isReady(),
    version: app.getVersion(),
    timestamp: Date.now(),
  };
});

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

ipcMain.handle("search", async (_event, query: string) => {
  try {
    const searchUrl = new URL("/search", SEARCH_SERVICE_URL);
    searchUrl.searchParams.set("query", query);

    const response = await fetch(searchUrl, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Search request failed with status ${response.status}`);
    }

    const payload = await response.json();
    return normalizeSearchPayload(payload, query);
  } catch (error) {
    console.error("[main] search failed:", error);
    throw new Error(
      "Search service is unavailable. Start the Python service and try again.",
    );
  }
});

ipcMain.handle("hide-quick-search", async () => {
  if (quickSearchWindow && !quickSearchWindow.isDestroyed()) {
    quickSearchWindow.hide();
    return true;
  }
  return false;
});

ipcMain.handle("open-file", async (_event, filePath: string) => {
  if (!filePath) return false;
  const errorMessage = await shell.openPath(filePath);
  return errorMessage === "";
});

// ── App Lifecycle ─────────────────────────────────────

app.whenReady().then(async () => {
  const windowState = await readWindowState();
  createMainWindow(windowState);
  createQuickSearchWindow();

  globalShortcut.register("CommandOrControl+K", () => {
    if (mainWindow && mainWindow.isFocused() && !mainWindow.isMinimized()) {
      return;
    }
    toggleQuickSearchWindow();
  });
});

app.on("before-quit", async () => {
  globalShortcut.unregisterAll();

  if (fileWatcher) {
    await fileWatcher.stop();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow(DEFAULT_WINDOW_STATE);
  }
});
