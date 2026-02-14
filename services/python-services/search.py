from parsers import FileProcessor
from ranking import FileRankingService
import os
from dotenv import load_dotenv

# Main driver of the python services: search functionality
def search(query: str):
    """
    Search for files matching the query and return ranked results.
    """

    # Step 1: Query Pinecone for relevant file names based on the search query
    fileNames = queryPinecone(query)

    # Step 2: Send file names to ranking service to get ranked list of File objects
    files = FileProcessor.sendToRankingService(fileNames)

    # Step 3: Rank files using Gemini API
    
    # Load API key
    dotenv_path = os.path.join(os.path.dirname(__file__), '../../.env')
    load_dotenv(dotenv_path)
    
    ranking_service = FileRankingService(os.getenv('GEMINI_API_KEY') or '')
    ranking_result = ranking_service.rank_files_sync(query, files)
    
    # Step 4: Return ranked files to Electron app for display
    return ranking_result['rankedFiles']