export interface Folder {
    name: string;
    path: string;
}

export interface File {
    name: string;
    path: string;
    folder: string;
}

export interface SearchResult {
    file: File;
    summary: string;
}
