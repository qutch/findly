import type { FileMetadata, SearchResult } from "../src/types";

// Search orchestration — coordinates vector, metadata, and ranking
async function searchAndReturn(query: string) {
    // 1. Vector embed search query and retrieve candidate file IDs
    const candidateFileIds = await vectorSearch(query);

    // 2. Fetch file objects for candidate files from Supabase
    const fetchedFiles: FileMetadata[] = await fetchMetadata(candidateFileIds);

    // 3. Rank candidates based on their relevance to content and metadata
    const rankedResults: SearchResult[] = rankResults(fetchedFiles, query);

    return rankedResults;
}