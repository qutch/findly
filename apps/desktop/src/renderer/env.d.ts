import type { File, SearchResult, Folder } from "./types";

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<{ name: string; path: string } | null>;
      search: (query: string) => Promise<SearchResult[]>;
    };
  }
}
