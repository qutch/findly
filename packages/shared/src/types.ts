export interface FileMetadata {
  id: string;
  filePath: string;
  fileType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  summary: string;
  tags?: string[];
}

export interface SearchQuery {
  query: string;
}

export interface SearchResult {
  file: FileMetadata;
  score: number;
  snippet?: string;
}