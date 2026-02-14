import type { FileMetadata, SearchResult } from "../src/types";

// Search orchestration — coordinates vector, metadata, and ranking
async function search(query: string) {
    // 1. Vector embed search query and retrieve candidate file IDs
    const candidateFilenames = await vectorSearch(query);

    // 2. Fetch file objects for candidate files from Supabase
    const fetchedFiles: FileMetadata[] = await fetchMetadata(candidateFilenames);

    // 3. Rank candidates based on their relevance to content and metadata
    const rankedResults: SearchResult[] = rankResults(fetchedFiles, query);

    return rankedResults;
}