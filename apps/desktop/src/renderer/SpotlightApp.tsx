import { useState, useEffect, useRef, useCallback } from "react";
import type { SearchResult } from "./types";

export function SpotlightApp() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on mount and on reset
  useEffect(() => {
    inputRef.current?.focus();

    const cleanup = window.api.onSpotlightReset(() => {
      setQuery("");
      setResults([]);
      setIsLoading(false);
      inputRef.current?.focus();
    });

    return cleanup;
  }, []);

  // Resize the window when results change
  const resizeWindow = useCallback(() => {
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const height = containerRef.current.scrollHeight + 16;
        window.api.resizeSpotlight(height);
      }
    });
  }, []);

  useEffect(() => {
    resizeWindow();
  }, [results, isLoading, resizeWindow]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsLoading(true);
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
    <div className="spotlight-container" ref={containerRef}>
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

      {/* Results */}
      {!isLoading && results.length > 0 && (
        <div className="spotlight-results">
          {results.map((result, index) => (
            <div className="spotlight-result-item" key={`${result.file?.path}-${index}`}>
              <div className="spotlight-result-rank">#{index + 1}</div>
              <div className="spotlight-result-content">
                <div className="spotlight-result-name">
                  {result.file?.name ?? "Untitled"}
                </div>
                <div className="spotlight-result-path">
                  {result.file?.path ?? ""}
                </div>
                {result.summary && (
                  <div className="spotlight-result-summary">
                    {result.summary}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {!isLoading && results.length === 0 && query.length > 0 && results !== null && (
        <div className="spotlight-hint">Press Enter to search</div>
      )}
    </div>
  );
}
