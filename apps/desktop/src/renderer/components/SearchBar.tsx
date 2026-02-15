import { ClockIcon, SearchIcon, SendIcon, SparkIcon } from "./Icons";
import type { SearchState } from "../types";
import { memo } from "react";
import type { RefObject } from "react";

interface SearchBarProps {
  query: string;
  state: SearchState;
  totalResults: number;
  searchHint: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (newQuery: string) => void;
  onSearch: () => void;
  onClear: () => void;
}

export const SearchBar = memo(function SearchBar({
  query,
  state,
  totalResults,
  searchHint,
  inputRef,
  onQueryChange,
  onSearch,
  onClear,
}: SearchBarProps) {
  return (
    <section className="search-shell">
      <div className="search-topline">
        <div className="search-topline-left">
          <SparkIcon size={14} />
          <span>AI Search</span>
        </div>
        <kbd className="kbd-chip">{searchHint}</kbd>
      </div>

      <div className="search-bar">
        <SearchIcon className="search-leading-icon" />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Ask about anything in your files..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
            if (e.key === "Escape") onClear();
          }}
          aria-label="Search files"
        />
        {query && (
          <button className="search-clear" onClick={onClear} title="Clear search">
            Clear
          </button>
        )}
        <button className="search-button" onClick={onSearch} title="Run search">
          <SendIcon size={16} />
        </button>
      </div>

      <div className="search-status-line" aria-live="polite">
        {state === "searching" && (
          <span className="search-status">
            <span className="status-dot status-pulse" />
            Searching and ranking with AI...
          </span>
        )}
        {state === "results" && (
          <span className="search-status">
            <ClockIcon size={14} />
            {totalResults} result{totalResults === 1 ? "" : "s"} ranked
          </span>
        )}
        {state === "typing" && query.trim().length > 0 && (
          <span className="search-status">Press Enter to search</span>
        )}
      </div>
    </section>
  );
});
