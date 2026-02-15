import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  selectFolder: (): Promise<{ name: string; path: string } | null> =>
    ipcRenderer.invoke("select-folder"),
  selectFolders: (): Promise<Array<{ name: string; path: string }>> =>
    ipcRenderer.invoke("select-folders"),
  removeFolder: (folderPath: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("remove-folder", folderPath),
  search: (query: string): Promise<unknown[]> =>
    ipcRenderer.invoke("search", query),
  openFile: (filePath: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("open-file", filePath),
  onIndexingEvent: (
    cb: (event: {
      filePath: string;
      phase: "add" | "change";
      status: "processing" | "indexed" | "error";
      error?: string;
    }) => void,
  ): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: {
      filePath: string;
      phase: "add" | "change";
      status: "processing" | "indexed" | "error";
      error?: string;
    }) => cb(event);
    ipcRenderer.on("indexing-event", listener);
    return () => ipcRenderer.removeListener("indexing-event", listener);
  },
});
