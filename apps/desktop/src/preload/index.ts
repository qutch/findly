import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  selectFolder: (): Promise<{ name: string; path: string } | null> =>
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
  onIndexingStatus: (
    callback: (status: { isIndexing: boolean; filesRemaining: number; totalFiles: number; completedFiles: number }) => void
  ): (() => void) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on("indexing-status", handler);
    return () => ipcRenderer.removeListener("indexing-status", handler);
  },
});
