import type { SearchResult } from "./types";

interface AppStatus {
  ready: boolean;
  version: string;
  timestamp: number;
}

declare global {
  interface Window {
    api: {
      getAppStatus: () => Promise<AppStatus>;
      selectFolder: () => Promise<{ name: string; path: string } | null>;
      search: (query: string) => Promise<SearchResult[]>;
      hideQuickSearch: () => Promise<boolean>;
      openFile: (filePath: string) => Promise<boolean>;
    };
  }
}
