import type { SearchResult } from "../types";

interface ResultsListProps {
    results: SearchResult[];
}

export function ResultsList({ results }: ResultsListProps) {
    if (!results || results.length === 0) return null;

    return (
    <div className="results-list">
        {results.map((result, index) => (
        <div className="result-item" key={`${result.file?.path ?? "file"}-${index}`}>
            <div className="result-title">{result.file?.name ?? "Untitled"}</div>
            <div className="result-path">{result.file?.path ?? ""}</div>
            {result.summary && (
            <div className="result-summary">{String(result.summary)}</div>
            )}
        </div>
        ))}
    </div>
    );
}