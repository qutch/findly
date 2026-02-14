import os
from typing import Any, Dict, List

from dotenv import load_dotenv

from parsers import FileProcessor
from pineconeService import queryPinecone
from ranking import FileRankingService

dotenv_path = os.path.join(os.path.dirname(__file__), "../../.env")
load_dotenv(dotenv_path)


def _ranked_file_to_ui_result(ranked_file: Dict[str, Any], rank: int) -> Dict[str, Any]:
    file_path = ranked_file.get("filePath", "")
    file_name = os.path.basename(file_path) if file_path else "Unknown file"
    folder_path = os.path.dirname(file_path) if file_path else "Unknown folder"
    summary = ranked_file.get("summary", "No summary available.")
    reason = ranked_file.get("reason") or f"Ranked #{rank} by AI relevance scoring."

    return {
        "file": {
            "name": file_name,
            "path": file_path,
            "folder": folder_path,
        },
        "summary": summary,
        "reason": reason,
        "rank": rank,
    }


def search(query: str) -> List[Dict[str, Any]]:
    """
    Search pipeline:
    1) Retrieve semantically related file paths from Pinecone
    2) Parse file contents + metadata
    3) Rank with Gemini and generate summaries/reasons
    4) Return UI-ready result objects
    """
    file_names = queryPinecone(query)
    if not file_names:
        return []

    files = FileProcessor.sendToRankingService(file_names)

    gemini_key = os.getenv("GEMINI_API_KEY", "")
    ranking_service = FileRankingService(gemini_key)
    ranking_result = ranking_service.rank_files_sync(query, files)

    ranked_files = ranking_result.get("rankedFiles", [])
    ui_results: List[Dict[str, Any]] = []
    for idx, ranked_file in enumerate(ranked_files):
        rank = int(ranked_file.get("rank", idx + 1))
        ui_results.append(_ranked_file_to_ui_result(ranked_file, rank))

    return ui_results
