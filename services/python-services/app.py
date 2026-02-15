"""Document processing service — extracts text from files."""

import os
import asyncio

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from search import searchDB

# Load .env from project root (two levels up from services/python-services/)
dotenv_path = os.path.join(os.path.dirname(__file__), "../../.env")
load_dotenv(dotenv_path)

from indexing import uploadFileToPinecone

app = FastAPI()

# ── Background indexing tracker ────────────────────────
_indexing_in_progress = 0
_indexing_lock = asyncio.Lock()


async def _run_indexing_task(file_path: str):
    """Run the indexing in a thread and track completion."""
    global _indexing_in_progress
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, uploadFileToPinecone, file_path)
    finally:
        async with _indexing_lock:
            _indexing_in_progress -= 1


class ProcessFileRequest(BaseModel):
    filePath: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/indexing-status")
async def indexing_status():
    """Returns how many files are still being indexed in background tasks."""
    return {"inProgress": _indexing_in_progress}


# Called from watcher when a new file is added or modified
@app.post("/process-file", status_code=202)
async def process_file(request: ProcessFileRequest):
    global _indexing_in_progress
    if not os.path.exists(request.filePath):
        raise HTTPException(status_code=404, detail=f"File not found: {request.filePath}")

    async with _indexing_lock:
        _indexing_in_progress += 1

    # Fire-and-forget the actual indexing work
    asyncio.create_task(_run_indexing_task(request.filePath))
    return {"status": "queued", "file": request.filePath}


# Called from electron app when user clicks "Search" button, with the search query as a parameter
@app.get("/search")
async def searchDatabase(query: str):
    # Call searchDB from search.py to perform the search and ranking, then return results
    results = await searchDB(query)
    return {"status": "searched", "query": query, "results": results}
