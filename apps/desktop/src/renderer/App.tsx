import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResultsList } from "./components/ResultsList";
import { SearchBar } from "./components/SearchBar";
import { Sidebar } from "./components/Sidebar";
import { AlertIcon, SparkIcon } from "./components/Icons";
import type { Folder, FolderState, ResultItem, SearchResult, SearchState } from "./types";

function pathBelongsToFolder(filePath: string, folderPath: string): boolean {
  return filePath === folderPath || filePath.startsWith(`${folderPath}/`) || filePath.startsWith(`${folderPath}\\`);
}

function extFromPath(filePath: string): string {
  const idx = filePath.lastIndexOf(".");
  return idx >= 0 ? filePath.slice(idx + 1).toLowerCase() : "file";
}

function baseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}

function normalizeResults(results: SearchResult[]): ResultItem[] {
  return results
    .filter((item): item is SearchResult & { filePath: string } => typeof item.filePath === "string" && item.filePath.length > 0)
    .map((item, index) => {
    const filePath = item.filePath ?? "";
    const rank = typeof item.rank === "number" ? item.rank : index + 1;
    return {
      id: `${filePath}-${rank}-${index}`,
      filePath,
      fileName: item.fileName ?? baseName(filePath) ?? "Untitled",
      fileType: (item.fileType ?? extFromPath(filePath) ?? "file").replace(".", ""),
      summary: item.summary?.trim() || "No summary available.",
      rank,
      modifiedLabel: item.lastModifiedReadable ? `Modified ${new Date(item.lastModifiedReadable).toLocaleDateString()}` : "Modified recently",
    };
  });
}

function defaultFolderState(folder: Folder): FolderState {
  return {
    ...folder,
    status: "indexing",
    indexedFiles: 0,
    lastEventAt: null,
  };
}

export default function App() {
  const [folders, setFolders] = useState<FolderState[]>([]);
  const [activeFolderPath, setActiveFolderPath] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const searchHint = isMac ? "⌘ K" : "Ctrl K";

  const folderMetrics = useMemo(() => {
    const indexing = folders.filter((f) => f.status === "indexing").length;
    const errors = folders.filter((f) => f.status === "error").length;
    return { indexing, errors };
  }, [folders]);

  useEffect(() => {
    const unsubscribe = window.api.onIndexingEvent((event) => {
      setFolders((prev) =>
        prev.map((folder) => {
          if (!pathBelongsToFolder(event.filePath, folder.path)) return folder;

          if (event.status === "processing") {
            return {
              ...folder,
              status: "indexing",
              lastEventAt: Date.now(),
            };
          }

          if (event.status === "indexed") {
            return {
              ...folder,
              status: "ready",
              indexedFiles: folder.indexedFiles + 1,
              lastEventAt: Date.now(),
              lastError: undefined,
            };
          }

          return {
            ...folder,
            status: "error",
            lastError: event.error,
            lastEventAt: Date.now(),
          };
        }),
      );
    });

    return unsubscribe;
  }, []);

  const handleAddFolder = useCallback(async () => {
    const pickedFolders = await window.api.selectFolders();
    if (pickedFolders.length === 0) return;

    setFolders((prev) => {
      const existing = new Set(prev.map((folder) => folder.path));
      const additions = pickedFolders
        .filter((folder) => !existing.has(folder.path))
        .map(defaultFolderState);
      if (additions.length === 0) return prev;
      return [...prev, ...additions];
    });
    setActiveFolderPath((current) => current ?? pickedFolders[0]?.path ?? null);
  }, []);

  const handleRemoveFolder = useCallback(async (path: string) => {
    await window.api.removeFolder(path);
    setFolders((prev) => prev.filter((f) => f.path !== path));
    setActiveFolderPath((current) => (current === path ? null : current));
  }, []);

  useEffect(() => {
    if (folders.length === 0) return;
    if (activeFolderPath && folders.some((folder) => folder.path === activeFolderPath)) return;
    setActiveFolderPath(folders[0].path);
  }, [activeFolderPath, folders]);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchState("idle");
      setResults([]);
      setSearchError(null);
      return;
    }

    setSearchState("searching");
    setSearchError(null);

    try {
      const rawResults = await window.api.search(trimmed);
      const normalized = normalizeResults(rawResults);
      setResults(normalized);
      setSelectedResultIndex(0);
      setSearchState(normalized.length > 0 ? "results" : "empty");
    } catch (error) {
      setResults([]);
      setSearchState("error");
      setSearchError(error instanceof Error ? error.message : String(error));
    }
  }, [query]);

  const openResult = useCallback(async (item: ResultItem) => {
    const response = await window.api.openFile(item.filePath);
    if (!response.ok) {
      setSearchState("error");
      setSearchError(response.error ?? "Could not open file");
    }
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setSelectedResultIndex(0);
    setSearchState("idle");
    setSearchError(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const inputFocused = document.activeElement === inputRef.current;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (event.key === "Escape") {
        clearSearch();
        return;
      }

      if (results.length === 0 || searchState !== "results") return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedResultIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedResultIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === "Enter") {
        if (inputFocused) return;
        event.preventDefault();
        const item = results[selectedResultIndex];
        if (item) void openResult(item);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSearch, openResult, results, searchState, selectedResultIndex]);

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setSearchState(newQuery.trim() ? "typing" : "idle");
  }, []);

  return (
    <div className="app">
      <Sidebar
        folders={folders}
        activeFolderPath={activeFolderPath}
        onAddFolder={handleAddFolder}
        onRemoveFolder={handleRemoveFolder}
        onSelectFolder={setActiveFolderPath}
      />

      <main className="main-content">
        <header className="app-header">
          <div className="app-title-wrap">
            <h1 className="app-title">Findly</h1>
            <p className="app-subtitle">Natural language search across local files</p>
          </div>
          <div className="header-status-row">
            <span className="header-pill">
              <SparkIcon size={12} />
              {folders.length} folder{folders.length === 1 ? "" : "s"}
            </span>
            <span className="header-pill">{folderMetrics.indexing} indexing</span>
            {folderMetrics.errors > 0 && <span className="header-pill danger">{folderMetrics.errors} issues</span>}
          </div>
        </header>

        <div className="main-stage">
          <SearchBar
            query={query}
            state={searchState}
            totalResults={results.length}
            searchHint={searchHint}
            inputRef={inputRef}
            onQueryChange={handleQueryChange}
            onSearch={() => void handleSearch()}
            onClear={clearSearch}
          />

          {folders.length === 0 && (
            <section className="hero-empty">
              <h2>No folders indexed yet</h2>
              <p>Add a folder from the sidebar to start indexing and search with AI ranking.</p>
              <button className="btn-add-folder primary" onClick={handleAddFolder}>
                Add first folder
              </button>
            </section>
          )}

          {folders.length > 0 && searchState === "idle" && (
            <section className="state-panel">
              <h2>Ready to search</h2>
              <p>Ask naturally, for example: “notes about distributed systems from last week”.</p>
            </section>
          )}

          {folders.length > 0 && searchState === "typing" && (
            <section className="state-panel subtle">
              <h2>Search queued</h2>
              <p>Press Enter to run semantic ranking over your indexed files.</p>
            </section>
          )}

          {searchState === "searching" && (
            <section className="skeleton-list" aria-label="Searching">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="skeleton-row" />
              ))}
            </section>
          )}

          {searchState === "error" && (
            <section className="error-panel" role="alert">
              <div className="error-title">
                <AlertIcon />
                Search failed
              </div>
              <p>{searchError ?? "Unexpected error"}</p>
            </section>
          )}

          {searchState === "empty" && (
            <section className="state-panel">
              <h2>No results</h2>
              <p>Try broader terms, recent file hints, or specific file types.</p>
            </section>
          )}

          {searchState === "results" && results.length > 0 && (
            <ResultsList
              items={results}
              selectedIndex={selectedResultIndex}
              onSelect={setSelectedResultIndex}
              onOpen={(item) => void openResult(item)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
