import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getAppStatus: (): Promise<{ ready: boolean; version: string; timestamp: number }> =>
    ipcRenderer.invoke("app-status"),
  selectFolder: (): Promise<{ name: string; path: string } | null> =>
    ipcRenderer.invoke("select-folder"),
  search: (query: string) => ipcRenderer.invoke("search", query),
  hideQuickSearch: (): Promise<boolean> => ipcRenderer.invoke("hide-quick-search"),
  openFile: (filePath: string): Promise<boolean> => ipcRenderer.invoke("open-file", filePath),
});
