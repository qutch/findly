from parsers import FileProcessor, File
from ranking import FileRankingService
from pineconeService import PineconeService
import os
from dotenv import load_dotenv


async def searchDB_initial(query: str):
    """
    Fast initial search: query Pinecone and return file candidates immediately
    without waiting for Gemini ranking. This gives instant results to the user.
    """
    pc = PineconeService()

    # Query Pinecone for relevant files based on the search query
    fileMetadatas = pc.query(query)

    # Return basic file info for immediate display (no AI summary yet)
    return [
        {
            'filePath': m.get('filePath', ''),
            'fileName': m.get('fileName', ''),
            'fileType': m.get('fileType', ''),
            'score': m.get('score', 0),
            'summary': '',
            'rank': idx + 1,
        }
        for idx, m in enumerate(fileMetadatas)
    ]


async def rankFiles(query: str, filePaths: list[str]):
    """
    Background ranking: send file candidates to Gemini for intelligent
    re-ranking and summary generation. Called after initial results are shown.
    """
    # Parse files and prepare for ranking
    files = FileProcessor.sendToRankingService(filePaths)

    # Load API key
    dotenv_path = os.path.join(os.path.dirname(__file__), '../../.env')
    load_dotenv(dotenv_path)

    ranking_service = FileRankingService(os.getenv('GEMINI_API_KEY') or '')
    ranking_result = ranking_service.rank_files_sync(query, files)

    return ranking_result['rankedFiles']