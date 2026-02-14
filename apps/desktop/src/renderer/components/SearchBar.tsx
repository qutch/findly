import type { SearchResult } from "../types";
import { SendIcon } from "./Icons";

interface SearchBarProps {
    query: string;
    onQueryChange: (newQuery: string) => void;
    onSearch: () => Promise<SearchResult[]>;
}

export function SearchBar({ query, onQueryChange, onSearch }: SearchBarProps) {
    return (
        <div className="search-bar">
            <input
                type="text"
                className="search-input"
                placeholder="Search files..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        onSearch();
                    }
                }}
            />
            <button className="search-button" onClick={onSearch}>
                <SendIcon size={18} />
            </button>
        </div>
    );
};
