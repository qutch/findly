import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { SearchBar } from "./components/SearchBar";
import type { Folder, SearchResult } from "./types";

const SEARCH_HISTORY_KEY = "findly:search-history";
const LIVE_SEARCH_DELAY_MS = 320;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || !text) return text;

  const terms = normalizedQuery
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1)
    .slice(0, 6);

  if (!terms.length) return text;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (terms.some((term) => part.toLowerCase() === term.toLowerCase())) {
      return (
        <mark key={`${part}-${index}`} className="query-mark">
          {part}
        </mark>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function formatLastModified(value?: string | null) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function App() {
  const isQuickSearch = window.location.hash === "#quick-search";

  const [isBooting, setIsBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [indexingState, setIndexingState] = useState<"idle" | "indexing" | "ready">("idle");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState("");

  const historyBlurTimeoutRef = useRef<number | null>(null);
  const indexingTimerRef = useRef<number | null>(null);
  const liveSearchTimerRef = useRef<number | null>(null);

  const hasFolders = folders.length > 0;

  const searchableResults = useMemo(
    () => results.filter((result) => result?.file?.path),
    [results],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed)) {
        setRecentSearches(parsed.filter(Boolean).slice(0, 8));
      }
    } catch {
      // Ignore malformed local storage payload.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(recentSearches));
  }, [recentSearches]);

  useEffect(() => {
    let cancelled = false;

    const initializeApp = async () => {
      setIsBooting(true);
      setBootError(null);

      try {
        const [status] = await Promise.all([window.api.getAppStatus(), wait(700)]);
        if (cancelled) return;

        if (!status.ready) {
          setBootError("Core startup services are not ready yet.");
        }
      } catch {
        if (cancelled) return;
        setBootError("Unable to connect to the main process.");
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    };

    initializeApp();

    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  useEffect(() => {
    if (isSearching) {
      setSrAnnouncement("Searching files...");
      return;
    }

    if (searchError) {
      setSrAnnouncement(searchError);
      return;
    }

    if (!hasSearched) return;

    if (!searchableResults.length) {
      setSrAnnouncement("No results found.");
      return;
    }

    setSrAnnouncement(`${searchableResults.length} results found.`);
  }, [hasSearched, isSearching, searchableResults.length, searchError]);

  useEffect(() => {
    if (indexingState !== "indexing") return;

    indexingTimerRef.current = window.setTimeout(() => {
      setIndexingState("ready");
    }, 1800);

    return () => {
      if (indexingTimerRef.current) {
        window.clearTimeout(indexingTimerRef.current);
      }
    };
  }, [indexingState]);

  const pushSearchHistory = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setRecentSearches((prev) => {
      const withoutDuplicate = prev.filter(
        (entry) => entry.toLowerCase() !== trimmed.toLowerCase(),
      );
      return [trimmed, ...withoutDuplicate].slice(0, 8);
    });
  };

  const runSearch = async (
    rawQuery: string,
    options?: { recordHistory?: boolean },
  ) => {
    const trimmedQuery = rawQuery.trim();

    if (!trimmedQuery) {
      setResults([]);
      setHasSearched(false);
      setSearchError(null);
      setActiveResultIndex(-1);
      return [];
    }

    if (!hasFolders) {
      setSearchError("Add a folder first so Findly can index your files.");
      setHasSearched(true);
      return [];
    }

    setIsSearching(true);
    setSearchError(null);

    const startTime = performance.now();

    try {
      const nextResults = await window.api.search(trimmedQuery);
      const elapsed = performance.now() - startTime;

      if (elapsed < 260) {
        await wait(260 - elapsed);
      }

      setResults(nextResults);
      setHasSearched(true);
      setActiveResultIndex(nextResults.length > 0 ? 0 : -1);
      setExpandedReasons({});

      if (options?.recordHistory !== false) {
        pushSearchHistory(trimmedQuery);
      }

      return nextResults;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Search failed. Please try again.";

      setResults([]);
      setHasSearched(true);
      setActiveResultIndex(-1);
      setSearchError(message);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async () => runSearch(query, { recordHistory: true });

  const handleRunRecentSearch = async (value: string) => {
    setQuery(value);
    setShowSearchHistory(false);
    await runSearch(value, { recordHistory: true });
  };

  const handleClearSearch = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setSearchError(null);
    setActiveResultIndex(-1);
    setShowSearchHistory(false);
  };

  const handleCloseQuickSearch = async () => {
    if (!isQuickSearch) return;
    await window.api.hideQuickSearch();
  };

  const handleOpenResult = async (result: SearchResult) => {
    const opened = await window.api.openFile(result.file.path);
    if (!opened) {
      setSearchError("Unable to open that file. It may no longer exist.");
      return;
    }

    if (isQuickSearch) {
      await handleCloseQuickSearch();
    }
  };

  const handleSubmitSelection = () => {
    if (activeResultIndex < 0 || !searchableResults[activeResultIndex]) {
      return false;
    }

    void handleOpenResult(searchableResults[activeResultIndex]);
    return true;
  };

  const moveResultSelection = (direction: "up" | "down") => {
    if (!searchableResults.length) return;

    setActiveResultIndex((prev) => {
      if (prev === -1) return 0;
      if (direction === "down") {
        return (prev + 1) % searchableResults.length;
      }
      return (prev - 1 + searchableResults.length) % searchableResults.length;
    });
  };

  const handleAddFolder = async () => {
    const folder = await window.api.selectFolder();
    if (!folder) return;

    if (folders.some((item) => item.path === folder.path)) return;

    setFolders((prev) => [...prev, folder]);
    setIndexingState("indexing");
    setSearchError(null);
  };

  const handleRemoveFolder = (path: string) => {
    setFolders((prev) => {
      const next = prev.filter((folder) => folder.path !== path);
      if (next.length === 0) {
        setIndexingState("idle");
        handleClearSearch();
      }
      return next;
    });
  };

  useEffect(() => {
    if (!query.trim() || !hasFolders) return;

    if (liveSearchTimerRef.current) {
      window.clearTimeout(liveSearchTimerRef.current);
    }

    liveSearchTimerRef.current = window.setTimeout(() => {
      void runSearch(query, { recordHistory: false });
    }, LIVE_SEARCH_DELAY_MS);

    return () => {
      if (liveSearchTimerRef.current) {
        window.clearTimeout(liveSearchTimerRef.current);
      }
    };
  }, [query, hasFolders]);

  useEffect(() => {
    if (isQuickSearch) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const isSearchShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isSearchShortcut) return;

      event.preventDefault();
      const input = document.getElementById("global-search-input");
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isQuickSearch]);

  useEffect(() => {
    if (!isQuickSearch) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !query) {
        void handleCloseQuickSearch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isQuickSearch, query]);

  const handleSearchFocus = () => {
    if (historyBlurTimeoutRef.current) {
      window.clearTimeout(historyBlurTimeoutRef.current);
    }

    if (recentSearches.length > 0) {
      setShowSearchHistory(true);
    }
  };

  const handleSearchBlur = () => {
    historyBlurTimeoutRef.current = window.setTimeout(() => {
      setShowSearchHistory(false);
    }, 120);
  };

  const indexStatusText =
    indexingState === "indexing"
      ? "Indexing in progress"
      : indexingState === "ready"
        ? "Indexing complete"
        : "No active index";

  const renderSearchHistory = () => {
    if (!showSearchHistory || recentSearches.length === 0) return null;

    return (
      <div className="search-history-panel" role="listbox" aria-label="Recent searches">
        <div className="search-history-title">Recent searches</div>
        {recentSearches.map((item) => (
          <button
            key={item}
            className="search-history-item"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              void handleRunRecentSearch(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>
    );
  };

  const renderResults = () => {
    if (isSearching) {
      return (
        <div className="result-skeleton-list" aria-label="Loading results">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="result-skeleton" key={`skeleton-${index}`} />
          ))}
        </div>
      );
    }

    if (searchError) {
      return (
        <p className="results-error">
          {searchError} Try checking your service status or using a simpler query.
        </p>
      );
    }

    if (!hasSearched) {
      return (
        <p className="results-hint">
          Ask naturally, like "notes from last week" or "yesterday's homework".
        </p>
      );
    }

    if (searchableResults.length === 0) {
      return (
        <div className="results-empty-state">
          <p className="results-hint">No matches for "{query}".</p>
          <p className="results-empty-help">
            Try broader terms, remove date constraints, or search by file type.
          </p>
        </div>
      );
    }

    return (
      <ul className="results-list" role="listbox" aria-label="Search results">
        {searchableResults.map((result, index) => {
          const id = `${result.file.path}-${index}`;
          const isActive = index === activeResultIndex;
          const isHighConfidence = result.summary.length > 70;
          const showReason = expandedReasons[id];

          return (
            <li key={id}>
              <button
                type="button"
                className={`result-item ${isActive ? "is-active" : ""}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveResultIndex(index)}
                onClick={() => {
                  void handleOpenResult(result);
                }}
              >
                <div className="result-top-row">
                  <div className="result-file-name">{highlightText(result.file.name, query)}</div>
                  <span
                    className={`confidence-chip ${isHighConfidence ? "is-high" : "is-low"}`}
                  >
                    {isHighConfidence ? "Strong match" : "Possible match"}
                  </span>
                </div>

                <div className="result-meta-row">
                  <span>Updated {formatLastModified(result.file.lastModified)}</span>
                  <span>{highlightText(result.file.folder || "Unknown folder", query)}</span>
                </div>

                <p className="result-summary-label">AI-generated summary</p>
                <p className="result-summary">{highlightText(result.summary, query)}</p>

                <div className="result-actions-row">
                  <button
                    type="button"
                    className="why-result-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedReasons((prev) => ({
                        ...prev,
                        [id]: !prev[id],
                      }));
                    }}
                  >
                    Why this result?
                  </button>
                  <span className="result-path">{highlightText(result.file.path, query)}</span>
                </div>

                {showReason ? (
                  <p className="result-reason">
                    Matched because: {result.reason ?? "The file semantically aligns with your query."}
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderSearchSection = (inputId: string, placeholder: string, autoFocus = false) => (
    <section className="search-shell">
      <SearchBar
        query={query}
        isSearching={isSearching}
        disabled={!hasFolders}
        onQueryChange={setQuery}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        onEscape={isQuickSearch ? handleCloseQuickSearch : undefined}
        inputId={inputId}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={handleSearchFocus}
        onBlur={handleSearchBlur}
        onArrowDown={() => moveResultSelection("down")}
        onArrowUp={() => moveResultSelection("up")}
        onSubmitSelection={handleSubmitSelection}
      />
      <div className="search-help-row">
        <span className="search-help-text">
          {hasFolders
            ? "Live semantic search enabled"
            : "Select a folder to enable search"}
        </span>
        <span className="search-help-shortcut">Cmd/Ctrl + K</span>
      </div>
      {renderSearchHistory()}
    </section>
  );

  if (isBooting || bootError) {
    return (
      <div className="boot-screen">
        <div className="boot-screen-orb" />
        <div className="boot-panel">
          <div className="boot-logo">F</div>
          <h1 className="boot-title">Findly</h1>
          <p className="boot-subtitle">{bootError ?? "Preparing your intelligent file workspace"}</p>
          {isBooting ? (
            <div className="boot-progress">
              <div className="boot-progress-fill" />
            </div>
          ) : (
            <button className="boot-retry-button" onClick={() => setBootAttempt((prev) => prev + 1)}>
              Retry Startup
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isQuickSearch) {
    return (
      <div className="quick-search-page">
        <div className="quick-search-panel">
          <header className="quick-search-header">
            <div>
              <h1 className="quick-search-title">Findly Quick Search</h1>
              <p className="quick-search-subtitle">Semantic search for your indexed local files.</p>
            </div>
            <button className="quick-close-button" onClick={handleCloseQuickSearch}>
              Esc
            </button>
          </header>

          {renderSearchSection("quick-search-input", "Try: yesterday's homework", true)}

          <section className="results-panel quick-results-panel">
            <div className="results-header">
              <h2 className="results-title">Results</h2>
              {hasSearched && !searchError ? (
                <span className="results-count">{searchableResults.length} found</span>
              ) : null}
            </div>
            {renderResults()}
          </section>
          <div className="sr-only" aria-live="polite">
            {srAnnouncement}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        folders={folders}
        onAddFolder={handleAddFolder}
        onRemoveFolder={handleRemoveFolder}
      />
      <main className="main-content">
        <div className="main-inner">
          <header className="workspace-header">
            <div>
              <h1 className="workspace-title">Findly</h1>
              <p className="workspace-subtitle">
                Search with natural language across your indexed files.
              </p>
              <div className="indexing-status-row" aria-live="polite">
                <span className={`indexing-pill is-${indexingState}`}>{indexStatusText}</span>
                {indexingState === "indexing" ? <span className="indexing-loader" /> : null}
              </div>
            </div>
            <div className="workspace-stats">
              <span className="stat-chip">{folders.length} folders</span>
              {hasSearched ? <span className="stat-chip">{searchableResults.length} matches</span> : null}
              <span className="stat-chip ai-chip">AI ranked</span>
            </div>
          </header>

          {renderSearchSection("global-search-input", "Try: yesterday's homework")}

          {folders.length === 0 ? (
            <section className="onboarding-card">
              <h2 className="onboarding-title">Start by selecting a folder</h2>
              <p className="onboarding-subtitle">
                Findly indexes your files in the background, then lets you search instantly.
              </p>
              <button className="btn-primary" onClick={handleAddFolder}>
                Select Folder
              </button>
            </section>
          ) : (
            <section className="results-panel">
              <div className="results-header">
                <h2 className="results-title">Results</h2>
                {hasSearched && !searchError ? (
                  <span className="results-count">{searchableResults.length} found</span>
                ) : null}
              </div>
              {renderResults()}
            </section>
          )}
        </div>
      </main>
      <div className="sr-only" aria-live="polite">
        {srAnnouncement}
      </div>
    </div>
  );
}
