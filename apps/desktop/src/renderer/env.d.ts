import type { File, SearchResult, Folder } from "./types";

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<{ name: string; path: string } | null>;
      search: (query: string) => Promise<SearchResult[]>;
      hideSpotlight: () => Promise<void>;
      resizeSpotlight: (height: number) => void;
      onSpotlightReset: (callback: () => void) => () => void;
      onRankingStarted: (callback: () => void) => () => void;
      onRankedResults: (callback: (results: SearchResult[] | null) => void) => () => void;
      openFile: (filePath: string) => Promise<string>;
      showInFolder: (filePath: string) => Promise<void>;
      onIndexingStarted: (callback: () => void) => () => void;
      onIndexingProgress: (callback: (progress: { processed: number; total: number }) => void) => () => void;
      onIndexingComplete: (callback: () => void) => () => void;
    };
  }
}
