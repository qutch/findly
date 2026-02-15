import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { SearchBar } from "./components/SearchBar";
import { ResultsList } from "./components/ResultsList";
import type { Folder, SearchResult, File } from "./types";

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRanking, setIsRanking] = useState(false);

  // Listen for background ranking events from main process
  useEffect(() => {
    const cleanupStarted = window.api.onRankingStarted(() => {
      setIsRanking(true);
    });

    const cleanupRanked = window.api.onRankedResults((rankedResults) => {
      setIsRanking(false);
      if (rankedResults && rankedResults.length > 0) {
        setResults(rankedResults);
      }
    });

    return () => {
      cleanupStarted();
      cleanupRanked();
    };
  }, []);

  // Handles adding a new folder
  const handleAddFolder = async () => {
    const folder = await window.api.selectFolder();
    if (!folder) return;

    // Don't add duplicates
    if (folders.some((f) => f.path === folder.path)) return;
    setFolders((prev) => [...prev, folder]);
  };

  // Handles searches — returns initial results instantly, Gemini ranking happens in background
  const handleSearch = async () => {
    if (!query.trim()) return [];
    setIsLoading(true);
    setIsRanking(false);
    try {
      const results = await window.api.search(query);
      setResults(results);
      return results;
    } finally {
      setIsLoading(false);
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
          <div className="main-header">
            <div className="main-placeholder-title">Findly</div>
            <div className="main-placeholder-subtitle">
              {folders.length === 0
                ? "Add a folder to get started"
                : "Search your files"}
            </div>
          </div>
          {folders.length > 0 && (
            <SearchBar
              query={query}
              onQueryChange={setQuery}
              onSearch={handleSearch}
              isLoading={isLoading}
            />
          )}
          {isRanking && (
            <div className="ranking-indicator">
              <div className="ranking-spinner" />
              <span className="ranking-text">Advanced analysis underway</span>
            </div>
          )}
          <ResultsList results={results} />
        </div>
      </main>
    </div>
  );
}
