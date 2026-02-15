import type { SearchResult } from "./types";

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<{ name: string; path: string } | null>;
      selectFolders: () => Promise<Array<{ name: string; path: string }>>;
      removeFolder: (folderPath: string) => Promise<{ ok: boolean }>;
      search: (query: string) => Promise<SearchResult[]>;
      openFile: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
      onIndexingEvent: (
        cb: (event: {
          filePath: string;
          phase: "add" | "change";
          status: "processing" | "indexed" | "error";
          error?: string;
        }) => void,
      ) => () => void;
    };
  }
}
