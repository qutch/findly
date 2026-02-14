import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  selectFolder: (): Promise<{ name: string; path: string } | null> =>
    ipcRenderer.invoke("select-folder"),
});
