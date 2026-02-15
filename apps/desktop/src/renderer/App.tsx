import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { SearchBar } from "./components/SearchBar";
import { ResultsList } from "./components/ResultsList";
import { FilePreview } from "./components/FilePreview";
import type { Folder, SearchResult, File } from "./types";

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRanking, setIsRanking] = useState(false);
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);
  const [indexingProgress, setIndexingProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);

  const isIndexing = indexingProgress !== null;

  // Listen for background ranking events from main process
  useEffect(() => {
    const cleanupStarted = window.api.onRankingStarted(() => {
      setIsRanking(true);
    });

    const cleanupRanked = window.api.onRankedResults((rankedResults) => {
      setIsRanking(false);
      if (rankedResults && rankedResults.length > 0) {
        setResults(rankedResults);
        // Update preview if it's open — sync the summary
        setPreviewResult((prev) => {
          if (!prev) return null;
          const updated = rankedResults.find(
            (r: SearchResult) => r.file?.path === prev.file?.path
          );
          return updated ?? prev;
        });
      }
    });

    return () => {
      cleanupStarted();
      cleanupRanked();
    };
  }, []);

  // Listen for indexing progress events from main process
  useEffect(() => {
    const cleanupStarted = window.api.onIndexingStarted(() => {
      setIndexingProgress({ processed: 0, total: 0 });
    });

    const cleanupProgress = window.api.onIndexingProgress((progress) => {
      setIndexingProgress(progress);
    });

    const cleanupComplete = window.api.onIndexingComplete(() => {
      setIndexingProgress(null);
    });

    return () => {
      cleanupStarted();
      cleanupProgress();
      cleanupComplete();
    };
  }, []);

  // Handles adding new folders (supports multi-selection)
  const handleAddFolder = async () => {
    const newFolders = await window.api.selectFolder();
    if (!newFolders || newFolders.length === 0) return;

    setFolders((prev) => {
      const existingPaths = new Set(prev.map((f) => f.path));
      const unique = newFolders.filter((f) => !existingPaths.has(f.path));
      return [...prev, ...unique];
    });
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
              disabled={isIndexing}
            />
          )}
          {isIndexing && indexingProgress && (
            <div className="indexing-progress">
              <div className="indexing-progress__bar">
                <div
                  className="indexing-progress__fill"
                  style={{
                    width:
                      indexingProgress.total > 0
                        ? `${(indexingProgress.processed / indexingProgress.total) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              <span className="indexing-progress__text">
                Indexing files: {indexingProgress.processed} / {indexingProgress.total}
              </span>
            </div>
          )}
          {isRanking && (
            <div className="ranking-indicator">
              <div className="ranking-spinner" />
              <span className="ranking-text">Advanced analysis underway</span>
            </div>
          )}
          <ResultsList results={results} onPreview={setPreviewResult} />
        </div>
      </main>
      {previewResult && (
        <FilePreview
          result={previewResult}
          onClose={() => setPreviewResult(null)}
          isRanking={isRanking}
        />
      )}
    </div>
  );
}
