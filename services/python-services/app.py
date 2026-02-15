"""Document processing service — extracts text from files."""

import os
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from search import searchDB_initial, rankFiles

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


class RankRequest(BaseModel):
    query: str
    filePaths: List[str]


@app.get("/health")
async def health():
    return {"status": "ok"}


# Called from watcher when a new file is added or modified
# Synchronous so the caller knows when indexing is truly done
@app.post("/process-file")
def process_file(request: ProcessFileRequest):
    if not os.path.exists(request.filePath):
        raise HTTPException(status_code=404, detail=f"File not found: {request.filePath}")

    uploadFileToPinecone(request.filePath)
    return {"status": "processed", "file": request.filePath}


# Called from electron app — returns initial Pinecone results immediately (fast)
@app.get("/search")
async def searchDatabase(query: str):
    results = await searchDB_initial(query)
    return {"status": "searched", "query": query, "results": results}


# Called from electron app — background Gemini ranking for re-ordering + summaries
@app.post("/rank")
async def rankDatabase(request: RankRequest):
    results = await rankFiles(request.query, request.filePaths)
    return {"status": "ranked", "query": request.query, "results": results}
