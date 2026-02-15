import type { File, SearchResult, Folder } from "./types";

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<{ name: string; path: string } | null>;
      search: (query: string) => Promise<SearchResult[]>;
      hideSpotlight: () => Promise<void>;
      resizeSpotlight: (height: number) => void;
      onSpotlightReset: (callback: () => void) => () => void;
      onIndexingStatus: (
        callback: (status: {
          isIndexing: boolean;
          filesRemaining: number;
          totalFiles: number;
          completedFiles: number;
        }) => void
      ) => () => void;
    };
  }
}
