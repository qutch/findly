import { useState, useEffect, useRef, useCallback } from "react";
import { ResultItem } from "./components/ResultItem";
import { FilePreview } from "./components/FilePreview";
import type { SearchResult } from "./types";

export function SpotlightApp() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRanking, setIsRanking] = useState(false);
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on mount and on reset
  useEffect(() => {
    inputRef.current?.focus();

    const cleanupReset = window.api.onSpotlightReset(() => {
      setQuery("");
      setResults([]);
      setIsLoading(false);
      setIsRanking(false);
      setPreviewResult(null);
      inputRef.current?.focus();
    });

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
      cleanupReset();
      cleanupStarted();
      cleanupRanked();
    };
  }, []);

  // Resize the window when results change
  const resizeWindow = useCallback(() => {
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const height = containerRef.current.scrollHeight;
        window.api.resizeSpotlight(height);
      }
    });
  }, []);

  useEffect(() => {
    resizeWindow();
  }, [results, isLoading, isRanking, previewResult, resizeWindow]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setIsRanking(false);
    setResults([]);
    resizeWindow();

    try {
      const res = await window.api.search(trimmed);
      setResults(res);
    } catch (err) {
      console.error("Spotlight search error:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    } else if (e.key === "Escape") {
      window.api.hideSpotlight();
    }
  };

  return (
    <div className={`spotlight-container${isLoading ? " spotlight-container--loading" : ""}`} ref={containerRef}>
      {/* Search input */}
      <div className="spotlight-input-wrapper">
        <svg
          className="spotlight-search-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="spotlight-input"
          placeholder="Findly Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            className="spotlight-clear"
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="spotlight-loading">
          <div className="spotlight-spinner" />
          <span>Searching...</span>
        </div>
      )}

      {/* Ranking indicator */}
      {!isLoading && isRanking && (
        <div className="spotlight-ranking">
          <div className="spotlight-ranking-spinner" />
          <span>Advanced analysis underway</span>
        </div>
      )}

      {/* Results */}
      {!isLoading && results.length > 0 && (
        <div className="spotlight-results">
          {results.map((result, index) => (
            <ResultItem
              key={`${result.file?.path}-${index}`}
              result={result}
              animationDelay={index * 40}
              onPreview={setPreviewResult}
            />
          ))}
        </div>
      )}

      {/* No results */}
      {!isLoading && results.length === 0 && query.length > 0 && results !== null && (
        <div className="spotlight-hint">Press Enter to search</div>
      )}

      {/* File Preview */}
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
