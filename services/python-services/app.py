"""Document processing service — extracts text from files."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from parsers import FileProcessor

app = FastAPI()


class ProcessFileRequest(BaseModel):
    filePath: str


@app.get("/health")
async def health():
    return {"status": "ok"}

# Called from watcher when a new file is added or modified
@app.post("/process-file")
async def process_file(request: ProcessFileRequest):
    try:
        FileProcessor.sendToPinecone(request.filePath)
        return {"status": "processed", "file": request.filePath}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {request.filePath}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Called from electron app when user clicks "Search" button, with the search query as a parameter
@app.get("/search")
async def search(query: str):
    # For now, just return the query back to the app. In a real implementation, this would trigger the search process.
    return {"status": "searching", "query": query}
