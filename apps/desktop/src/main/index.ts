import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import { FileWatcherService, type FileProcessEvent } from "@findly/watcher";
console.log("[main] Electron main loaded");

let fileWatcher: FileWatcherService | null = null;
const watchedFolders = new Map<string, string>();
const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://127.0.0.1:8100/search";
const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS ?? 60000);

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

function emitIndexingEvent(event: FileProcessEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("indexing-event", event);
  }
}

async function restartWatcher(): Promise<void> {
  if (fileWatcher) {
    await fileWatcher.stop();
    fileWatcher = null;
  }

  const paths = [...watchedFolders.keys()];
  if (paths.length === 0) return;

  fileWatcher = new FileWatcherService({
    paths,
    onFileProcessEvent: emitIndexingEvent,
  });
  fileWatcher.start();
  console.log("[main] Watching folders:", paths);
}

async function addFolders(folderPaths: string[]): Promise<Array<{ name: string; path: string }>> {
  const added: Array<{ name: string; path: string }> = [];
  for (const folderPath of folderPaths) {
    const name = path.basename(folderPath);
    watchedFolders.set(folderPath, name);
    added.push({ name, path: folderPath });
  }

  await restartWatcher();
  return added;
}

// ── IPC: Folder Selection ─────────────────────────────

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const [folder] = await addFolders([result.filePaths[0]]);
  return folder ?? null;
});

ipcMain.handle("select-folders", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "multiSelections"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  return addFolders(result.filePaths);
});

ipcMain.handle("remove-folder", async (_event, folderPath: string) => {
  watchedFolders.delete(folderPath);
  await restartWatcher();
  return { ok: true };
});

ipcMain.handle("search", async (_event, query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${SEARCH_API_URL}?${new URLSearchParams({ query: trimmed }).toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { method: "GET", signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Search timed out after ${SEARCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status} ${response.statusText} ${body}`);
  }

  const payload: unknown = body ? JSON.parse(body) : [];
  if (Array.isArray(payload)) return payload;
  if (
    typeof payload === "object" &&
    payload !== null &&
    "rankedFiles" in payload &&
    Array.isArray((payload as { rankedFiles: unknown[] }).rankedFiles)
  ) {
    return (payload as { rankedFiles: unknown[] }).rankedFiles;
  }
  return [];
});

ipcMain.handle("open-file", async (_event, filePath: string) => {
  const error = await shell.openPath(filePath);
  return { ok: error === "", error: error || undefined };
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
