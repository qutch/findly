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
        print(f"[docproc] /process-file start path='{request.filePath}'")
        FileProcessor.sendToPinecone(request.filePath)
        print(f"[docproc] /process-file success path='{request.filePath}'")
        return {"status": "processed", "file": request.filePath}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {request.filePath}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[docproc] /process-file error path='{request.filePath}' error='{e}'")
        raise HTTPException(status_code=500, detail=str(e))

# Called from electron app when user clicks "Search" button, with the search query as a parameter
@app.get("/search")
async def search(query: str):
    try:
        print(f"[docproc] /search start query='{query}'")
        return run_search(query)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[docproc] /search error query='{query}' error='{e}'")
        raise HTTPException(status_code=500, detail=str(e))
