import type { SearchResult } from "../types";
import { SendIcon } from "./Icons";

interface SearchBarProps {
    query: string;
    onQueryChange: (newQuery: string) => void;
    onSearch: () => Promise<SearchResult[]>;
    disabled?: boolean;
}

export function SearchBar({ query, onQueryChange, onSearch, disabled = false }: SearchBarProps) {
    return (
        <div className={`search-bar ${disabled ? "search-bar-disabled" : ""}`}>
            <input
                type="text"
                className="search-input"
                placeholder={disabled ? "Indexing files, please wait..." : "Search files..."}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !disabled) {
                        onSearch();
                    }
                }}
                disabled={disabled}
            />
            <button className="search-button" onClick={onSearch} disabled={disabled}>
                <SendIcon size={18} />
            </button>
        </div>
    );
};
