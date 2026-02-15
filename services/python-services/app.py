"""Document processing service — extracts text from files."""

import os

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

from search import searchDB

# Load .env from project root (two levels up from services/python-services/)
dotenv_path = os.path.join(os.path.dirname(__file__), "../../.env")
load_dotenv(dotenv_path)

from indexing import uploadFileToPinecone
from parsers import FileProcessor

app = FastAPI()

# Clear the content cache at startup so each session starts fresh
FileProcessor.clearCache()


class ProcessFileRequest(BaseModel):
    filePath: str


@app.get("/health")
async def health():
    return {"status": "ok"}


# Called from watcher when a new file is added or modified
@app.post("/process-file", status_code=202)
async def process_file(request: ProcessFileRequest, background_tasks: BackgroundTasks):
    if not os.path.exists(request.filePath):
        raise HTTPException(status_code=404, detail=f"File not found: {request.filePath}")

    background_tasks.add_task(uploadFileToPinecone, request.filePath)
    return {"status": "queued", "file": request.filePath}


# Called from electron app when user clicks "Search" button, with the search query as a parameter
@app.get("/search")
async def searchDatabase(query: str):
    # Call searchDB from search.py to perform the search and ranking, then return results
    results = await searchDB(query)
    return {"status": "searched", "query": query, "results": results}
