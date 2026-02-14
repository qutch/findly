import type { SearchResult } from "../types";
import { SendIcon, XIcon } from "./Icons";

interface SearchBarProps {
  query: string;
  isSearching: boolean;
  disabled?: boolean;
  onQueryChange: (newQuery: string) => void;
  onSearch: () => Promise<SearchResult[]>;
  onClear: () => void;
  onEscape?: () => void;
  placeholder?: string;
  inputId?: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onArrowDown?: () => void;
  onArrowUp?: () => void;
  onSubmitSelection?: () => boolean;
}

export function SearchBar({
  query,
  isSearching,
  disabled = false,
  onQueryChange,
  onSearch,
  onClear,
  onEscape,
  placeholder = "Search files...",
  inputId = "global-search-input",
  autoFocus = false,
  onFocus,
  onBlur,
  onArrowDown,
  onArrowUp,
  onSubmitSelection,
}: SearchBarProps) {
  const isDisabled = disabled || isSearching;

  return (
    <div className="search-bar">
      <label htmlFor={inputId} className="sr-only">
        Search files
      </label>
      <input
        id={inputId}
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={query}
        autoFocus={autoFocus}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (onSubmitSelection?.()) return;
            onSearch();
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onArrowDown?.();
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onArrowUp?.();
          }
          if (e.key === "Escape") {
            if (query) {
              onClear();
            } else {
              onEscape?.();
            }
          }
        }}
      />
      {query ? (
        <button
          className="search-clear-button"
          onClick={onClear}
          title="Clear search"
          aria-label="Clear search"
        >
          <XIcon size={14} />
        </button>
      ) : null}
      <button
        className={`search-button ${isSearching ? "is-searching" : ""}`}
        onClick={onSearch}
        disabled={isDisabled}
        title={isSearching ? "Searching..." : "Search"}
        aria-label="Search"
      >
        {isSearching ? <span className="search-spinner" /> : <SendIcon size={18} />}
      </button>
    </div>
  );
}
