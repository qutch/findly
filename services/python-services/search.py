import os
import time
from typing import Any, Dict, List
from dotenv import load_dotenv

from parsers import FileProcessor, File
from pineconeService import PinconeService
from ranking import FileRankingService


dotenv_path = os.path.join(os.path.dirname(__file__), '../../.env')
load_dotenv(dotenv_path)


def query_pinecone(query: str) -> list[str]:
    """
    Query Pinecone and return file paths for top matches.
    """
    service = PinconeService()
    matches = service.query(query)
    paths = []

    for match in matches:
        file_path = match.get("filePath") or match.get("filepath")
        if isinstance(file_path, str) and file_path:
            paths.append(file_path)

    # Keep order while removing duplicates
    return list(dict.fromkeys(paths))


def _fallback_rank(files: List[File]) -> List[Dict[str, Any]]:
    """
    Local fallback when Gemini ranking is unavailable.
    """
    ranked_files = []
    for idx, file in enumerate(files, start=1):
        ranked_files.append(
            {
                "filePath": file.metadata.get("filePath"),
                "summary": (
                    f"{file.metadata.get('fileName', 'Unknown')} "
                    f"({file.metadata.get('fileType', 'file')})"
                ),
                "rank": idx,
            }
        )
    return ranked_files


def _filter_to_pinecone_candidates(
    ranked_files: List[Dict[str, Any]],
    candidate_paths: list[str],
) -> List[Dict[str, Any]]:
    """
    Keep only ranked files that came from Pinecone candidate paths.
    """
    allowed = set(candidate_paths)
    filtered = [
        item for item in ranked_files
        if isinstance(item, dict) and isinstance(item.get("filePath"), str) and item["filePath"] in allowed
    ]

    # Re-sequence rank after filtering to keep deterministic ordering.
    for idx, item in enumerate(filtered, start=1):
        item["rank"] = idx
        item["source"] = "pinecone"
    return filtered

# Main driver of the python services: search functionality
def search(query: str):
    """
    Search for files matching the query and return ranked results.
    """

    started_at = time.time()
    query = (query or "").strip()
    if not query:
        print("[search] empty query -> []")
        return []

    print(f"[search] start query='{query}'")

    # Step 1: Query Pinecone for relevant file names based on the search query
    file_names = query_pinecone(query)
    print(f"[search] pinecone matches={len(file_names)}")
    if not file_names:
        print(f"[search] no pinecone matches in {time.time() - started_at:.2f}s")
        return []

    # Step 2: Send file names to ranking service to get ranked list of File objects
    existing_files = [file_name for file_name in file_names if os.path.isfile(file_name)]
    print(f"[search] existing local files={len(existing_files)}")
    if not existing_files:
        print(f"[search] no local files exist in {time.time() - started_at:.2f}s")
        return []

    files = FileProcessor.sendToRankingService(existing_files)
    print(f"[search] files prepared for ranking={len(files)}")

    # Step 3: Rank files using Gemini API
    gemini_api_key = os.getenv('GEMINI_API_KEY') or ''
    if not gemini_api_key:
        print("[search] GEMINI_API_KEY missing -> fallback ranking")
        return _filter_to_pinecone_candidates(_fallback_rank(files), existing_files)

    try:
        ranking_service = FileRankingService(gemini_api_key)
        ranking_result = ranking_service.rank_files_sync(query, files)
        if isinstance(ranking_result, dict):
            ranked_files = ranking_result.get('rankedFiles')
            if isinstance(ranked_files, list):
                ranked_files = _filter_to_pinecone_candidates(ranked_files, existing_files)
                print(f"[search] ranked results={len(ranked_files)} in {time.time() - started_at:.2f}s")
                return ranked_files
    except Exception as e:
        print(f"[search] gemini ranking failed -> fallback ({type(e).__name__}: {e})")

    # Step 4: Return fallback result for Electron app display
    fallback = _filter_to_pinecone_candidates(_fallback_rank(files), existing_files)
    print(f"[search] fallback results={len(fallback)} in {time.time() - started_at:.2f}s")
    return fallback
