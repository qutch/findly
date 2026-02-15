export interface Folder {
  name: string;
  path: string;
}

export type FolderStatus = "indexing" | "ready" | "error";

export interface FolderState extends Folder {
  status: FolderStatus;
  indexedFiles: number;
  lastEventAt: number | null;
  lastError?: string;
}

export type SearchState = "idle" | "typing" | "searching" | "results" | "empty" | "error";

export interface SearchResult {
  filePath?: string;
  summary?: string;
  rank?: number;
  fileName?: string;
  fileType?: string;
  lastModifiedReadable?: string;
  score?: number;
}

export interface ResultItem {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  summary: string;
  rank: number;
  modifiedLabel: string;
}
