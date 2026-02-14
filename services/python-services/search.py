from parsers import sendToRankingService

# Main driver of the python services: search functionality
def search(query: str):
    """
    Search for files matching the query and return ranked results.
    """

    # Step 1: Query Pinecone for relevant file names based on the search query
    fileNames = queryPinecone(query)

    # Step 2: Send file names to ranking service to get ranked list of File objects
    rankedFiles = sendToRankingService(fileNames)

    # Step 3: Return ranked files to Electron app for display
    return rankedFiles