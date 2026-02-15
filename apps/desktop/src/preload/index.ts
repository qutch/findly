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
  openFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke("open-file", filePath),
  showInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("show-in-folder", filePath),
});
