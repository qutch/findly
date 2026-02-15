import type { File, SearchResult, Folder } from "./types";

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<{ name: string; path: string } | null>;
      search: (query: string) => Promise<SearchResult[]>;
      hideSpotlight: () => Promise<void>;
      resizeSpotlight: (height: number) => void;
      onSpotlightReset: (callback: () => void) => () => void;
      openFile: (filePath: string) => Promise<string>;
      showInFolder: (filePath: string) => Promise<void>;
    };
  }
}
