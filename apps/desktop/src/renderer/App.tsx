import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { SearchBar } from "./components/SearchBar";
import { ResultsList } from "./components/ResultsList";
import type { Folder, SearchResult, File } from "./types";

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [filesRemaining, setFilesRemaining] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [completedFiles, setCompletedFiles] = useState(0);

  // Listen for indexing status from main process
  useEffect(() => {
    const cleanup = window.api.onIndexingStatus((status) => {
      setIsIndexing(status.isIndexing);
      setFilesRemaining(status.filesRemaining);
      setTotalFiles(status.totalFiles);
      setCompletedFiles(status.completedFiles);
    });
    return cleanup;
  }, []);

  // Handles adding a new folder
  const handleAddFolder = async () => {
    const folder = await window.api.selectFolder();
    if (!folder) return;

    // Don't add duplicates
    if (folders.some((f) => f.path === folder.path)) return;
    setFolders((prev) => [...prev, folder]);
  };

  // Handles searches
  const handleSearch = async () => {
    if (!query.trim()) return [];
    setIsSearching(true);
    setResults([]);
    try {
      const results = await window.api.search(query);
      setResults(results);
      return results;
    } catch (err) {
      console.error("Search error:", err);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const handleRemoveFolder = (path: string) => {
    setFolders((prev) => prev.filter((f) => f.path !== path));
  };

  return (
    <div className="app">
      <Sidebar
        folders={folders}
        onAddFolder={handleAddFolder}
        onRemoveFolder={handleRemoveFolder}
      />
      <main className="main-content">
        <div className="main-placeholder">
          <div className="main-placeholder-title">Findly</div>
          <div className="main-placeholder-subtitle">
            {folders.length === 0
              ? "Add a folder to get started"
              : isIndexing
              ? `Indexing files... ${completedFiles}/${totalFiles} processed`
              : "Search your files"}
          </div>
          {folders.length === 0
          ? <></>
          :<SearchBar query={query} onQueryChange={setQuery} onSearch={handleSearch} disabled={isIndexing || isSearching} />}
          {isSearching && (
            <div className="search-loading">
              <div className="search-spinner" />
              <span>Searching across galaxies...</span>
            </div>
          )}
          <ResultsList results={results} />
        </div>
      </main>
    </div>
  );
}
