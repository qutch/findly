export interface FileMetadata {
  filePath: string;
  fileType: string;
  fileSize: number;
  lastAccessedAt: string;
  lastUpdatedAt: string;
  createdAt: string;
  content: string;
}

export interface SearchQuery {
  query: string;
}

export interface SearchResult {
  file: FileMetadata;
  score: number;
  snippet?: string;
}