import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  selectFolder: (): Promise<{ name: string; path: string }[] | null> =>
    ipcRenderer.invoke("select-folder"),
  search: (query: string): Promise<any> => ipcRenderer.invoke("search", query),
  hideSpotlight: (): Promise<void> => ipcRenderer.invoke("hide-spotlight"),
  resizeSpotlight: (height: number): void =>
    ipcRenderer.send("spotlight-resize", height),
  onSpotlightReset: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on("spotlight-reset", handler);
    return () => ipcRenderer.removeListener("spotlight-reset", handler);
  },
  onRankingStarted: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on("search-ranking-started", handler);
    return () => ipcRenderer.removeListener("search-ranking-started", handler);
  },
  onRankedResults: (callback: (results: any[] | null) => void): (() => void) => {
    const handler = (_: any, results: any[] | null) => callback(results);
    ipcRenderer.on("search-ranked-results", handler);
    return () => ipcRenderer.removeListener("search-ranked-results", handler);
  },
  openFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke("open-file", filePath),
  showInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("show-in-folder", filePath),
  onIndexingStarted: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on("indexing-started", handler);
    return () => ipcRenderer.removeListener("indexing-started", handler);
  },
  onIndexingProgress: (callback: (progress: { processed: number; total: number }) => void): (() => void) => {
    const handler = (_: any, progress: { processed: number; total: number }) => callback(progress);
    ipcRenderer.on("indexing-progress", handler);
    return () => ipcRenderer.removeListener("indexing-progress", handler);
  },
  onIndexingComplete: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on("indexing-complete", handler);
    return () => ipcRenderer.removeListener("indexing-complete", handler);
  },
});
