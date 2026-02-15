import type { SearchResult } from "../types";
import { SendIcon, XIcon } from "./Icons";

interface SearchBarProps {
    query: string;
    onQueryChange: (newQuery: string) => void;
    onSearch: () => Promise<SearchResult[]>;
    isLoading?: boolean;
    disabled?: boolean;
}

export function SearchBar({ query, onQueryChange, onSearch, isLoading, disabled }: SearchBarProps) {
    const barClass = `search-bar${isLoading ? " search-bar--loading" : ""}${disabled ? " search-bar--disabled" : ""}`;

    return (
        <div className={barClass}>
            <div className="search-bar__icon">
                <svg
                    width="18"
                    height="18"
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
            </div>
            <input
                type="text"
                className="search-bar__input"
                placeholder={disabled ? "Indexing in progress…" : "What would you like to find today?"}
                value={query}
                disabled={disabled}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !disabled) {
                        onSearch();
                    }
                }}
            />
            {query && !disabled && (
                <button
                    className="search-bar__clear"
                    onClick={() => onQueryChange("")}
                    title="Clear search"
                >
                    <XIcon size={12} />
                </button>
            )}
            <button
                className="search-bar__submit"
                onClick={onSearch}
                disabled={disabled}
                title="Search"
            >
                <SendIcon size={16} />
            </button>
        </div>
    );
}
