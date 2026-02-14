"""Document processing service — extracts text from files."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from parsers import FileProcessor
from search import search as run_search

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
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    try:
        results = run_search(query)
        return {"results": results, "count": len(results)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
