"""Document processing service — extracts text from files."""

import os

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

from parsers import FileProcessor

app = FastAPI()


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

    background_tasks.add_task(FileProcessor.sendToPinecone, request.filePath)
    return {"status": "queued", "file": request.filePath}


# Called from electron app when user clicks "Search" button, with the search query as a parameter
@app.get("/search")
async def search(query: str):
    # For now, just return the query back to the app. In a real implementation, this would trigger the search process.
    return {"status": "searching", "query": query}
