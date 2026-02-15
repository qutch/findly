import { ResultItem } from "./ResultItem";
import type { SearchResult } from "../types";

interface ResultsListProps {
    results: SearchResult[];
    onPreview?: (result: SearchResult) => void;
}

export function ResultsList({ results, onPreview }: ResultsListProps) {
    if (!results || results.length === 0) return null;

    return (
    <div className="results-list">
        {results.map((result, index) => (
        <ResultItem
            key={`${result.file?.path ?? "file"}-${index}`}
            result={result}
            animationDelay={index * 40}
            onPreview={onPreview}
        />
        ))}
    </div>
    );
}
